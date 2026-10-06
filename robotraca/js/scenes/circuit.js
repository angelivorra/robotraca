import * as THREE from 'three';

// Low flight over a cyberpunk circuit board: dark PCB floor with glowing traces
// scrolling toward the camera, chips and capacitors passing on both sides with
// blinking LEDs, and data pulses racing along the straight traces. All procedural.
const FLOOR_Y   = -2.4;
const LENGTH    = 160;
const FLOOR_W   = 120;
const TILE      = 16;              // world units covered by one texture tile
const LANES     = [0.125, 0.375, 0.625, 0.875]; // straight vertical traces (fraction of tile in x)
const PULSES    = 46;
const FAR_Z     = -120;
const NEAR_Z    = 8;
const SPAN      = NEAR_Z - FAR_Z;
const COMPONENTS = 30;

export class CircuitScene {
    get useBloom() { return false; }

    constructor() {
        this._group = null;
        this._grid = null;
        this._items = [];
        this._pulses = null;
        this._ledMats = [];
        this._disposables = [];
        this._beatFlash = 0;
        this._speedBoost = 0;
        this._time = 0;
        this._primary = new THREE.Color();
        this._secondary = new THREE.Color();
    }

    init(threeScene, theme) {
        this._group = new THREE.Group();
        threeScene.add(this._group);
        this._primary.set(theme.primaryColor);
        this._secondary.set(theme.secondaryColor);

        threeScene.background = new THREE.Color('#02100f');
        threeScene.fog = new THREE.FogExp2(new THREE.Color('#06302e'), 0.019);

        this._rng = _rng(7);
        this._buildSky();
        this._buildFloor();
        this._buildComponents();
        this._buildPulses();
    }

    update(reactive, delta) {
        this._time += delta;
        this._beatFlash  *= Math.pow(0.84, delta * 60);
        this._speedBoost *= Math.pow(0.95, delta * 60);

        const bass  = reactive.bassEnergy;
        const speed = (6 + bass * 14 + this._speedBoost * 16) * delta;

        // Floor
        this._grid.tex.offset.y += speed / TILE;
        this._grid.mat.color.setScalar(0.8 + bass * 0.6 + this._beatFlash * 0.6);

        // Components wrap around
        for (const it of this._items) {
            it.obj.position.z += speed;
            if (it.obj.position.z > NEAR_Z) it.obj.position.z -= SPAN;
        }

        // LEDs: slow blink + beat flash
        for (let i = 0; i < this._ledMats.length; i++) {
            const m = this._ledMats[i];
            const blink = 0.45 + 0.35 * Math.sin(this._time * (2 + i) + i * 1.3);
            const k = Math.min(1.6, blink + bass * 0.4 + this._beatFlash * 0.9);
            m.color.copy(m.userData.base).multiplyScalar(k);
        }

        // Data pulses travel faster than the floor along their lane
        const p = this._pulses;
        const pos = p.geo.attributes.position;
        const adv = speed * 2.2 + delta * 6;
        for (let i = 0; i < PULSES; i++) {
            let z = pos.getZ(i) + adv;
            if (z > NEAR_Z) z -= SPAN;
            pos.setZ(i, z);
        }
        pos.needsUpdate = true;
        p.mat.size = 0.55 + bass * 0.4 + this._beatFlash * 0.45;
        p.mat.opacity = 0.8 + this._beatFlash * 0.2;

        this._horizon.material.opacity = 0.75 + bass * 0.25 + this._beatFlash * 0.2;
        for (const e of this._edgeMats) {
            e.color.copy(this._secondary).lerp(this._primary, Math.min(1, bass + this._beatFlash * 0.6));
            e.opacity = 0.6 + bass * 0.3 + this._beatFlash * 0.2;
        }
    }

    // ── Sky / horizon ───────────────────────────────────────────────────────

    _buildSky() {
        const skyTex = _canvasTex(8, 512, (c, w, h) => {
            const g = c.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0.00, '#010607');
            g.addColorStop(0.55, '#04201f');
            g.addColorStop(0.85, '#0b5a55');
            g.addColorStop(1.00, '#1fc9b4');
            c.fillStyle = g; c.fillRect(0, 0, w, h);
        });
        const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, fog: false, toneMapped: false });
        const sky = new THREE.Mesh(new THREE.PlaneGeometry(440, 190), skyMat);
        sky.position.set(0, 24, -93);
        this._group.add(sky);

        // Magenta glow band right at the horizon
        const glowTex = _canvasTex(8, 128, (c, w, h) => {
            const g = c.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, 'rgba(255,42,157,0)');
            g.addColorStop(1, 'rgba(255,42,157,0.9)');
            c.fillStyle = g; c.fillRect(0, 0, w, h);
        });
        const glowMat = new THREE.MeshBasicMaterial({
            map: glowTex, transparent: true, fog: false, toneMapped: false,
            depthWrite: false, blending: THREE.AdditiveBlending,
        });
        this._horizon = new THREE.Mesh(new THREE.PlaneGeometry(440, 26), glowMat);
        this._horizon.position.set(0, FLOOR_Y + 12, -90);
        this._group.add(this._horizon);
        this._horizon.material.opacity = 1;

        this._disposables.push(skyTex, skyMat, sky.geometry, glowTex, glowMat, this._horizon.geometry);
    }

    // ── PCB floor ───────────────────────────────────────────────────────────

    _buildFloor() {
        const rng = _rng(21);
        const tex = _canvasTex(512, 512, (c, w, h) => {
            c.fillStyle = '#031512'; c.fillRect(0, 0, w, h);
            // faint board speckle
            for (let i = 0; i < 260; i++) {
                c.fillStyle = 'rgba(40,200,170,0.10)';
                c.fillRect(rng() * w, rng() * h, 2, 2);
            }
            const trace = (pts, col, lw) => {
                c.strokeStyle = col; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round';
                c.shadowColor = col; c.shadowBlur = 8;
                c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
                for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
                c.stroke();
            };
            const pad = (x, y, r, col) => {
                c.shadowColor = col; c.shadowBlur = 10;
                c.fillStyle = col;
                c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
                c.shadowBlur = 0; c.fillStyle = '#031512';
                c.beginPath(); c.arc(x, y, r * 0.45, 0, Math.PI * 2); c.fill();
            };
            const cyan = '#27f5ff', mag = '#ff2a9d', green = '#2bffa0';

            // Straight lanes that run the full tile (seamless, pulses ride these)
            LANES.forEach((f, i) => {
                const x = f * w;
                trace([[x, -4], [x, h + 4]], i % 2 ? mag : cyan, 4);
            });
            // Side traces with 45 and 90 degree bends that join the lanes
            for (let i = 0; i < 14; i++) {
                const lane = LANES[(rng() * 4) | 0] * w;
                const dir = rng() < 0.5 ? -1 : 1;
                const y0 = rng() * h, d = 30 + rng() * 60, run = 40 + rng() * 90;
                const x1 = lane + dir * d;
                const pts = [[lane, y0], [x1, y0 + d * (rng() < 0.5 ? 1 : -1)], [x1, y0 + d + run]];
                const col = [cyan, mag, green][(rng() * 3) | 0];
                trace(pts, col, 3);
                pad(pts[2][0], pts[2][1], 8, col);
            }
            // Parallel bus: bundle of short lines
            for (let i = 0; i < 6; i++) {
                const x = 0.25 * w + (i - 2.5) * 10 + w * 0.25;
                trace([[x, 60], [x, 140], [x + 30, 170], [x + 30, 230]], green, 2);
            }
            // Vias
            for (let i = 0; i < 18; i++) {
                const col = rng() < 0.5 ? cyan : mag;
                pad(rng() * w, rng() * h, 5 + rng() * 4, col);
            }
            // Bright pads on lanes
            LANES.forEach((f, i) => pad(f * w, (i * 130 + 70) % h, 10, i % 2 ? mag : cyan));
        });
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = 8;
        tex.repeat.set(FLOOR_W / TILE, LENGTH / TILE);
        const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_W, LENGTH), mat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, FLOOR_Y, -LENGTH / 2 + 12);
        this._group.add(floor);
        this._grid = { tex, mat };
        this._disposables.push(tex, mat, floor.geometry);
    }

    // ── Chips and capacitors ────────────────────────────────────────────────

    _buildComponents() {
        const rng = this._rng;
        this._edgeMats = [];

        const edgeMat = new THREE.LineBasicMaterial({
            color: this._secondary, transparent: true, opacity: 0.7, toneMapped: false,
        });
        this._edgeMats.push(edgeMat);
        this._disposables.push(edgeMat);

        const chipTop = _canvasTex(128, 128, (c, w, h) => {
            c.fillStyle = '#0c1d24'; c.fillRect(0, 0, w, h);
            c.strokeStyle = '#27f5ff'; c.lineWidth = 3; c.strokeRect(6, 6, w - 12, h - 12);
            c.fillStyle = '#27f5ff'; c.fillRect(14, 14, 10, 10);
            c.fillStyle = '#1b6b78';
            for (let i = 0; i < 4; i++) c.fillRect(30, 40 + i * 18, 70 - i * 10, 6);
        });
        const bodyMat = new THREE.MeshBasicMaterial({ color: '#16303a', toneMapped: false });
        const topMat  = new THREE.MeshBasicMaterial({ map: chipTop, toneMapped: false });
        const pinMat  = new THREE.MeshBasicMaterial({ color: '#b8c8c8', toneMapped: false });
        const capMat  = new THREE.MeshBasicMaterial({ color: '#1d4a55', toneMapped: false });
        const capTop  = new THREE.MeshBasicMaterial({ color: '#8fb4b8', toneMapped: false });
        this._disposables.push(chipTop, bodyMat, topMat, pinMat, capMat, capTop);

        const ledColors = ['#27f5ff', '#ff2a9d', '#2bffa0'];
        for (const col of ledColors) {
            const m = new THREE.MeshBasicMaterial({ color: col, toneMapped: false });
            m.userData.base = new THREE.Color(col);
            this._ledMats.push(m);
            this._disposables.push(m);
        }

        const boxGeo = new THREE.BoxGeometry(1, 1, 1);
        const edgeGeo = new THREE.EdgesGeometry(boxGeo);
        const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 14);
        const cylEdge = new THREE.EdgesGeometry(cylGeo);
        const pinGeo = new THREE.BoxGeometry(0.12, 0.08, 0.2);
        const ledGeo = new THREE.BoxGeometry(0.22, 0.12, 0.22);
        this._disposables.push(boxGeo, edgeGeo, cylGeo, cylEdge, pinGeo, ledGeo);

        for (let i = 0; i < COMPONENTS; i++) {
            const side = i % 2 ? 1 : -1;
            const obj = new THREE.Group();
            const x = side * (4.2 + rng() * rng() * 22 + (rng() < 0.3 ? 0 : 0));
            const z = FAR_Z + (i / COMPONENTS) * SPAN + rng() * 2;
            obj.position.set(x, FLOOR_Y, z);
            const led = this._ledMats[(rng() * 3) | 0];

            if (rng() < 0.6) {
                // Chip
                const w = 2 + rng() * 3.5, d = 2 + rng() * 3.5, h = 0.4 + rng() * 0.9;
                const body = new THREE.Mesh(boxGeo, [bodyMat, bodyMat, topMat, bodyMat, bodyMat, bodyMat]);
                body.scale.set(w, h, d);
                body.position.y = h / 2 + 0.1;
                obj.add(body);
                const edges = new THREE.LineSegments(edgeGeo, edgeMat);
                edges.scale.copy(body.scale); edges.position.copy(body.position);
                obj.add(edges);
                // Pins along both long sides
                const n = Math.max(3, Math.floor(d / 0.35));
                for (let k = 0; k < n; k++) {
                    for (const s of [-1, 1]) {
                        const pin = new THREE.Mesh(pinGeo, pinMat);
                        pin.rotation.y = Math.PI / 2;
                        pin.position.set(s * (w / 2 + 0.08), 0.18, -d / 2 + (k + 0.5) * (d / n));
                        obj.add(pin);
                    }
                }
                const l = new THREE.Mesh(ledGeo, led);
                l.position.set(w / 2 - 0.3, h + 0.15, d / 2 - 0.3);
                obj.add(l);
            } else {
                // Capacitor (cylinder), sometimes a tall one
                const r = 0.45 + rng() * 0.7, h = 0.9 + rng() * 2.6;
                const cyl = new THREE.Mesh(cylGeo, [capMat, capTop, capTop]);
                cyl.scale.set(r, h, r);
                cyl.position.y = h / 2 + 0.05;
                obj.add(cyl);
                const edges = new THREE.LineSegments(cylEdge, edgeMat);
                edges.scale.copy(cyl.scale); edges.position.copy(cyl.position);
                obj.add(edges);
                const l = new THREE.Mesh(ledGeo, led);
                l.position.set(0, h + 0.15, 0);
                obj.add(l);
            }
            obj.rotation.y = (rng() < 0.5 ? 0 : Math.PI / 2) * (rng() < 0.3 ? 1 : 0);
            this._group.add(obj);
            this._items.push({ obj });
        }
    }

    // ── Data pulses ─────────────────────────────────────────────────────────

    _buildPulses() {
        const rng = this._rng;
        const pos = new Float32Array(PULSES * 3);
        const lanesWorld = [];
        for (let n = 0; n < FLOOR_W / TILE; n++) {
            for (const f of LANES) lanesWorld.push(-FLOOR_W / 2 + (n + f) * TILE);
        }
        for (let i = 0; i < PULSES; i++) {
            pos[i * 3]     = lanesWorld[(rng() * lanesWorld.length) | 0];
            pos[i * 3 + 1] = FLOOR_Y + 0.12;
            pos[i * 3 + 2] = FAR_Z + rng() * SPAN;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const tex = _canvasTex(64, 64, (c, w, h) => {
            const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(0.3, 'rgba(255,255,255,0.85)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = g; c.fillRect(0, 0, w, h);
        });
        const mat = new THREE.PointsMaterial({
            color: '#bffcff', map: tex, size: 0.6, sizeAttenuation: true,
            transparent: true, opacity: 0.9, depthWrite: false,
            blending: THREE.AdditiveBlending, toneMapped: false,
        });
        const pts = new THREE.Points(geo, mat);
        pts.frustumCulled = false;
        this._group.add(pts);
        this._pulses = { geo, mat };
        this._disposables.push(geo, tex, mat);
    }

    onBeat() { this._beatFlash = 1.0; }
    onTap()  { this._beatFlash = 1.5; }
    onSwipe(dir) {
        if (dir === 'up')   this._speedBoost += 0.8;
        if (dir === 'down') this._speedBoost = Math.max(0, this._speedBoost - 0.3);
    }

    dispose() {
        for (const d of this._disposables) d.dispose();
        this._group?.parent?.remove(this._group);
        this._group = null;
        this._items = [];
        this._ledMats = [];
        this._edgeMats = [];
        this._disposables = [];
        this._grid = this._pulses = this._horizon = null;
    }
}

function _rng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function _canvasTex(w, h, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    draw(canvas.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}
