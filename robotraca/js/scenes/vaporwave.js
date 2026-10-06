import * as THREE from 'three';

// Vaporwave landscape: pastel pink/turquoise checkerboard floor streaming toward the
// camera, white greek columns and palm silhouettes on both sides (recycled), a huge
// gradient sun, pastel sky, a floating statue head and pulsing rings. All procedural.
const FLOOR_Y   = -2.4;
const LENGTH    = 160;
const SPAN      = 100;          // recycle distance for side props
const NEAR_Z    = 8;
const COLUMNS   = 14;
const PALMS     = 10;

export class VaporwaveScene {
    get useBloom() { return false; }

    constructor() {
        this._group = null;
        this._grid = null;
        this._sun = null;
        this._rings = [];
        this._columns = [];
        this._palms = [];
        this._head = null;
        this._disposables = [];
        this._beatFlash = 0;
        this._speedBoost = 0;
        this._time = 0;
        this._primary = new THREE.Color();
        this._secondary = new THREE.Color();
        this._rng = _rng(1337);
    }

    init(threeScene, theme) {
        this._group = new THREE.Group();
        threeScene.add(this._group);
        this._primary.set(theme.primaryColor);
        this._secondary.set(theme.secondaryColor);

        threeScene.background = new THREE.Color('#2a1050');
        threeScene.fog = new THREE.FogExp2(new THREE.Color('#d98cf0'), 0.016);

        this._buildSky();
        this._buildGrid();
        this._buildColumns();
        this._buildPalms();
        this._buildHead();
    }

    update(reactive, delta) {
        this._time += delta;
        this._beatFlash  *= Math.pow(0.84, delta * 60);
        this._speedBoost *= Math.pow(0.95, delta * 60);

        const bass  = reactive.bassEnergy;
        const speed = (6 + bass * 14 + this._speedBoost * 16) * delta;

        // Floor: texture holds 2x2 tiles of 8 units = 16 units per repeat.
        this._grid.tex.offset.y += speed / 16;
        this._grid.mat.color.setScalar(0.92 + bass * 0.25 + this._beatFlash * 0.3);

        for (const c of this._columns) {
            c.group.position.z += speed;
            if (c.group.position.z > NEAR_Z) c.group.position.z -= SPAN;
            c.group.position.y = c.baseY + Math.sin(this._time * 0.8 + c.phase) * 0.25 * c.float;
            c.group.rotation.z = c.tilt + Math.sin(this._time * 0.5 + c.phase) * 0.04 * c.float;
        }
        for (const p of this._palms) {
            p.group.position.z += speed;
            if (p.group.position.z > NEAR_Z) p.group.position.z -= SPAN;
            p.group.rotation.z = p.lean + Math.sin(this._time * 1.2 + p.phase) * 0.03 + bass * 0.04 * p.side;
        }
        this._colMat.color.setScalar(0.92 + bass * 0.1 + this._beatFlash * 0.2);
        this._palmMat.color.copy(this._palmBase).lerp(this._primary, this._beatFlash * 0.3);

        const s = 1 + bass * 0.04 + this._beatFlash * 0.05;
        this._sun.scale.set(s, s, 1);

        this._rings.forEach((r, i) => {
            const t = (this._time * 0.25 + i / this._rings.length) % 1;
            const sc = 1 + t * 1.3 + this._beatFlash * 0.1;
            r.mesh.scale.set(sc, sc, 1);
            r.mat.opacity = (1 - t) * (0.45 + bass * 0.4 + this._beatFlash * 0.2);
        });

        const h = this._head;
        h.group.position.y = h.baseY + Math.sin(this._time * 0.9) * 0.3;
        h.group.rotation.y = Math.sin(this._time * 0.5) * 0.5;
        const hs = 1 + this._beatFlash * 0.12 + bass * 0.05;
        h.group.scale.setScalar(hs);
        h.mat.color.setScalar(0.95 + this._beatFlash * 0.2 + reactive.highsEnergy * 0.1);
    }

    // ── Sky, sun, rings ─────────────────────────────────────────────────────

    _buildSky() {
        const skyTex = _canvasTex(8, 512, (c, w, h) => {
            const g = c.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0.00, '#3b1a8c');
            g.addColorStop(0.22, '#5a2cb8');
            g.addColorStop(0.40, '#9a5ae0');
            g.addColorStop(0.52, '#ff8ad4');
            g.addColorStop(0.60, '#ffd0ec');
            g.addColorStop(0.67, '#8ff0e8');
            g.addColorStop(1.00, '#8ff0e8');
            c.fillStyle = g; c.fillRect(0, 0, w, h);
        });
        const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, fog: false, toneMapped: false });
        const sky = new THREE.Mesh(new THREE.PlaneGeometry(440, 190), skyMat);
        sky.position.set(0, 20, -88);
        this._group.add(sky);

        const sunTex = _canvasTex(512, 512, (c, w, h) => {
            const g = c.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#fff3a0');
            g.addColorStop(0.5, '#ff9ad0');
            g.addColorStop(1, '#a45cff');
            c.fillStyle = g;
            c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2); c.fill();
            c.globalCompositeOperation = 'destination-out';
            for (let i = 0; i < 7; i++) {
                c.fillRect(0, h * 0.58 + i * h * 0.055, w, 2 + i * 2);
            }
        });
        const sunMat = new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false, toneMapped: false });
        this._sun = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), sunMat);
        this._sun.position.set(0, FLOOR_Y + 15, -84);
        this._group.add(this._sun);

        // Pulsing rings around the sun.
        const ringGeo = new THREE.RingGeometry(27, 28, 64);
        for (let i = 0; i < 3; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: i % 2 ? this._primary : this._secondary, transparent: true, opacity: 0.4,
                fog: false, toneMapped: false, side: THREE.DoubleSide, depthWrite: false,
            });
            const mesh = new THREE.Mesh(ringGeo, mat);
            mesh.position.copy(this._sun.position);
            mesh.position.z += 0.5;
            this._group.add(mesh);
            this._rings.push({ mesh, mat });
            this._disposables.push(mat);
        }
        this._disposables.push(skyTex, skyMat, sky.geometry, sunTex, sunMat, this._sun.geometry, ringGeo);
    }

    // ── Checkerboard floor ──────────────────────────────────────────────────

    _buildGrid() {
        const tex = _canvasTex(256, 256, (c, w, h) => {
            const a = '#ff9fd8', b = '#7ff3e6';
            c.fillStyle = a; c.fillRect(0, 0, w, h);
            c.fillStyle = b;
            c.fillRect(0, 0, w / 2, h / 2);
            c.fillRect(w / 2, h / 2, w / 2, h / 2);
        });
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = 8;
        const width = 128;
        tex.repeat.set(width / 16, LENGTH / 16);
        const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, LENGTH), mat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, FLOOR_Y, -LENGTH / 2 + 12);
        this._group.add(floor);
        this._grid = { tex, mat };
        this._disposables.push(tex, mat, floor.geometry);
    }

    // ── Greek columns ───────────────────────────────────────────────────────

    _buildColumns() {
        const fluteTex = _canvasTex(128, 8, (c, w, h) => {
            const g = c.createLinearGradient(0, 0, w, 0);
            g.addColorStop(0, '#d8cdf5');
            g.addColorStop(0.35, '#ffffff');
            g.addColorStop(0.75, '#f0e6ff');
            g.addColorStop(1, '#b9a8e8');
            c.fillStyle = g; c.fillRect(0, 0, w, h);
            c.fillStyle = 'rgba(120,90,200,0.35)';
            for (let i = 0; i < 8; i++) c.fillRect(i * 16 + 13, 0, 3, h);
        });
        const mat = new THREE.MeshBasicMaterial({ map: fluteTex, toneMapped: false });
        const capMat = new THREE.MeshBasicMaterial({ color: '#fff4ff', toneMapped: false });
        this._colMat = capMat;
        const shaftGeo = new THREE.CylinderGeometry(0.42, 0.5, 6, 12, 1);
        const capGeo = new THREE.BoxGeometry(1.4, 0.35, 1.4);
        const baseGeo = new THREE.BoxGeometry(1.3, 0.3, 1.3);
        this._disposables.push(fluteTex, mat, capMat, shaftGeo, capGeo, baseGeo);

        for (let i = 0; i < COLUMNS; i++) {
            const side = i % 2 ? 1 : -1;
            const g = new THREE.Group();
            const shaft = new THREE.Mesh(shaftGeo, mat);
            const cap = new THREE.Mesh(capGeo, capMat); cap.position.y = 3.15;
            const base = new THREE.Mesh(baseGeo, capMat); base.position.y = -3.15;
            g.add(shaft, cap, base);
            const floating = this._rng() < 0.35;
            const x = side * (7 + this._rng() * 4 + (floating ? 1 : 0));
            const baseY = floating ? FLOOR_Y + 5 + this._rng() * 3 : FLOOR_Y + 3.15;
            const tilt = floating ? (this._rng() - 0.5) * 0.5 : 0;
            g.position.set(x, baseY, NEAR_Z - (i / COLUMNS) * SPAN);
            g.rotation.z = tilt;
            this._group.add(g);
            this._columns.push({ group: g, baseY, tilt, float: floating ? 1 : 0, phase: this._rng() * 6.28 });
        }
    }

    // ── Palm silhouettes ────────────────────────────────────────────────────

    _buildPalms() {
        this._palmBase = new THREE.Color('#5a1f8f');
        this._palmMat = new THREE.MeshBasicMaterial({ color: this._palmBase.clone(), toneMapped: false, side: THREE.DoubleSide });
        const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 5, 6);
        trunkGeo.translate(0, 2.5, 0);
        // Leaf: tapered flat blade, pivot at its base, pointing +x and drooping.
        const leafGeo = new THREE.PlaneGeometry(2.4, 0.5, 4, 1);
        leafGeo.translate(1.2, 0, 0);
        const lp = leafGeo.attributes.position;
        for (let i = 0; i < lp.count; i++) {
            const x = lp.getX(i);
            const t = x / 2.4;
            lp.setY(i, lp.getY(i) * (1 - t * 0.85) - t * t * 0.9);
        }
        leafGeo.computeVertexNormals();
        this._disposables.push(this._palmMat, trunkGeo, leafGeo);

        for (let i = 0; i < PALMS; i++) {
            const side = i % 2 ? 1 : -1;
            const g = new THREE.Group();
            g.add(new THREE.Mesh(trunkGeo, this._palmMat));
            const top = new THREE.Group();
            top.position.y = 5;
            for (let k = 0; k < 7; k++) {
                const leaf = new THREE.Mesh(leafGeo, this._palmMat);
                leaf.rotation.y = (k / 7) * Math.PI * 2;
                leaf.rotation.z = 0.25;
                top.add(leaf);
            }
            g.add(top);
            const x = side * (4.6 + this._rng() * 2.5);
            const sc = 0.9 + this._rng() * 0.5;
            g.scale.setScalar(sc);
            g.position.set(x, FLOOR_Y, NEAR_Z - ((i + 0.5) / PALMS) * SPAN);
            const lean = -side * (0.1 + this._rng() * 0.12);
            g.rotation.z = lean;
            this._group.add(g);
            this._palms.push({ group: g, lean, side, phase: this._rng() * 6.28 });
        }
    }

    // ── Floating statue head ────────────────────────────────────────────────

    _buildHead() {
        const tex = _canvasTex(64, 64, (c, w, h) => {
            const g = c.createLinearGradient(0, 0, w, h);
            g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c9b4f0');
            c.fillStyle = g; c.fillRect(0, 0, w, h);
        });
        const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
        const dark = new THREE.MeshBasicMaterial({ color: '#6b3fa8', toneMapped: false });
        const headGeo = new THREE.SphereGeometry(0.9, 20, 14);
        const noseGeo = new THREE.ConeGeometry(0.12, 0.5, 6);
        const eyeGeo = new THREE.SphereGeometry(0.13, 8, 6);
        const neckGeo = new THREE.CylinderGeometry(0.4, 0.55, 0.8, 10);
        this._disposables.push(tex, mat, dark, headGeo, noseGeo, eyeGeo, neckGeo);

        const g = new THREE.Group();
        const head = new THREE.Mesh(headGeo, mat); head.scale.set(0.85, 1.1, 0.9);
        const nose = new THREE.Mesh(noseGeo, mat); nose.rotation.x = Math.PI / 2; nose.position.set(0, -0.05, 0.9);
        const eyeL = new THREE.Mesh(eyeGeo, dark); eyeL.position.set(-0.3, 0.2, 0.7); eyeL.scale.z = 0.4;
        const eyeR = eyeL.clone(); eyeR.position.x = 0.3;
        const neck = new THREE.Mesh(neckGeo, mat); neck.position.y = -1.1;
        g.add(head, nose, eyeL, eyeR, neck);
        const baseY = 2.4;
        g.position.set(-6.5, baseY, -9);
        g.rotation.y = 0.5;
        this._group.add(g);
        this._head = { group: g, mat, baseY };
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
        this._columns = [];
        this._palms = [];
        this._rings = [];
        this._disposables = [];
        this._grid = this._sun = this._head = null;
    }
}

function _canvasTex(w, h, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    draw(canvas.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function _rng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}
