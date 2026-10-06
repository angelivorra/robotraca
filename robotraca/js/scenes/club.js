import * as THREE from 'three';

// Retro cyberpunk club: a giant neon equalizer wall (32 bars of LED segments,
// bass on the left, mids in the centre, highs on the right, with falling peak
// caps), additive laser fans sweeping behind/around the centre, a checkered
// dance floor whose tiles light up, drifting smoke and two stage spotlights.
// Everything is procedural.
const FLOOR_Y  = -2.4;
const WALL_Z   = -10.5;
const BAR_Z    = -9.6;
const BAR_N    = 32;
const SEG_N    = 16;
const SEG_H    = 0.4;
const SEG_PITCH = 0.5;
const BAR_PITCH = 0.78;
const BAR_W    = 0.58;

const LASER_N  = 10;
const LASER_LEN = 40;

const FLOOR_W = 36, FLOOR_D = 14;
const CELL = 2;
const COLS = FLOOR_W / CELL, ROWS = FLOOR_D / CELL;
const CELL_PX = 24;

const PALETTE = ['#ff2a9d', '#27f5ff', '#ffe14d', '#b05cff', '#ff6a3d'];

export class ClubScene {
    get useBloom() { return false; }

    constructor() {
        this._group = null;
        this._disposables = [];
        this._beatFlash = 0;
        this._beatCount = 0;
        this._time = 0;
        this._sweepBoost = 0;
        this._sweepDir = 1;
        this._spread = 0;
        this._levels = new Float32Array(BAR_N);
        this._peaks = new Float32Array(BAR_N);
        this._peakHold = new Float32Array(BAR_N);
        this._lasers = [];
        this._smoke = [];
        this._spots = [];
        this._bars = null;
        this._peakMesh = null;
        this._barMat = null;
        this._floorOverlay = null;
        this._floorStepTimer = 0;
        this._floorStep = 0;
        this._dummy = new THREE.Object3D();
    }

    init(threeScene, theme) {
        this._group = new THREE.Group();
        threeScene.add(this._group);
        threeScene.background = new THREE.Color(theme.bgColor);
        threeScene.fog = null;

        this._theme = theme;
        this._rand = _rng(11);
        this._buildWall();
        this._buildBars();
        this._buildFloor();
        this._buildSmoke();
        this._buildLasers();
        this._buildSpots();
        this._drawFloorOverlay();
    }

    update(reactive, delta) {
        this._time += delta;
        this._beatFlash *= Math.pow(0.84, delta * 60);
        this._sweepBoost *= Math.pow(0.97, delta * 60);
        this._spread *= Math.pow(0.97, delta * 60);

        const bass = reactive.bassEnergy, mids = reactive.midsEnergy, highs = reactive.highsEnergy;

        this._updateBars(bass, mids, highs, delta);
        this._updateLasers(bass, delta);
        this._updateSpots(delta);
        this._updateSmoke(bass, delta);
        this._updateFloor(bass, delta);
    }

    // ── Back wall ────────────────────────────────────────────────────────────

    _buildWall() {
        const bg = new THREE.Color(this._theme.bgColor);
        const tex = _canvasTex(8, 256, (c, w, h) => {
            const g = c.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0.0, '#07001a');
            g.addColorStop(0.55, '#1a0638');
            g.addColorStop(0.8, '#3a0a52');
            g.addColorStop(1.0, '#12031e');
            c.fillStyle = g; c.fillRect(0, 0, w, h);
        });
        const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(70, 40), mat);
        mesh.position.set(0, FLOOR_Y + 14, WALL_Z);
        this._group.add(mesh);
        this._disposables.push(tex, mat, mesh.geometry);
        void bg;

        // Magenta/cyan glow behind the equalizer.
        const glow = _canvasTex(256, 128, (c, w, h) => {
            const g = c.createRadialGradient(w / 2, h * 0.75, 0, w / 2, h * 0.75, w / 2);
            g.addColorStop(0, 'rgba(255,255,255,0.9)');
            g.addColorStop(0.5, 'rgba(255,255,255,0.3)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = g; c.fillRect(0, 0, w, h);
        });
        const gm = new THREE.MeshBasicMaterial({
            map: glow, color: new THREE.Color('#c0188f'), transparent: true, opacity: 0.55,
            blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        });
        const gmesh = new THREE.Mesh(new THREE.PlaneGeometry(44, 18), gm);
        gmesh.position.set(0, FLOOR_Y + 5, WALL_Z + 0.2);
        this._group.add(gmesh);
        this._wallGlow = gm;
        this._disposables.push(glow, gm, gmesh.geometry);

        // Floor-line neon strip under the bars.
        const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#27f5ff'), toneMapped: false });
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(BAR_N * BAR_PITCH + 1.2, 0.12), stripMat);
        strip.position.set(0, FLOOR_Y + 0.0, BAR_Z + 0.05);
        this._group.add(strip);
        this._disposables.push(stripMat, strip.geometry);
        this._strip = stripMat;
    }

    // ── Equalizer ────────────────────────────────────────────────────────────

    _buildBars() {
        const total = BAR_N * SEG_N;
        const geo = new THREE.PlaneGeometry(1, 1);
        this._disposables.push(geo);

        // Unlit backdrop segments (gives the panel structure when bars are low).
        const dimMat = new THREE.MeshBasicMaterial({ toneMapped: false });
        const dim = new THREE.InstancedMesh(geo, dimMat, total);
        // Lit segments.
        const litMat = new THREE.MeshBasicMaterial({ toneMapped: false });
        const lit = new THREE.InstancedMesh(geo, litMat, total);
        lit.frustumCulled = false;
        dim.frustumCulled = false;

        const cyan = new THREE.Color('#27f5ff'), mag = new THREE.Color('#ff2a9d'), yel = new THREE.Color('#ffe14d');
        const col = new THREE.Color();
        const d = this._dummy;
        const x0 = -(BAR_N - 1) * BAR_PITCH / 2;
        for (let i = 0; i < BAR_N; i++) {
            for (let s = 0; s < SEG_N; s++) {
                const idx = i * SEG_N + s;
                const f = s / (SEG_N - 1);
                if (f < 0.6) col.copy(cyan).lerp(mag, f / 0.6);
                else col.copy(mag).lerp(yel, (f - 0.6) / 0.4);
                lit.setColorAt(idx, col);
                dim.setColorAt(idx, col.clone().multiplyScalar(0.08));
                d.position.set(x0 + i * BAR_PITCH, FLOOR_Y + 0.05 + s * SEG_PITCH + SEG_H / 2, BAR_Z);
                d.scale.set(BAR_W, SEG_H, 1);
                d.updateMatrix();
                dim.setMatrixAt(idx, d.matrix);
                lit.setMatrixAt(idx, d.matrix);
            }
        }
        dim.instanceMatrix.needsUpdate = true;
        dim.instanceColor.needsUpdate = true;
        lit.instanceColor.needsUpdate = true;
        lit.position.z = 0.02;
        this._group.add(dim, lit);
        this._bars = lit;
        this._barMat = litMat;
        this._disposables.push(dimMat, litMat, dim, lit);

        // Peak caps.
        const pMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4b0'), toneMapped: false });
        const peaks = new THREE.InstancedMesh(geo, pMat, BAR_N);
        peaks.frustumCulled = false;
        peaks.position.z = 0.04;
        this._group.add(peaks);
        this._peakMesh = peaks;
        this._disposables.push(pMat, peaks);
    }

    _updateBars(bass, mids, highs, delta) {
        const t = this._time;
        const up = 1 - Math.exp(-delta * 22);
        const down = 1 - Math.exp(-delta * 7);
        const d = this._dummy;
        const x0 = -(BAR_N - 1) * BAR_PITCH / 2;
        const lit = this._bars;

        for (let i = 0; i < BAR_N; i++) {
            const u = i / (BAR_N - 1);
            const wb = Math.max(0, 1 - u * 2.2);
            const wh = Math.max(0, u * 2.2 - 1.2);
            const wm = Math.max(0, 1 - Math.abs(u - 0.5) * 2.2);
            const ws = (wb + wm + wh) || 1;
            const e = (bass * wb + mids * wm + highs * wh) / ws;
            const wob = 0.5 + 0.5 * Math.sin(t * (3 + (i % 5) * 0.9) + i * 1.7);
            const wob2 = 0.5 + 0.5 * Math.sin(t * 7.3 + i * 0.63);
            let target = e * (0.75 + 0.45 * wob) + 0.1 * wob2 * (0.4 + e) + this._beatFlash * 0.12;
            target = Math.min(1, Math.max(0.06, target * 1.0));

            const l = this._levels[i];
            this._levels[i] = l + (target - l) * (target > l ? up : down);

            if (this._levels[i] >= this._peaks[i]) {
                this._peaks[i] = this._levels[i];
                this._peakHold[i] = 0.25;
            } else if (this._peakHold[i] > 0) {
                this._peakHold[i] -= delta;
            } else {
                this._peaks[i] = Math.max(this._levels[i], this._peaks[i] - delta * 0.3);
            }

            const n = Math.ceil(this._levels[i] * SEG_N - 0.001);
            const base = i * SEG_N;
            for (let s = 0; s < SEG_N; s++) {
                d.position.set(x0 + i * BAR_PITCH, FLOOR_Y + 0.05 + s * SEG_PITCH + SEG_H / 2, BAR_Z);
                d.scale.set(s < n ? BAR_W : 0, s < n ? SEG_H : 0, 1);
                d.updateMatrix();
                lit.setMatrixAt(base + s, d.matrix);
            }

            const ps = Math.min(SEG_N - 1, Math.max(0, Math.ceil(this._peaks[i] * SEG_N) - 1));
            d.position.set(x0 + i * BAR_PITCH, FLOOR_Y + 0.05 + ps * SEG_PITCH + SEG_H / 2, BAR_Z);
            d.scale.set(BAR_W, SEG_H * 0.6, 1);
            d.updateMatrix();
            this._peakMesh.setMatrixAt(i, d.matrix);
        }
        lit.instanceMatrix.needsUpdate = true;
        this._peakMesh.instanceMatrix.needsUpdate = true;

        const b = 0.85 + this._beatFlash * 0.15;
        this._barMat.color.setScalar(b);
        this._wallGlow.opacity = 0.4 + bass * 0.4 + this._beatFlash * 0.2;
        this._strip.color.set(PALETTE[this._beatCount % 3 === 0 ? 1 : 0]).multiplyScalar(0.7 + this._beatFlash * 0.3);
    }

    // ── Lasers ───────────────────────────────────────────────────────────────

    _buildLasers() {
        const beamTex = _canvasTex(32, 8, (c, w, h) => {
            const g = c.createLinearGradient(0, 0, w, 0);
            g.addColorStop(0, 'rgba(255,255,255,0)');
            g.addColorStop(0.42, 'rgba(255,255,255,0.7)');
            g.addColorStop(0.5, 'rgba(255,255,255,1)');
            g.addColorStop(0.58, 'rgba(255,255,255,0.7)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = g; c.fillRect(0, 0, w, h);
        });
        this._disposables.push(beamTex);
        const geo = new THREE.PlaneGeometry(1, LASER_LEN);
        geo.translate(0, -LASER_LEN / 2, 0);
        this._disposables.push(geo);

        const defs = [];
        // Ceiling emitters (pointing down, fanning), then side emitters.
        const xs = [-10, -6, -2.5, 2.5, 6, 10];
        for (let i = 0; i < xs.length; i++) defs.push({ x: xs[i], y: 8, z: -8 + (i % 2) * 3, base: 0, amp: 0.75 });
        defs.push({ x: -14, y: 3, z: -7, base: Math.PI / 2 - 0.35, amp: 0.4 });
        defs.push({ x: 14,  y: 3, z: -7, base: -Math.PI / 2 + 0.35, amp: 0.4 });
        defs.push({ x: -13, y: 7, z: -5, base: 0.5, amp: 0.45 });
        defs.push({ x: 13,  y: 7, z: -5, base: -0.5, amp: 0.45 });

        for (let i = 0; i < LASER_N; i++) {
            const dd = defs[i];
            const mat = new THREE.MeshBasicMaterial({
                map: beamTex, color: new THREE.Color(PALETTE[i % PALETTE.length]), transparent: true,
                opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
            });
            const mesh = new THREE.Mesh(geo, mat);
            const width = 0.16 + (i % 3) * 0.04;
            mesh.scale.x = width;
            mesh.position.set(dd.x, dd.y, dd.z);
            this._group.add(mesh);
            this._lasers.push({
                mesh, mat, base: dd.base, amp: dd.amp,
                speed: 0.6 + (i % 4) * 0.25, phase: i * 1.3,
                color: new THREE.Color(PALETTE[i % PALETTE.length]),
                target: new THREE.Color(PALETTE[i % PALETTE.length]),
            });
            this._disposables.push(mat);
        }
    }

    _updateLasers(bass, delta) {
        const t = this._time;
        const k = 1 - Math.exp(-delta * 10);
        const mult = 1 + this._sweepBoost * 2.5;
        for (let i = 0; i < this._lasers.length; i++) {
            const l = this._lasers[i];
            const dir = (i % 2 === 0 ? 1 : -1) * this._sweepDir;
            const a = Math.sin(t * l.speed * mult + l.phase) * (l.amp + this._spread * 0.3)
                + Math.sin(t * l.speed * 0.37 + l.phase * 2) * 0.12;
            l.mesh.rotation.z = l.base + a * dir;
            l.target.set(PALETTE[(this._beatCount + i) % PALETTE.length]);
            l.color.lerp(l.target, k);
            l.mat.color.copy(l.color);
            l.mat.opacity = 0.5 + bass * 0.3 + this._beatFlash * 0.25;
        }
    }

    // ── Smoke ────────────────────────────────────────────────────────────────

    _buildSmoke() {
        const tex = _canvasTex(128, 128, (c, w, h) => {
            const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
            g.addColorStop(0, 'rgba(255,255,255,0.8)');
            g.addColorStop(0.5, 'rgba(255,255,255,0.3)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = g; c.fillRect(0, 0, w, h);
        });
        this._disposables.push(tex);
        const cols = ['#ff2a9d', '#27f5ff', '#b05cff', '#ff2a9d', '#27f5ff', '#ffe14d'];
        const rand = this._rand;
        for (let i = 0; i < cols.length; i++) {
            const mat = new THREE.MeshBasicMaterial({
                map: tex, color: new THREE.Color(cols[i]), transparent: true, opacity: 0.04,
                blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
            });
            const w = 14 + rand() * 8, h = 5 + rand() * 3;
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
            const z = -8 + i * 1.3;
            mesh.position.set((rand() * 2 - 1) * 8, FLOOR_Y + 0.4 + rand() * 1.6, z);
            this._group.add(mesh);
            this._smoke.push({
                mesh, mat, vx: (0.15 + rand() * 0.25) * (i % 2 ? 1 : -1),
                phase: rand() * 10, baseY: mesh.position.y, wrap: 18 + w / 2,
            });
            this._disposables.push(mat, mesh.geometry);
        }
    }

    _updateSmoke(bass, delta) {
        for (const s of this._smoke) {
            s.mesh.position.x += s.vx * delta;
            if (s.mesh.position.x > s.wrap) s.mesh.position.x = -s.wrap;
            if (s.mesh.position.x < -s.wrap) s.mesh.position.x = s.wrap;
            s.mesh.position.y = s.baseY + Math.sin(this._time * 0.3 + s.phase) * 0.5;
            s.mat.opacity = 0.035 + bass * 0.03 + this._beatFlash * 0.02;
        }
    }

    // ── Spotlights ───────────────────────────────────────────────────────────

    _buildSpots() {
        const coneTex = _canvasTex(64, 128, (c, w, h) => {
            const g = c.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, 'rgba(255,255,255,0.9)');
            g.addColorStop(1, 'rgba(255,255,255,0.05)');
            c.fillStyle = g;
            c.beginPath();
            c.moveTo(w * 0.47, 0); c.lineTo(w * 0.53, 0); c.lineTo(w, h); c.lineTo(0, h);
            c.closePath(); c.fill();
            // soften the edges horizontally
            c.globalCompositeOperation = 'destination-in';
            const e = c.createLinearGradient(0, 0, w, 0);
            e.addColorStop(0, 'rgba(255,255,255,0)');
            e.addColorStop(0.5, 'rgba(255,255,255,1)');
            e.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = e; c.fillRect(0, 0, w, h);
        });
        const poolTex = _canvasTex(64, 64, (c, w, h) => {
            const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
            g.addColorStop(0, 'rgba(255,255,255,0.9)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = g; c.fillRect(0, 0, w, h);
        });
        this._disposables.push(coneTex, poolTex);
        const len = 13;
        const geo = new THREE.PlaneGeometry(3.4, len);
        geo.translate(0, -len / 2, 0);
        this._disposables.push(geo);

        const defs = [
            { x: -6.5, color: '#ffe14d', phase: 0 },
            { x: 6.5,  color: '#ff2a9d', phase: 2 },
        ];
        for (const dd of defs) {
            const mat = new THREE.MeshBasicMaterial({
                map: coneTex, color: new THREE.Color(dd.color), transparent: true, opacity: 0.14,
                blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
            });
            const cone = new THREE.Mesh(geo, mat);
            cone.position.set(dd.x, 8, -6);
            this._group.add(cone);

            const pMat = new THREE.MeshBasicMaterial({
                map: poolTex, color: new THREE.Color(dd.color), transparent: true, opacity: 0.4,
                blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
            });
            const pool = new THREE.Mesh(new THREE.PlaneGeometry(5, 3), pMat);
            pool.rotation.x = -Math.PI / 2;
            pool.position.y = FLOOR_Y + 0.03;
            this._group.add(pool);
            this._spots.push({ cone, mat, pool, pMat, x: dd.x, phase: dd.phase, len });
            this._disposables.push(mat, pMat, pool.geometry);
        }
    }

    _updateSpots(delta) {
        for (const s of this._spots) {
            const sign = s.x < 0 ? 1 : -1;
            const ang = sign * 0.3 + Math.sin(this._time * 0.7 + s.phase) * 0.18;
            s.cone.rotation.z = ang;
            // End of the beam at floor level.
            const drop = s.cone.position.y - FLOOR_Y;
            const px = s.x + Math.tan(-ang) * -drop * -1;
            s.pool.position.x = s.x - Math.tan(ang) * drop;
            s.pool.position.z = -6;
            void px;
            const o = 0.12 + this._beatFlash * 0.15;
            s.mat.opacity = o;
            s.pMat.opacity = 0.3 + this._beatFlash * 0.4;
        }
    }

    // ── Dance floor ──────────────────────────────────────────────────────────

    _buildFloor() {
        const baseTex = _canvasTex(COLS * CELL_PX, ROWS * CELL_PX, (c, w, h) => {
            for (let y = 0; y < ROWS; y++) {
                for (let x = 0; x < COLS; x++) {
                    const dark = (x + y) % 2 === 0;
                    c.fillStyle = dark ? '#0a0418' : '#16072c';
                    c.fillRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX);
                }
            }
            c.strokeStyle = 'rgba(176,92,255,0.7)';
            c.lineWidth = 2;
            for (let x = 0; x <= COLS; x++) { c.beginPath(); c.moveTo(x * CELL_PX, 0); c.lineTo(x * CELL_PX, h); c.stroke(); }
            for (let y = 0; y <= ROWS; y++) { c.beginPath(); c.moveTo(0, y * CELL_PX); c.lineTo(w, y * CELL_PX); c.stroke(); }
        });
        baseTex.anisotropy = 4;
        const baseMat = new THREE.MeshBasicMaterial({ map: baseTex, toneMapped: false });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_W, FLOOR_D), baseMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, FLOOR_Y, WALL_Z + FLOOR_D / 2);
        this._group.add(floor);
        this._disposables.push(baseTex, baseMat, floor.geometry);

        // Lit tiles overlay (canvas redrawn on a timer / beat).
        const canvas = document.createElement('canvas');
        canvas.width = COLS * CELL_PX; canvas.height = ROWS * CELL_PX;
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        const mat = new THREE.MeshBasicMaterial({
            map: tex, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending,
            depthWrite: false, toneMapped: false,
        });
        const over = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_W, FLOOR_D), mat);
        over.rotation.x = -Math.PI / 2;
        over.position.set(0, FLOOR_Y + 0.01, WALL_Z + FLOOR_D / 2);
        this._group.add(over);
        this._floorOverlay = { canvas, ctx: canvas.getContext('2d'), tex, mat };
        this._disposables.push(tex, mat, over.geometry);
    }

    _drawFloorOverlay() {
        const { ctx, canvas, tex } = this._floorOverlay;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const st = this._floorStep;
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const v = Math.sin(x * 1.3 + st * 0.9) + Math.sin(y * 1.9 - st * 0.7) + Math.sin((x + y) * 0.8 + st * 1.1);
                if (v > 0.55) {
                    ctx.fillStyle = PALETTE[(x + y * 3 + st) % 4 < 0 ? 0 : ((x + y * 3 + st) % 4 + 4) % 4];
                    ctx.globalAlpha = 0.5 + 0.5 * Math.min(1, (v - 0.55) / 1.2);
                    ctx.fillRect(x * CELL_PX + 1, y * CELL_PX + 1, CELL_PX - 2, CELL_PX - 2);
                }
            }
        }
        ctx.globalAlpha = 1;
        tex.needsUpdate = true;
    }

    _updateFloor(bass, delta) {
        this._floorStepTimer += delta;
        if (this._floorStepTimer > 0.45) {
            this._floorStepTimer = 0;
            this._floorStep++;
            this._drawFloorOverlay();
        }
        this._floorOverlay.mat.opacity = Math.min(1, 0.45 + bass * 0.25 + this._beatFlash * 0.3);
    }

    // ── Interaction ──────────────────────────────────────────────────────────

    onBeat() {
        this._beatFlash = 1.0;
        this._beatCount++;
        if (this._beatCount % 2 === 0 && this._floorOverlay) {
            this._floorStep++;
            this._floorStepTimer = 0;
            this._drawFloorOverlay();
        }
    }

    onTap() {
        this._beatFlash = 1.4;
        this._beatCount++;
        this._spread = 1;
    }

    onSwipe(dir) {
        if (dir === 'left')  this._sweepDir = -1;
        if (dir === 'right') this._sweepDir = 1;
        if (dir === 'up')    { this._sweepBoost += 0.8; this._spread = 1; }
        if (dir === 'down')  this._sweepBoost = 0;
    }

    dispose() {
        for (const d of this._disposables) d.dispose();
        this._group?.parent?.remove(this._group);
        this._group = null;
        this._disposables = [];
        this._lasers = [];
        this._smoke = [];
        this._spots = [];
        this._bars = this._peakMesh = this._barMat = this._floorOverlay = null;
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
