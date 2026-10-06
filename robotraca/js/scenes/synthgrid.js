import * as THREE from 'three';

// Synthwave landscape: a neon grid floor streaming toward the camera, wireframe
// mountains on both sides, a striped sun on the horizon and a starfield. All
// procedural (canvas textures + wireframe heightfields), no external assets.
const FLOOR_Y   = -2.4;
const LENGTH    = 160;
const PERIOD    = 40;          // mountain height pattern repeats every PERIOD units of z
const STAR_COUNT = 260;

export class SynthGridScene {
    get useBloom() { return false; }

    constructor() {
        this._group = null;
        this._grid = null;
        this._ridges = [];
        this._sun = null;
        this._stars = null;
        this._disposables = [];
        this._beatFlash = 0;
        this._speedBoost = 0;
        this._time = 0;
        this._ridgeZ = 0;
        this._primary = new THREE.Color();
        this._secondary = new THREE.Color();
    }

    init(threeScene, theme) {
        this._group = new THREE.Group();
        threeScene.add(this._group);
        this._primary.set(theme.primaryColor);
        this._secondary.set(theme.secondaryColor);

        threeScene.background = new THREE.Color('#0a0018');
        threeScene.fog = new THREE.FogExp2(new THREE.Color('#2a0a4a'), 0.014);

        this._buildSky();
        this._buildGrid();
        this._buildRidges();
    }

    update(reactive, delta) {
        this._time += delta;
        this._beatFlash  *= Math.pow(0.83, delta * 60);
        this._speedBoost *= Math.pow(0.95, delta * 60);

        const bass  = reactive.bassEnergy;
        const speed = (7 + bass * 16 + this._speedBoost * 18) * delta;

        // Grid: scroll the texture; one tile = 8 world units along z.
        this._grid.tex.offset.y += speed / 8;
        this._grid.mat.color.setScalar(0.75 + bass * 0.6 + this._beatFlash * 0.6);

        // Mountains: slide the whole strip and wrap by one pattern period.
        this._ridgeZ = (this._ridgeZ + speed) % PERIOD;
        for (const r of this._ridges) {
            r.mesh.position.z = r.baseZ + this._ridgeZ;
            r.mat.color.copy(this._secondary).lerp(this._primary, Math.min(1, bass * 1.2 + this._beatFlash * 0.6));
            r.mat.opacity = 0.55 + bass * 0.35 + this._beatFlash * 0.1;
        }

        const s = 1 + bass * 0.05 + this._beatFlash * 0.05;
        this._sun.scale.set(s, s, 1);
        this._stars.material.opacity = 0.5 + reactive.highsEnergy * 0.5;
        this._stars.rotation.z += delta * 0.004;
    }

    // ── Sky, sun, stars ─────────────────────────────────────────────────────

    _buildSky() {
        const skyTex = _canvasTex(8, 512, (c, w, h) => {
            const g = c.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0.00, '#04000c');
            g.addColorStop(0.50, '#1b0540');
            g.addColorStop(0.80, '#7a1478');
            g.addColorStop(0.95, '#ff4f90');
            g.addColorStop(1.00, '#ffb066');
            c.fillStyle = g; c.fillRect(0, 0, w, h);
        });
        const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, fog: false, toneMapped: false });
        const sky = new THREE.Mesh(new THREE.PlaneGeometry(440, 190), skyMat);
        sky.position.set(0, 24, -88);
        this._group.add(sky);

        const sunTex = _canvasTex(512, 512, (c, w, h) => {
            const g = c.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#fff06a');
            g.addColorStop(0.5, '#ff5aa5');
            g.addColorStop(1, '#a01a9c');
            c.fillStyle = g;
            c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2); c.fill();
            c.globalCompositeOperation = 'destination-out';
            for (let i = 0; i < 9; i++) {
                c.fillRect(0, h * 0.48 + i * h * 0.05 + i * i * 1.8, w, 3 + i * 2.2);
            }
        });
        const sunMat = new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false, toneMapped: false });
        this._sun = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), sunMat);
        this._sun.position.set(0, FLOOR_Y + 14, -84);
        this._group.add(this._sun);

        // Stars: random points in the upper sky.
        const pos = new Float32Array(STAR_COUNT * 3);
        for (let i = 0; i < STAR_COUNT; i++) {
            pos[i * 3]     = (Math.random() * 2 - 1) * 150;
            pos[i * 3 + 1] = 8 + Math.random() * 60;
            pos[i * 3 + 2] = -90;
        }
        const starGeo = new THREE.BufferGeometry();
        starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const starMat = new THREE.PointsMaterial({
            color: '#ffffff', size: 1.4, sizeAttenuation: false,
            transparent: true, opacity: 0.7, fog: false, toneMapped: false,
        });
        this._stars = new THREE.Points(starGeo, starMat);
        this._stars.position.z = 0;
        this._group.add(this._stars);

        this._disposables.push(skyTex, skyMat, sky.geometry, sunTex, sunMat, this._sun.geometry, starGeo, starMat);
    }

    // ── Neon grid floor ─────────────────────────────────────────────────────

    _buildGrid() {
        const tex = _canvasTex(256, 256, (c, w, h) => {
            c.fillStyle = '#12002a'; c.fillRect(0, 0, w, h);
            c.strokeStyle = '#ff2fa8'; c.lineWidth = 4;
            c.shadowColor = '#ff2fa8'; c.shadowBlur = 10;
            c.strokeRect(2, 2, w - 4, h - 4);
        });
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = 8;
        const width = 120;
        tex.repeat.set(width / 8, LENGTH / 8);
        const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, LENGTH), mat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, FLOOR_Y, -LENGTH / 2 + 12);
        this._group.add(floor);
        this._grid = { tex, mat };
        this._disposables.push(tex, mat, floor.geometry);
    }

    // ── Wireframe mountains ─────────────────────────────────────────────────

    _buildRidges() {
        for (const side of [-1, 1]) {
            const geo = new THREE.PlaneGeometry(36, LENGTH * 2, 18, 80);
            geo.rotateX(-Math.PI / 2);
            const p = geo.attributes.position;
            for (let i = 0; i < p.count; i++) {
                const x = p.getX(i), z = p.getZ(i);
                // Height grows away from the road; the z pattern is periodic in PERIOD.
                const away = Math.max(0, (x * side + 18) / 36);        // 0 at the road edge, 1 outside
                const k = 2 * Math.PI / PERIOD;
                const n = Math.sin(z * k + x * 0.35) * 0.5
                        + Math.sin(z * k * 2 + 1.7 + x * 0.6) * 0.3
                        + Math.sin(z * k * 3 + 4.1) * 0.2;
                const h = Math.max(0, 0.35 + n * 0.6) * away * away * 14;
                p.setY(i, h);
            }
            const mat = new THREE.MeshBasicMaterial({
                color: this._secondary, wireframe: true, transparent: true, opacity: 0.6, toneMapped: false,
            });
            const mesh = new THREE.Mesh(geo, mat);
            const baseZ = -LENGTH + 12;
            mesh.position.set(side * (12 + 18), FLOOR_Y, baseZ);
            this._group.add(mesh);
            this._ridges.push({ mesh, mat, baseZ });
            this._disposables.push(geo, mat);
        }
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
        this._ridges = [];
        this._disposables = [];
        this._grid = this._sun = this._stars = null;
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
