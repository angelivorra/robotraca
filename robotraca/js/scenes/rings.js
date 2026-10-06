import * as THREE from 'three';

// Neon ring tunnel: concentric rings stream toward the camera along z while the
// whole tunnel snakes sinusoidally. Some rings are toothed (instanced blocks) and
// spin. Bass widens + accelerates, each beat sends a brightness wave down the tunnel.
// All procedural, no external assets.
const RING_COUNT = 30;
const SPACING    = 2.4;
const LENGTH     = RING_COUNT * SPACING;   // 90
const Z_NEAR     = 4;                      // ring is recycled once it passes this z
const BASE_R     = 4.8;
const TEETH      = 36;

export class RingsScene {
    get useBloom() { return false; }

    constructor() {
        this._group = null;
        this._rings = [];
        this._glow = null;
        this._disposables = [];
        this._beatFlash = 0;
        this._speedBoost = 0;
        this._time = 0;
        this._waves = [];
        this._rand = _rng(7);
        this._primary = new THREE.Color();
        this._secondary = new THREE.Color();
        this._third = new THREE.Color('#ffe14a');
        this._white = new THREE.Color('#ffffff');
        this._tmp = new THREE.Color();
    }

    init(threeScene, theme) {
        this._group = new THREE.Group();
        threeScene.add(this._group);
        this._primary.set(theme.primaryColor);
        this._secondary.set(theme.secondaryColor);

        threeScene.background = new THREE.Color(theme.bgColor || '#050010');
        threeScene.fog = new THREE.FogExp2(new THREE.Color('#0a0220'), 0.011);

        this._buildBackdrop();
        this._buildRings();
    }

    update(reactive, delta) {
        this._time += delta;
        this._beatFlash  *= Math.pow(0.84, delta * 60);
        this._speedBoost *= Math.pow(0.95, delta * 60);

        const bass = reactive.bassEnergy, highs = reactive.highsEnergy;
        const speed = (9 + bass * 22 + this._speedBoost * 26) * delta;
        const t = this._time;

        // Beat waves travel from near (0) to far (1).
        for (let i = this._waves.length - 1; i >= 0; i--) {
            this._waves[i] += delta * 1.1;
            if (this._waves[i] > 1.3) this._waves.splice(i, 1);
        }

        for (const r of this._rings) {
            r.z -= speed;
            if (r.z < Z_NEAR - LENGTH) r.z += LENGTH;
            const d = (Z_NEAR - r.z) / LENGTH;            // 0 near, 1 far

            // Snaking: amplitude fades toward the camera so the near rings stay centred.
            const k = THREE.MathUtils.smoothstep(d, 0.05, 0.4);
            const x = Math.sin(r.z * 0.07 + t * 0.7) * 1.3 * k;
            const y = Math.cos(r.z * 0.055 + t * 0.5) * 0.9 * k;
            r.mesh.position.set(x, y, r.z);

            let wave = 0;
            for (const w of this._waves) wave = Math.max(wave, 1 - Math.abs(d - w) * 9);
            wave = Math.max(0, wave);

            const s = BASE_R * (1 + bass * 0.16 + wave * 0.06 + this._beatFlash * 0.03);
            r.mesh.scale.setScalar(s);
            if (r.spin) r.mesh.rotation.z += r.spin * delta * (1 + bass * 2);

            const glow = Math.min(1, wave * 0.9 + this._beatFlash * 0.25 + bass * 0.2 + highs * (r.teeth ? 0.2 : 0));
            r.mat.color.copy(r.color).multiplyScalar(0.7 + bass * 0.3).lerp(this._white, glow * 0.7);
        }

        const g = 1 + bass * 0.25 + this._beatFlash * 0.2;
        this._glow.scale.setScalar(26 * g);
        this._glow.material.opacity = 0.8 + this._beatFlash * 0.2;
    }

    _buildBackdrop() {
        const bgTex = _canvasTex(8, 256, (c, w, h) => {
            const g = c.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#02000a');
            g.addColorStop(0.5, '#12033a');
            g.addColorStop(1, '#02000a');
            c.fillStyle = g; c.fillRect(0, 0, w, h);
        });
        const bgMat = new THREE.MeshBasicMaterial({ map: bgTex, fog: false, toneMapped: false });
        const bgGeo = new THREE.PlaneGeometry(300, 180);
        const bg = new THREE.Mesh(bgGeo, bgMat);
        bg.position.z = -95;
        this._group.add(bg);

        const glowTex = _canvasTex(256, 256, (c, w, h) => {
            const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
            g.addColorStop(0.00, 'rgba(255,255,255,1)');
            g.addColorStop(0.08, 'rgba(255,230,255,0.95)');
            g.addColorStop(0.25, 'rgba(255,80,200,0.5)');
            g.addColorStop(0.55, 'rgba(60,200,255,0.18)');
            g.addColorStop(1.00, 'rgba(0,0,0,0)');
            c.fillStyle = g; c.fillRect(0, 0, w, h);
        });
        const glowMat = new THREE.MeshBasicMaterial({
            map: glowTex, transparent: true, blending: THREE.AdditiveBlending,
            depthWrite: false, fog: false, toneMapped: false,
        });
        const glowGeo = new THREE.PlaneGeometry(1, 1);
        this._glow = new THREE.Mesh(glowGeo, glowMat);
        this._glow.position.z = -80;
        this._glow.scale.setScalar(26);
        this._group.add(this._glow);

        this._disposables.push(bgTex, bgMat, bgGeo, glowTex, glowMat, glowGeo);
    }

    _buildRings() {
        const smooth = new THREE.TorusGeometry(1, 0.026, 6, 96);
        const thick  = new THREE.TorusGeometry(1, 0.042, 6, 96);
        const tooth  = new THREE.BoxGeometry(0.075, 0.05, 0.05);
        this._disposables.push(smooth, thick, tooth);
        const palette = [this._primary, this._secondary, this._third];
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3();
        const one = new THREE.Vector3(1, 1, 1);

        for (let i = 0; i < RING_COUNT; i++) {
            const color = palette[i % 3];
            const mat = new THREE.MeshBasicMaterial({ color: color.clone(), toneMapped: false });
            this._disposables.push(mat);
            const teeth = i % 4 === 1 || i % 7 === 3;
            let mesh;
            if (teeth) {
                mesh = new THREE.InstancedMesh(tooth, mat, TEETH);
                for (let j = 0; j < TEETH; j++) {
                    const a = (j / TEETH) * Math.PI * 2;
                    p.set(Math.cos(a), Math.sin(a), 0);
                    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a + Math.PI / 2);
                    m.compose(p, q, one);
                    mesh.setMatrixAt(j, m);
                }
                mesh.instanceMatrix.needsUpdate = true;
                mesh.frustumCulled = false;
            } else {
                mesh = new THREE.Mesh(i % 3 === 0 ? thick : smooth, mat);
            }
            const spinDir = this._rand() < 0.5 ? -1 : 1;
            const spin = teeth ? spinDir * (0.3 + this._rand() * 0.9) : (i % 5 === 0 ? spinDir * 0.2 : 0);
            mesh.rotation.z = this._rand() * 6.28;
            this._group.add(mesh);
            this._rings.push({ mesh, mat, color: color.clone(), z: Z_NEAR - i * SPACING, teeth, spin });
        }
    }

    onBeat() {
        this._beatFlash = 1.0;
        this._waves.push(0);
        if (this._waves.length > 4) this._waves.shift();
    }
    onTap() { this._beatFlash = 1.5; this._waves.push(0); if (this._waves.length > 4) this._waves.shift(); }
    onSwipe(dir) {
        if (dir === 'up')   this._speedBoost += 0.8;
        if (dir === 'down') this._speedBoost = Math.max(0, this._speedBoost - 0.3);
    }

    dispose() {
        for (const d of this._disposables) d.dispose();
        for (const r of this._rings) r.mesh.dispose?.();
        this._group?.parent?.remove(this._group);
        this._group = null;
        this._rings = [];
        this._disposables = [];
        this._glow = null;
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
