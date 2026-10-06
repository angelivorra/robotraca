import * as THREE from 'three';

// Hyperspace jump: radial star streaks (one LineSegments buffer, recycled),
// slow additive magenta/cyan nebula planes and thin energy rings expanding
// from the centre. Beat = speed pull + colour flash. Fully procedural.
const STAR_COUNT = 1800;
const Z_FAR = -90, Z_NEAR = 4.5;
const R_MIN = 0.7, R_MAX = 16;
const RING_COUNT = 6;

export class WarpScene {
    get useBloom() { return false; }

    constructor() {
        this._group = null;
        this._disposables = [];
        this._stars = null;
        this._nebulae = [];
        this._rings = [];
        this._beatFlash = 0;
        this._pull = 0;
        this._speedMul = 1;
        this._time = 0;
        this._flash = null;
    }

    init(threeScene, theme) {
        this._group = new THREE.Group();
        threeScene.add(this._group);
        threeScene.background = new THREE.Color(theme.bgColor);
        this._primary = new THREE.Color(theme.primaryColor || '#ff2a9d');
        this._secondary = new THREE.Color(theme.secondaryColor || '#27f5ff');
        const rand = _rng(1337);
        this._buildNebula();
        this._buildStars(rand);
        this._buildRings();
    }

    _track(o) { this._disposables.push(o); return o; }

    _buildNebula() {
        const defs = [
            { col: this._primary,   x: -14, y:  6, s: 150, rot:  0.010, o: 0.38 },
            { col: this._secondary, x:  16, y: -7, s: 150, rot: -0.013, o: 0.34 },
            { col: new THREE.Color('#8a2bff'), x: 0, y: 0, s: 220, rot: 0.006, o: 0.25 },
            { col: this._primary,   x:  20, y: 12, s: 60, rot: -0.02, o: 0.3 },
            { col: this._secondary, x: -22, y: -12, s: 60, rot: 0.018, o: 0.3 },
        ];
        defs.forEach((d, i) => {
            const tex = this._track(_canvasTex(256, 256, (c, w, h) => {
                c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
                const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
                g.addColorStop(0, 'rgba(255,255,255,0.9)');
                g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
                g.addColorStop(1, 'rgba(0,0,0,1)');
                c.fillStyle = g; c.fillRect(0, 0, w, h);
                // cloudy blobs
                c.globalCompositeOperation = 'lighter';
                const r = _rng(40 + i);
                for (let k = 0; k < 26; k++) {
                    const bx = w * (0.2 + r() * 0.6), by = h * (0.2 + r() * 0.6), br = 14 + r() * 40;
                    const bg = c.createRadialGradient(bx, by, 0, bx, by, br);
                    bg.addColorStop(0, `rgba(255,255,255,${0.1 + r() * 0.12})`);
                    bg.addColorStop(1, 'rgba(0,0,0,0)');
                    c.fillStyle = bg; c.fillRect(0, 0, w, h);
                }
            }));
            const mat = this._track(new THREE.MeshBasicMaterial({
                map: tex, color: d.col.clone(), blending: THREE.AdditiveBlending,
                transparent: true, depthWrite: false, opacity: d.o, fog: false, toneMapped: false,
            }));
            const mesh = new THREE.Mesh(this._track(new THREE.PlaneGeometry(d.s, d.s)), mat);
            mesh.position.set(d.x, d.y, -70 - i);
            mesh.rotation.z = i * 1.3;
            this._group.add(mesh);
            this._nebulae.push({ mesh, mat, base: d.o, rot: d.rot, ph: i * 1.7 });
        });
    }

    _buildStars(rand) {
        const n = STAR_COUNT;
        this._starData = new Float32Array(n * 4); // x, y, z, speedFactor
        this._starLen = new Float32Array(n);
        const pos = new Float32Array(n * 6);
        const col = new Float32Array(n * 6);
        const palette = [
            new THREE.Color('#ffffff'), new THREE.Color('#ffffff'),
            this._primary.clone().lerp(new THREE.Color('#fff'), 0.3),
            this._secondary.clone().lerp(new THREE.Color('#fff'), 0.3),
        ];
        for (let i = 0; i < n; i++) {
            const a = rand() * Math.PI * 2;
            const r = R_MIN + Math.pow(rand(), 0.8) * (R_MAX - R_MIN);
            const d = this._starData;
            d[i * 4] = Math.cos(a) * r;
            d[i * 4 + 1] = Math.sin(a) * r;
            d[i * 4 + 2] = Z_FAR + rand() * (Z_NEAR - Z_FAR);
            d[i * 4 + 3] = 0.5 + rand() * 1.0;
            const c = palette[(rand() * palette.length) | 0];
            const b = 0.6 + rand() * 0.4;
            col[i * 6] = c.r * b; col[i * 6 + 1] = c.g * b; col[i * 6 + 2] = c.b * b;
            // tail vertex fades to black (additive)
            col[i * 6 + 3] = c.r * 0.05; col[i * 6 + 4] = c.g * 0.05; col[i * 6 + 5] = c.b * 0.05;
        }
        const geo = this._track(new THREE.BufferGeometry());
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const mat = this._track(new THREE.LineBasicMaterial({
            vertexColors: true, blending: THREE.AdditiveBlending, transparent: true,
            depthWrite: false, fog: false, toneMapped: false,
        }));
        this._stars = new THREE.LineSegments(geo, mat);
        this._stars.frustumCulled = false;
        this._group.add(this._stars);
        this._writeStars(0);
    }

    _writeStars(len) {
        const p = this._stars.geometry.attributes.position.array;
        const d = this._starData;
        for (let i = 0; i < STAR_COUNT; i++) {
            const x = d[i * 4], y = d[i * 4 + 1], z = d[i * 4 + 2];
            const l = len * d[i * 4 + 3];
            p[i * 6] = x; p[i * 6 + 1] = y; p[i * 6 + 2] = z;
            p[i * 6 + 3] = x; p[i * 6 + 4] = y; p[i * 6 + 5] = z - l;
        }
        this._stars.geometry.attributes.position.needsUpdate = true;
    }

    _buildRings() {
        const geo = this._track(new THREE.RingGeometry(0.97, 1, 96));
        for (let i = 0; i < RING_COUNT; i++) {
            const mat = this._track(new THREE.MeshBasicMaterial({
                color: (i % 2 ? this._secondary : this._primary).clone(),
                blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
                side: THREE.DoubleSide, fog: false, toneMapped: false,
            }));
            const mesh = new THREE.Mesh(geo, mat);
            this._group.add(mesh);
            this._rings.push({ mesh, mat, t: i / RING_COUNT });
        }
    }

    update(reactive, delta) {
        this._time += delta;
        this._beatFlash *= Math.pow(0.84, delta * 60);
        this._pull *= Math.pow(0.93, delta * 60);
        const bass = reactive.bassEnergy, highs = reactive.highsEnergy || 0;

        const speed = (22 + bass * 50 + this._pull * 120) * this._speedMul;
        const len = 0.8 + speed * 0.09;
        const d = this._starData;
        for (let i = 0; i < STAR_COUNT; i++) {
            let z = d[i * 4 + 2] + speed * d[i * 4 + 3] * delta;
            if (z - len * d[i * 4 + 3] > Z_NEAR) z = Z_FAR + (z - Z_NEAR) % 10;
            if (z > Z_NEAR + 2) z = Z_FAR;
            d[i * 4 + 2] = z;
        }
        this._writeStars(len);
        const sm = this._stars.material;
        sm.opacity = Math.min(1, 0.75 + bass * 0.25 + this._beatFlash * 0.3);

        for (const n of this._nebulae) {
            n.mesh.rotation.z += n.rot * delta * (1 + this._pull * 4);
            n.mat.opacity = n.base * (0.8 + 0.2 * Math.sin(this._time * 0.4 + n.ph))
                + bass * 0.25 + this._beatFlash * 0.35;
        }

        for (const r of this._rings) {
            r.t += delta * (0.12 + bass * 0.25 + this._pull * 0.6) * this._speedMul;
            if (r.t > 1) r.t -= 1;
            const t = r.t;
            // ring travels from far to near; radius grows with perspective
            const z = -60 + t * 62;
            const s = 3 + t * t * 6;
            r.mesh.position.z = z;
            r.mesh.scale.set(s, s, 1);
            const fade = Math.min(1, t * 6) * Math.min(1, (1 - t) * 4);
            r.mat.opacity = fade * (0.45 + bass * 0.4 + this._beatFlash * 0.4 + highs * 0.2);
        }
    }

    onBeat() {
        this._beatFlash = 1;
        this._pull = Math.min(1.5, this._pull + 0.8);
        const swap = this._primary;
        this._primary = this._secondary;
        this._secondary = swap;
        this._rings.forEach((r, i) => r.mat.color.copy(i % 2 ? this._secondary : this._primary));
    }

    onTap()  { this._beatFlash = 1; this._pull = Math.min(2, this._pull + 1.2); }

    onSwipe(dir) {
        if (dir === 'up') this._speedMul = Math.min(3, this._speedMul * 1.4);
        else if (dir === 'down') this._speedMul = Math.max(0.3, this._speedMul / 1.4);
    }

    dispose() {
        for (const d of this._disposables) d.dispose();
        this._group?.parent?.remove(this._group);
        this._group = null;
        this._disposables = [];
        this._nebulae = [];
        this._rings = [];
        this._stars = null;
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
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
