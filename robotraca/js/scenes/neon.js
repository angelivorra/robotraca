import * as THREE from 'three';

// Retro cyberpunk street: a synthwave sky + striped sun, a duotoned photo
// skyline (Poly Haven "Neuer Zollhof", CC0), three parallax silhouette layers
// with lit windows, a wet-asphalt road (Poly Haven "asphalt_05", CC0) streaming
// toward the camera, neon signs with floor reflections and rain.
const TEX_BASE = 'img/textures/neon/';

const FLOOR_Y   = -2.5;
const ROAD_HALF = 3.2;
const SIGN_COUNT = 14;
const SIGN_SPAN  = 100;
const SIGN_WRAP  = 8;
const RAIN_COUNT = 700;
const RAIN_X = 16, RAIN_Z_NEAR = 4, RAIN_Z_FAR = -40, RAIN_TOP = 12;

const PALETTE = ['#ff2a9d', '#27f5ff', '#ffe14d', '#b05cff', '#ff6a3d'];

export class NeonScene {
    get useBloom() { return false; }

    constructor() {
        this._group = null;
        this._layers = [];
        this._signs = [];
        this._scrollTex = [];
        this._disposables = [];
        this._skyline = null;
        this._sun = null;
        this._rain = null;
        this._beatFlash = 0;
        this._speedBoost = 0;
        this._time = 0;
    }

    init(threeScene, theme) {
        this._group = new THREE.Group();
        threeScene.add(this._group);

        const fogCol = new THREE.Color('#1a0630');
        threeScene.background = new THREE.Color(theme.bgColor);
        threeScene.fog = new THREE.FogExp2(fogCol, 0.016);

        const rand = _rng(7);
        this._buildSky();
        this._buildLayers(rand);
        this._buildRoad();
        this._buildSigns(rand);
        this._buildRain(rand);
    }

    update(reactive, delta) {
        this._time += delta;
        this._beatFlash  *= Math.pow(0.82, delta * 60);
        this._speedBoost *= Math.pow(0.95, delta * 60);

        const bass = reactive.bassEnergy;
        const speed = (6 + bass * 18 + this._speedBoost * 20) * delta;

        for (const s of this._scrollTex) s.tex.offset.y += s.rate * speed;

        // Parallax drift: far layers move least.
        for (const l of this._layers) {
            l.tex.offset.x += l.drift * delta * (1 + this._beatFlash * 0.5);
            l.mat.color.setScalar(l.base + bass * 0.5 + this._beatFlash * 0.12);
        }

        if (this._skyline) {
            this._skyline.tex.offset.x += delta * 0.003;
            this._skyline.mat.opacity = 0.45 + bass * 0.4 + this._beatFlash * 0.1;
        }
        if (this._sun) {
            const s = 1 + bass * 0.06 + this._beatFlash * 0.05;
            this._sun.scale.set(s, s, 1);
        }

        for (const s of this._signs) {
            s.group.position.z += speed;
            if (s.group.position.z > SIGN_WRAP) s.group.position.z -= SIGN_SPAN;
            const flick = Math.sin(this._time * s.flickerRate + s.phase) > 0.93 ? 0.35 : 1;
            const b = (0.65 + reactive.midsEnergy * 0.8 + this._beatFlash * 0.5) * flick;
            s.mat.color.setScalar(b);
            s.glow.color.copy(s.glowBase).multiplyScalar(b * 0.8);
        }

        this._updateRain(delta, speed);
    }

    // ── Sky, sun and photo skyline ──────────────────────────────────────────

    _buildSky() {
        const sky = _plane(_canvasTex(8, 512, (c, w, h) => {
            const g = c.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0.00, '#05000f');
            g.addColorStop(0.45, '#2a0752');
            g.addColorStop(0.75, '#a3157a');
            g.addColorStop(0.92, '#ff5a7a');
            g.addColorStop(1.00, '#ffb066');
            c.fillStyle = g; c.fillRect(0, 0, w, h);
        }), 520, 150, { fog: false, opaque: true });
        sky.mesh.position.set(0, 25, -92);
        this._add(sky);

        const sunTex = _canvasTex(512, 512, (c, w, h) => {
            const g = c.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#ffe14d');
            g.addColorStop(0.55, '#ff4fa0');
            g.addColorStop(1, '#b0189a');
            c.fillStyle = g;
            c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2); c.fill();
            // Retro stripes carved out of the lower half.
            c.globalCompositeOperation = 'destination-out';
            for (let i = 0; i < 9; i++) {
                const y = h * 0.5 + i * (h * 0.055) + i * i * 1.6;
                c.fillRect(0, y, w, 4 + i * 2.2);
            }
        });
        const sun = _plane(sunTex, 34, 34, { fog: false });
        sun.mesh.position.set(0, 7, -90);
        this._sun = sun.mesh;
        this._add(sun);

        const sk = new THREE.TextureLoader().load(TEX_BASE + 'skyline.jpg');
        sk.wrapS = THREE.RepeatWrapping;
        sk.colorSpace = THREE.SRGBColorSpace;
        const skMat = new THREE.MeshBasicMaterial({
            map: sk, transparent: true, opacity: 0.5, depthWrite: false,
            blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
        });
        const skMesh = new THREE.Mesh(new THREE.PlaneGeometry(300, 44), skMat);
        skMesh.position.set(0, FLOOR_Y + 22 + 4, -88);
        this._skyline = { tex: sk, mat: skMat };
        this._group.add(skMesh);
        this._disposables.push(sk, skMat, skMesh.geometry);
    }

    // ── Parallax silhouette layers ──────────────────────────────────────────

    _buildLayers(rand) {
        const defs = [
            { z: -70, tileW: 100, h: 24, body: '#1a0a3a', alpha: 0.95, base: 0.7, drift: 0.0012, seed: 1 },
            { z: -48, tileW: 80,  h: 20, body: '#0f0526', alpha: 1,    base: 0.8, drift: 0.0030, seed: 2 },
            { z: -30, tileW: 60,  h: 15, body: '#07021a', alpha: 1,    base: 0.9, drift: 0.0060, seed: 3 },
        ];
        for (const d of defs) {
            const tex = _canvasTex(1024, 256, (c, w, h) => _drawSkyline(c, w, h, d, _rng(d.seed * 31)));
            tex.wrapS = THREE.RepeatWrapping;
            const planeW = d.tileW * 2.5;
            tex.repeat.set(planeW / d.tileW, 1);
            const p = _plane(tex, planeW, d.h, { toneMapped: false });
            p.mesh.position.set(0, FLOOR_Y + d.h / 2 - 0.05, d.z);
            this._layers.push({ tex, mat: p.mesh.material, base: d.base, drift: d.drift });
            this._add(p);
        }
    }

    // ── Wet asphalt road with neon lane lines ───────────────────────────────

    _buildRoad() {
        const length = 130;
        const loader = new THREE.TextureLoader();

        const asphalt = loader.load(TEX_BASE + 'asphalt.jpg');
        asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
        asphalt.repeat.set(16, length / 6);
        asphalt.colorSpace = THREE.SRGBColorSpace;
        const floorMat = new THREE.MeshBasicMaterial({ map: asphalt, color: new THREE.Color('#7a4ea8') });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, length), floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, FLOOR_Y, -length / 2 + 10);
        this._group.add(floor);
        this._scrollTex.push({ tex: asphalt, rate: 1 / 6 });
        this._disposables.push(asphalt, floorMat, floor.geometry);

        // Neon lane lines (edges solid, center dashed) scrolling with the road.
        const lanes = _canvasTex(128, 256, (c, w, h) => {
            c.fillStyle = '#27f5ff';
            c.fillRect(2, 0, 6, h); c.fillRect(w - 8, 0, 6, h);
            c.fillStyle = '#ff2a9d';
            c.fillRect(w / 2 - 3, 0, 6, h * 0.5);
        });
        lanes.wrapS = lanes.wrapT = THREE.RepeatWrapping;
        lanes.repeat.set(1, length / 8);
        const laneMat = new THREE.MeshBasicMaterial({
            map: lanes, transparent: true, toneMapped: false, depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        const lane = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, length), laneMat);
        lane.rotation.x = -Math.PI / 2;
        lane.position.set(0, FLOOR_Y + 0.01, -length / 2 + 10);
        this._group.add(lane);
        this._scrollTex.push({ tex: lanes, rate: 1 / 8 });
        this._disposables.push(lanes, laneMat, lane.geometry);
    }

    // ── Neon signs + floor reflections ──────────────────────────────────────

    _buildSigns(rand) {
        const texts = ['電脳', 'BAR', 'OPEN', 'ネオン', '24H', 'RAMEN', 'ロボ', 'HOTEL', '夜', 'ROBOTRACA'];
        const glowTex = _canvasTex(64, 128, (c, w, h) => {
            const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h / 2);
            g.addColorStop(0, 'rgba(255,255,255,0.9)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = g; c.fillRect(0, 0, w, h);
        });
        this._disposables.push(glowTex);

        for (let i = 0; i < SIGN_COUNT; i++) {
            const side = i % 2 === 0 ? -1 : 1;
            const color = PALETTE[Math.floor(rand() * PALETTE.length)];
            const text = texts[Math.floor(rand() * texts.length)];
            const vertical = rand() < 0.4;
            const w = vertical ? 1.3 : 3.2, h = vertical ? 4.2 : 1.3;
            const tex = _canvasTex(vertical ? 128 : 256, vertical ? 384 : 128, (c, cw, ch) => {
                c.fillStyle = 'rgba(8,0,20,0.85)'; c.fillRect(0, 0, cw, ch);
                c.strokeStyle = color; c.lineWidth = 6; c.strokeRect(5, 5, cw - 10, ch - 10);
                c.fillStyle = color; c.shadowColor = color; c.shadowBlur = 14;
                c.textAlign = 'center'; c.textBaseline = 'middle';
                if (vertical) {
                    c.font = `bold ${cw * 0.62}px sans-serif`;
                    const chars = [...text].slice(0, 4);
                    chars.forEach((ch2, k) => c.fillText(ch2, cw / 2, ch * (k + 0.5) / chars.length));
                } else {
                    c.font = `bold ${ch * 0.56}px sans-serif`;
                    c.fillText(text, cw / 2, ch / 2 + 2, cw - 24);
                }
            });
            const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
            mesh.rotation.y = -side * 0.5;

            const glowMat = new THREE.MeshBasicMaterial({
                map: glowTex, color: new THREE.Color(color), transparent: true, opacity: 0.55,
                blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
            });
            const glow = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.6, 7), glowMat);
            glow.rotation.x = -Math.PI / 2;

            const x = side * (ROAD_HALF + 1.8 + rand() * 4);
            const y = FLOOR_Y + h / 2 + 0.6 + rand() * 2.2;
            const group = new THREE.Group();
            group.position.set(x, 0, -(i / SIGN_COUNT) * SIGN_SPAN + SIGN_WRAP * 0.5);
            mesh.position.y = y;
            glow.position.set(-side * 0.6, FLOOR_Y + 0.02, 0);
            group.add(mesh, glow);
            this._group.add(group);
            this._signs.push({
                group, mat, glow: glowMat, glowBase: new THREE.Color(color),
                flickerRate: 3 + rand() * 9, phase: rand() * 10,
            });
            this._disposables.push(tex, mat, glowMat, mesh.geometry, glow.geometry);
        }
    }

    // ── Rain ─────────────────────────────────────────────────────────────────

    _buildRain(rand) {
        const pos = new Float32Array(RAIN_COUNT * 6);
        for (let i = 0; i < RAIN_COUNT; i++) {
            const x = (rand() * 2 - 1) * RAIN_X;
            const y = FLOOR_Y + rand() * RAIN_TOP;
            const z = RAIN_Z_FAR + rand() * (RAIN_Z_NEAR - RAIN_Z_FAR);
            pos.set([x, y, z, x - 0.05, y + 0.55, z], i * 6);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.LineBasicMaterial({
            color: '#8feaff', transparent: true, opacity: 0.35, toneMapped: false, fog: false,
        });
        this._rain = new THREE.LineSegments(geo, mat);
        this._rain.frustumCulled = false;
        this._group.add(this._rain);
        this._disposables.push(geo, mat);
    }

    _updateRain(delta, roadSpeed) {
        const attr = this._rain.geometry.attributes.position;
        const a = attr.array;
        const fall = 22 * delta;
        for (let i = 0; i < RAIN_COUNT; i++) {
            const o = i * 6;
            a[o + 1] -= fall; a[o + 4] -= fall;
            a[o + 2] += roadSpeed * 0.5; a[o + 5] += roadSpeed * 0.5;
            if (a[o + 1] < FLOOR_Y || a[o + 2] > RAIN_Z_NEAR) {
                const y = FLOOR_Y + RAIN_TOP;
                const z = RAIN_Z_FAR * Math.random();
                const x = (Math.random() * 2 - 1) * RAIN_X;
                a[o] = x; a[o + 1] = y; a[o + 2] = z;
                a[o + 3] = x - 0.05; a[o + 4] = y + 0.55; a[o + 5] = z;
            }
        }
        attr.needsUpdate = true;
    }

    // ── Interaction ──────────────────────────────────────────────────────────

    onBeat() { this._beatFlash = 1.0; }
    onTap()  { this._beatFlash = 1.4; }
    onSwipe(dir) {
        if (dir === 'up')   this._speedBoost += 0.8;
        if (dir === 'down') this._speedBoost = Math.max(0, this._speedBoost - 0.3);
    }

    dispose() {
        for (const d of this._disposables) d.dispose();
        this._group?.parent?.remove(this._group);
        this._group = null;
        this._layers = [];
        this._signs = [];
        this._scrollTex = [];
        this._disposables = [];
        this._skyline = this._sun = this._rain = null;
    }

    _add(p) {
        this._group.add(p.mesh);
        this._disposables.push(p.tex, p.mesh.material, p.mesh.geometry);
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function _rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
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

function _plane(tex, w, h, { fog = true, opaque = false, toneMapped = false } = {}) {
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: !opaque, fog, toneMapped });
    return { tex, mesh: new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat) };
}

function _drawSkyline(c, w, h, d, rand) {
    const lit = ['#27f5ff', '#ff2a9d', '#ffe14d', '#b05cff'];
    let x = 0;
    while (x < w) {
        const bw = Math.min(w - x, 28 + rand() * 60);
        const bh = h * (0.25 + rand() * 0.7);
        const top = h - bh;
        c.fillStyle = d.body;
        c.fillRect(x, top, bw, bh);
        // Rooftop antenna / neon trim.
        if (rand() < 0.4) c.fillRect(x + bw / 2 - 1, top - 14 - rand() * 18, 2, 30);
        if (rand() < 0.35) {
            c.fillStyle = lit[Math.floor(rand() * lit.length)];
            c.fillRect(x, top, bw, 2);
        }
        // Lit windows.
        const wc = lit[Math.floor(rand() * lit.length)];
        for (let wy = top + 8; wy < h - 6; wy += 9) {
            for (let wx = x + 5; wx < x + bw - 6; wx += 8) {
                if (rand() < 0.28) {
                    c.fillStyle = rand() < 0.8 ? wc : lit[Math.floor(rand() * lit.length)];
                    c.fillRect(wx, wy, 3, 4);
                }
            }
        }
        x += bw + (rand() < 0.3 ? 2 + rand() * 4 : 0);
    }
}
