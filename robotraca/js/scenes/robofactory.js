import * as THREE from 'three';

// Robot factory bay. The room stays put. Unfinished robot bodies roll toward
// the camera, pulley wheels spin on the gantry, coil springs stretch on the
// kick and welding arms throw sparks. Instanced parts, textures painted once.
const FLOOR_Y = -2.25;
const BODIES  = 12;
const NEAR_Z  = 2.6;
const FAR_Z   = -24;
const SPAN    = NEAR_Z - FAR_Z;
const COILS   = 6;

export class RoboFactoryScene {
    get useBloom() { return false; }

    constructor() {
        this._group = null;
        this._disposables = [];
        this._bodies = [];
        this._rigs = [];
        this._gears = [];
        this._dummy = new THREE.Object3D();
        this._tip = new THREE.Vector3();
        this._beat = 0;
        this._boost = 0;
        this._time = 0;
        this._sparked = false;
        this._primary = new THREE.Color();
        this._secondary = new THREE.Color();
        this._steel = new THREE.Color('#c5ccd6');
        this._copper = new THREE.Color('#e6b07a');
        this._tmp = new THREE.Color();
    }

    init(threeScene, theme) {
        this._group = new THREE.Group();
        threeScene.add(this._group);
        this._hexP = theme.primaryColor || '#e94560';
        this._hexS = theme.secondaryColor || '#16c79a';
        this._primary.set(this._hexP);
        this._secondary.set(this._hexS);

        threeScene.background = new THREE.Color('#100c0a');
        threeScene.fog = new THREE.FogExp2(new THREE.Color('#24160f'), 0.038);

        this._buildShell();
        this._buildLine();
        this._buildRig();
        this._buildGears();
        this._buildSparks();
        this._layoutLine(0);
        this._layoutRig(0, 0, 0);
    }

    update(reactive, delta) {
        this._time += delta;
        this._beat *= Math.pow(0.84, delta * 60);
        this._boost *= Math.pow(0.94, delta * 60);

        const bass = reactive.bassEnergy || 0;
        const mids = reactive.midsEnergy || 0;
        const highs = reactive.highsAttack || 0;
        const speed = (2.6 + bass * 5.5 + this._boost * 6) * delta;

        this._beltTex.offset.y += speed / 2.4;
        this._layoutLine(speed);
        this._layoutRig(bass, mids, delta);

        if (this._beat > 0.7 && !this._sparked) {
            this._sparked = true;
            this._burstAll(9);
        } else if (highs > 0.35 && Math.random() < highs * 0.45) {
            const r = this._rigs[(Math.random() * this._rigs.length) | 0];
            this._burst(r.tipX, r.tipY, r.z, 2);
        }
        if (reactive.isSnare) this._burstAll(4);

        const hot = 0.55 + bass * 0.35 + this._beat * 0.7;
        this._torsoMat.color.setScalar(hot);
        this._visorMat.color.copy(this._primary).multiplyScalar(0.45 + bass * 0.8 + this._beat);
        this._springMat.color.copy(this._copper).lerp(this._primary, this._beat * 0.85);
        this._pulleyGlow.color.copy(this._secondary).multiplyScalar(0.35 + mids * 0.9 + this._beat * 0.4);
        this._tipMat.color.copy(this._primary).multiplyScalar(0.4 + this._beat * 2.6);
        this._lampMat.color.copy(this._secondary).multiplyScalar(0.25 + bass * 0.8 + this._beat * 0.5);
        this._stepSparks(delta);
    }

    onBeat() {
        this._beat = 1;
        this._sparked = false;
    }
    onTap() { this.onBeat(); }
    onSwipe(dir) {
        if (dir === 'up') this._boost = Math.min(2, this._boost + 0.6);
        if (dir === 'down') this._boost = Math.max(0, this._boost - 0.35);
    }

    dispose() {
        for (const d of this._disposables) d.dispose?.();
        this._group?.parent?.remove(this._group);
        this._group = null;
        this._bodies = [];
        this._rigs = [];
        this._gears = [];
        this._disposables = [];
    }

    // ── Room ────────────────────────────────────────────────────────────────

    _buildShell() {
        const floorTex = _canvasTex(256, 256, (c, w, h) => {
            c.fillStyle = '#1a1816'; c.fillRect(0, 0, w, h);
            c.strokeStyle = '#3a342e'; c.lineWidth = 6;
            for (let y = 0; y <= h; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
            for (let x = 0; x <= w; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
            c.fillStyle = '#24211c';
            for (let y = 8; y < h; y += 64) for (let x = 8; x < w; x += 64) c.fillRect(x, y, 48, 48);
            c.fillStyle = '#6a6258';
            for (let y = 10; y < h; y += 64) for (let x = 10; x < w; x += 64) {
                c.beginPath(); c.arc(x, y, 2.5, 0, Math.PI * 2); c.fill();
            }
        });
        floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
        floorTex.anisotropy = 4;
        floorTex.repeat.set(3, 8);
        const floorMat = new THREE.MeshBasicMaterial({ map: floorTex, toneMapped: false });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 36), floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, FLOOR_Y, -12);
        this._group.add(floor);

        const beltTex = _canvasTex(64, 256, (c, w, h) => {
            c.fillStyle = '#12100e'; c.fillRect(0, 0, w, h);
            for (let y = 0; y < h; y += 16) {
                c.fillStyle = y % 32 === 0 ? '#3a342c' : '#1c1916';
                c.fillRect(6, y, w - 12, 11);
            }
            c.fillStyle = this._hexS;
            c.fillRect(0, 0, 4, h);
            c.fillRect(w - 4, 0, 4, h);
        });
        beltTex.wrapT = THREE.RepeatWrapping;
        beltTex.anisotropy = 4;
        beltTex.repeat.set(1, 8);
        this._beltTex = beltTex;
        const beltMat = new THREE.MeshBasicMaterial({ map: beltTex, toneMapped: false, side: THREE.DoubleSide });
        const beltGeo = new THREE.PlaneGeometry(1.35, 28);
        for (const x of [-1.72, 1.72]) {
            const belt = new THREE.Mesh(beltGeo, beltMat);
            belt.rotation.x = -Math.PI / 2;
            belt.position.set(x, FLOOR_Y + 0.03, -11);
            this._group.add(belt);
        }

        const wallTex = _canvasTex(256, 128, (c, w, h) => _paintWall(c, w, h, this._hexP, this._hexS));
        wallTex.wrapS = THREE.RepeatWrapping;
        wallTex.anisotropy = 4;
        wallTex.repeat.set(5, 1);
        const wallMat = new THREE.MeshBasicMaterial({ map: wallTex, toneMapped: false, side: THREE.DoubleSide });
        const wallGeo = new THREE.PlaneGeometry(34, 5.4);
        const left = new THREE.Mesh(wallGeo, wallMat);
        left.rotation.y = Math.PI / 2;
        left.position.set(-5.3, 0.35, -12);
        const right = new THREE.Mesh(wallGeo, wallMat);
        right.rotation.y = -Math.PI / 2;
        right.position.set(5.3, 0.35, -12);
        this._group.add(left, right);

        const endTex = _canvasTex(256, 256, (c, w, h) => _paintSchematic(c, w, h, this._hexP, this._hexS));
        const endMat = new THREE.MeshBasicMaterial({
            map: endTex, toneMapped: false, fog: false, side: THREE.DoubleSide,
        });
        const end = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 4.2), endMat);
        end.position.set(0, 0.2, -20);
        this._group.add(end);

        const steel = new THREE.MeshBasicMaterial({ color: '#3a404a', toneMapped: false });
        const box = new THREE.BoxGeometry(1, 1, 1);
        for (const x of [-2.15, 2.15]) {
            const beam = new THREE.Mesh(box, steel);
            beam.scale.set(0.18, 0.22, 26);
            beam.position.set(x, 2.72, -10);
            this._group.add(beam);
        }
        this._lampMat = new THREE.MeshBasicMaterial({ color: this._hexS, toneMapped: false, fog: false });
        const lamp = new THREE.Mesh(box, this._lampMat);
        lamp.scale.set(0.08, 0.06, 24);
        lamp.position.set(0, 2.85, -10);
        this._group.add(lamp);

        this._disposables.push(
            floorTex, floorMat, floor.geometry, beltTex, beltMat, beltGeo,
            wallTex, wallMat, wallGeo, endTex, endMat, end.geometry, steel, box, this._lampMat,
        );
        this._box = box;
    }

    // ── Robot bodies on the line ────────────────────────────────────────────

    _buildLine() {
        const n = BODIES;
        const box = new THREE.BoxGeometry(1, 1, 1);
        const headGeo = new THREE.SphereGeometry(1, 8, 6);
        const plane = new THREE.PlaneGeometry(1, 1);
        const torsoTex = _canvasTex(128, 160, (c, w, h) => _paintTorso(c, w, h, this._hexP, this._hexS));
        torsoTex.anisotropy = 4;
        this._torsoMat = new THREE.MeshBasicMaterial({ map: torsoTex, toneMapped: false });
        const cradleMat = new THREE.MeshBasicMaterial({ color: '#2c3138', toneMapped: false });
        const headMat = new THREE.MeshBasicMaterial({ color: '#d5dbe3', toneMapped: false });
        const armMat = new THREE.MeshBasicMaterial({ color: '#9aa3ae', toneMapped: false });
        this._visorMat = new THREE.MeshBasicMaterial({
            color: this._hexP, toneMapped: false, fog: false,
            blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide,
        });

        this._cradles = this._batch(box, cradleMat, n);
        this._torsos = this._batch(box, this._torsoMat, n);
        this._heads = this._batch(headGeo, headMat, n);
        this._arms = this._batch(box, armMat, n);
        this._visors = this._batch(plane, this._visorMat, n);

        for (let i = 0; i < n; i++) {
            const side = i % 2 ? 1 : -1;
            this._bodies.push({
                side,
                x: side * 1.72,
                z: NEAR_Z - (i / n) * SPAN,
                phase: i * 0.7,
            });
            this._visors.setColorAt(i, side > 0 ? this._primary : this._secondary);
        }
        this._visors.instanceColor.needsUpdate = true;
        this._disposables.push(box, headGeo, plane, torsoTex, this._torsoMat, cradleMat, headMat, armMat, this._visorMat);
    }

    _layoutLine(speed) {
        const d = this._dummy;
        const bob = Math.sin(this._time * 1.5);
        for (let i = 0; i < this._bodies.length; i++) {
            const b = this._bodies[i];
            b.z += speed;
            if (b.z > NEAR_Z) b.z -= SPAN;
            const yLift = bob * 0.02 * Math.sin(b.phase);
            this._put(this._cradles, i, b.x, -1.7, b.z, 0.95, 0.85, 0.72, 0, 0, 0);
            this._put(this._torsos, i, b.x, -0.55 + yLift, b.z, 0.62, 1.2, 0.4, 0, 0, 0);
            this._put(this._heads, i, b.x, 0.28 + yLift, b.z, 0.26, 0.28, 0.24, 0, 0, 0);
            this._put(this._visors, i, b.x, 0.32 + yLift, b.z + 0.25, 0.32, 0.08, 1, 0, 0, 0);
            this._put(this._arms, i, b.x + b.side * 0.42, -0.45 + yLift, b.z, 0.42, 0.14, 0.14, 0, 0, b.side * -0.4);
        }
        this._cradles.instanceMatrix.needsUpdate = true;
        this._torsos.instanceMatrix.needsUpdate = true;
        this._heads.instanceMatrix.needsUpdate = true;
        this._visors.instanceMatrix.needsUpdate = true;
        this._arms.instanceMatrix.needsUpdate = true;
    }

    // ── Pulleys, springs, welding arms ──────────────────────────────────────

    _buildRig() {
        const spots = [];
        for (const side of [-1, 1]) {
            for (const z of [-1.15, -6.4, -12]) spots.push({ side, z, weld: Math.abs(z) < 8 });
        }
        const n = spots.length;
        const box = this._box;
        const torus = new THREE.TorusGeometry(0.34, 0.055, 6, 10);
        const coil = new THREE.TorusGeometry(0.16, 0.028, 5, 8);
        const steel = new THREE.MeshBasicMaterial({ color: '#d5dbe4', toneMapped: false });
        const dark = new THREE.MeshBasicMaterial({ color: '#2a3038', toneMapped: false });
        this._pulleyGlow = new THREE.MeshBasicMaterial({
            color: this._hexS, toneMapped: false, fog: false,
            blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
        });
        this._springMat = new THREE.MeshBasicMaterial({ color: '#e6b07a', toneMapped: false, fog: false });
        this._tipMat = new THREE.MeshBasicMaterial({
            color: this._hexP, toneMapped: false, fog: false,
            blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
        });
        const linkMat = new THREE.MeshBasicMaterial({ color: '#b7c0cc', toneMapped: false });

        this._pulleys = this._batch(torus, steel, n);
        this._pulleyLamps = this._batch(torus, this._pulleyGlow, n);
        this._coils = this._batch(coil, this._springMat, n * COILS);
        this._cables = this._batch(box, dark, n);
        this._links = this._batch(box, linkMat, n * 3);
        this._masts = this._batch(box, dark, n);
        this._uppers = this._batch(box, steel, n);
        this._fores = this._batch(box, steel, n);
        this._tips = this._batch(box, this._tipMat, n);

        for (const s of spots) {
            this._rigs.push({
                side: s.side,
                z: s.z,
                weld: s.weld,
                x: s.side * 1.72,
                phase: s.z * 0.4 + s.side,
                tipX: s.side * 1.8,
                tipY: 0.9,
            });
        }
        this._disposables.push(
            torus, coil, steel, dark, this._pulleyGlow, this._springMat, this._tipMat, linkMat,
        );
    }

    _layoutRig(bass, mids, delta) {
        const t = this._time;
        const stretch = 0.155 + bass * 0.04 + this._beat * 0.07;
        for (let i = 0; i < this._rigs.length; i++) {
            const r = this._rigs[i];
            const spin = t * (1.1 + mids * 2.2) + r.phase;
            const py = 2.42;
            this._put(this._pulleys, i, r.x, py, r.z, 1, 1, 1, 0, 0, spin);
            this._put(this._pulleyLamps, i, r.x, py, r.z, 1.18, 1.18, 1, 0, 0, spin);
            this._put(this._cables, i, r.x, py - 0.22, r.z, 0.035, 0.28, 0.035, 0, 0, 0);

            const top = py - 0.42;
            for (let k = 0; k < COILS; k++) {
                const a = k * 1.05 + r.phase;
                const y = top - k * stretch;
                const x = r.x + Math.cos(a) * 0.055;
                const z = r.z + Math.sin(a) * 0.04;
                this._put(this._coils, i * COILS + k, x, y, z, 1, 1, 1, 0, 0, a);
                if (k < 3) {
                    const ly = py - 0.12 - k * 0.1;
                    const sway = Math.sin(t * 2.2 + r.phase + k) * 0.035;
                    this._put(this._links, i * 3 + k, r.x + sway, ly, r.z, 0.1, 0.07, 0.045, 0, 0, sway * 4);
                }
            }

            // Mast and two-bone welder. Only the nearer bays actually reach in.
            this._put(this._masts, i, r.side * 2.72, -0.35, r.z, 0.16, 2.55, 0.16, 0, 0, 0);
            const idle = Math.sin(t * 1.4 + r.phase) * 0.06;
            const jab = r.weld ? this._beat * 0.32 : this._beat * 0.12;
            const lean = 0.5 + idle + jab * 0.45;
            const bend = 1.05 + jab;
            const a0 = r.side > 0 ? Math.PI + lean : -lean;
            const a1 = r.side > 0 ? Math.PI + bend : -bend;
            const sX = r.side * 2.35;
            const sY = 0.95;
            const mid = this._bone(this._uppers, i, sX, sY, r.z, a0, 0.78);
            const tip = this._bone(this._fores, i, mid.x, mid.y, r.z, a1, 0.55);
            r.tipX = tip.x;
            r.tipY = tip.y;
            const flash = 0.18 + (r.weld ? this._beat * 0.6 : this._beat * 0.22);
            this._put(this._tips, i, tip.x, tip.y, r.z, flash, flash, flash, 0, 0, 0);
        }
        this._pulleys.instanceMatrix.needsUpdate = true;
        this._pulleyLamps.instanceMatrix.needsUpdate = true;
        this._coils.instanceMatrix.needsUpdate = true;
        this._cables.instanceMatrix.needsUpdate = true;
        this._links.instanceMatrix.needsUpdate = true;
        this._masts.instanceMatrix.needsUpdate = true;
        this._uppers.instanceMatrix.needsUpdate = true;
        this._fores.instanceMatrix.needsUpdate = true;
        this._tips.instanceMatrix.needsUpdate = true;

        for (let i = 0; i < this._gears.length; i++) {
            const g = this._gears[i];
            g.spin += (0.4 + mids * 1.6) * delta;
            this._put(this._gearMesh, i, g.x, g.y, g.z, g.s, g.s, 1, 0, g.ry, g.spin);
        }
        if (this._gearMesh) this._gearMesh.instanceMatrix.needsUpdate = true;
    }

    _bone(mesh, i, x, y, z, ang, len) {
        const x1 = x + Math.cos(ang) * len;
        const y1 = y + Math.sin(ang) * len;
        this._put(mesh, i, (x + x1) / 2, (y + y1) / 2, z, len, 0.16, 0.16, 0, 0, ang);
        return { x: x1, y: y1 };
    }

    _buildGears() {
        const tex = _canvasTex(128, 128, (c, w, h) => _paintGear(c, w, h, this._hexS));
        const mat = new THREE.MeshBasicMaterial({
            map: tex, transparent: true, alphaTest: 0.35, toneMapped: false, side: THREE.DoubleSide, fog: false,
        });
        const plane = new THREE.PlaneGeometry(1, 1);
        const spots = [
            { x: -2.55, y: 1.55, z: -2.6, s: 1.15, ry: Math.PI / 2 },
            { x: 2.55, y: 1.7, z: -5.2, s: 1.25, ry: -Math.PI / 2 },
            { x: -3.6, y: 0.45, z: -9.5, s: 1.45, ry: Math.PI / 2 },
            { x: 3.6, y: 1.05, z: -13, s: 1.35, ry: -Math.PI / 2 },
        ];
        this._gearMesh = this._batch(plane, mat, spots.length);
        for (const s of spots) this._gears.push({ ...s, spin: Math.random() * 6 });
        this._disposables.push(tex, mat, plane);
    }

    // ── Sparks ──────────────────────────────────────────────────────────────

    _buildSparks() {
        const n = 110;
        this._sparkN = n;
        this._life = new Float32Array(n);
        this._vx = new Float32Array(n);
        this._vy = new Float32Array(n);
        this._vz = new Float32Array(n);
        const pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) pos[i * 3 + 1] = -30;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const tex = _canvasTex(32, 32, (c, w, h) => {
            const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(0.35, 'rgba(255,210,140,0.85)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = g; c.fillRect(0, 0, w, h);
        });
        const mat = new THREE.PointsMaterial({
            map: tex, color: this._hexP, size: 0.36, transparent: true, depthWrite: false,
            blending: THREE.AdditiveBlending, toneMapped: false, fog: false, sizeAttenuation: true,
        });
        this._sparks = new THREE.Points(geo, mat);
        this._sparks.frustumCulled = false;
        this._sparkPos = geo.attributes.position;
        this._sparkMat = mat;
        this._group.add(this._sparks);
        this._disposables.push(geo, tex, mat);
    }

    _burstAll(count) {
        for (const r of this._rigs) if (r.weld) this._burst(r.tipX, r.tipY, r.z, count);
    }

    _burst(x, y, z, count) {
        let left = count;
        const pos = this._sparkPos;
        for (let i = 0; i < this._sparkN && left > 0; i++) {
            if (this._life[i] > 0) continue;
            this._life[i] = 0.22 + Math.random() * 0.28;
            this._vx[i] = (Math.random() - 0.5) * 2.8;
            this._vy[i] = 0.6 + Math.random() * 2.4;
            this._vz[i] = (Math.random() - 0.5) * 2.2;
            pos.setXYZ(i, x + (Math.random() - 0.5) * 0.2, y, z + (Math.random() - 0.5) * 0.2);
            left--;
        }
        pos.needsUpdate = true;
    }

    _stepSparks(delta) {
        const pos = this._sparkPos;
        let alive = 0;
        for (let i = 0; i < this._sparkN; i++) {
            if (this._life[i] <= 0) continue;
            this._life[i] -= delta;
            if (this._life[i] <= 0) {
                pos.setY(i, -30);
                continue;
            }
            alive++;
            this._vy[i] -= delta * 6;
            pos.setXYZ(
                i,
                pos.getX(i) + this._vx[i] * delta,
                pos.getY(i) + this._vy[i] * delta,
                pos.getZ(i) + this._vz[i] * delta,
            );
        }
        pos.needsUpdate = true;
        this._sparkMat.opacity = alive ? 0.95 : 0;
    }

    _batch(geo, mat, n) {
        const mesh = new THREE.InstancedMesh(geo, mat, n);
        mesh.frustumCulled = false;
        this._group.add(mesh);
        return mesh;
    }

    _put(mesh, i, x, y, z, sx, sy, sz, rx, ry, rz) {
        const d = this._dummy;
        d.position.set(x, y, z);
        d.rotation.set(rx, ry, rz);
        d.scale.set(sx, sy, sz);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
    }
}

function _paintTorso(c, w, h, primary, secondary) {
    c.fillStyle = '#c8cdd4';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#2a313a';
    c.lineWidth = 4;
    c.strokeRect(6, 6, w - 12, h - 12);
    c.beginPath();
    c.moveTo(8, h * 0.42); c.lineTo(w - 8, h * 0.42); c.stroke();
    c.beginPath();
    c.moveTo(8, h * 0.7); c.lineTo(w - 8, h * 0.7); c.stroke();
    c.fillStyle = '#1c222b';
    for (let i = 0; i < 5; i++) c.fillRect(16, 18 + i * 10, w * 0.28, 4);
    c.fillStyle = primary;
    c.beginPath();
    c.arc(w * 0.62, h * 0.36, 16, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#0e1218';
    c.beginPath();
    c.arc(w * 0.62, h * 0.36, 7, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = secondary;
    c.fillRect(w * 0.48, h * 0.78, w * 0.4, 8);
    c.fillStyle = '#5c6772';
    c.fillRect(10, h - 22, 14, 10);
    c.fillRect(w - 24, h - 22, 14, 10);
}

function _paintWall(c, w, h, primary, secondary) {
        c.fillStyle = '#2a3038';
        c.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 64) {
            c.fillStyle = '#3c4552';
            c.fillRect(x + 3, 6, 58, h - 12);
            c.strokeStyle = '#8b97a6';
            c.lineWidth = 3;
            c.strokeRect(x + 8, 12, 48, 30);
            c.fillStyle = primary;
            c.beginPath(); c.arc(x + 22, 27, 8, 0, Math.PI * 2); c.fill();
            c.fillStyle = secondary;
            c.beginPath(); c.arc(x + 42, 27, 8, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#141820';
            for (let k = 0; k < 4; k++) c.fillRect(x + 12, 50 + k * 13, 40, 6);
            c.fillStyle = '#f0b429';
            c.fillRect(x + 8, h - 22, 14, 12);
            c.fillStyle = '#1a1208';
            c.fillRect(x + 24, h - 22, 14, 12);
            c.fillStyle = '#f0b429';
            c.fillRect(x + 40, h - 22, 14, 12);
        }
}

function _paintSchematic(c, w, h, primary, secondary) {
    c.fillStyle = '#120e0c';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#3a3028';
    c.lineWidth = 6;
    c.strokeRect(10, 10, w - 20, h - 20);
    c.strokeStyle = primary;
    c.lineWidth = 3;
    const cx = w * 0.5;
    c.strokeRect(cx - 36, h * 0.38, 72, 90);
    c.beginPath(); c.arc(cx, h * 0.28, 28, 0, Math.PI * 2); c.stroke();
    c.beginPath();
    c.moveTo(cx - 36, h * 0.5); c.lineTo(cx - 78, h * 0.62); c.stroke();
    c.beginPath();
    c.moveTo(cx + 36, h * 0.5); c.lineTo(cx + 78, h * 0.42); c.stroke();
    c.strokeStyle = secondary;
    c.beginPath(); c.arc(cx, h * 0.55, 10, 0, Math.PI * 2); c.stroke();
    c.fillStyle = primary;
    c.globalAlpha = 0.8;
    c.fillRect(18, h - 36, w * 0.35, 8);
    c.fillStyle = secondary;
    c.fillRect(w * 0.55, h - 36, w * 0.3, 8);
    c.globalAlpha = 1;
}

function _paintGear(c, w, h, hex) {
    c.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const r = w * 0.34;
    c.fillStyle = '#9aa3ae';
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    c.save();
    c.translate(cx, cy);
    c.fillStyle = '#d5dbe3';
    for (let i = 0; i < 12; i++) {
        c.rotate(Math.PI / 6);
        c.fillRect(-7, r * 0.62, 14, r * 0.55);
    }
    c.restore();
    c.fillStyle = '#2a313c';
    c.beginPath();
    c.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = hex;
    c.beginPath();
    c.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#12151c';
    for (let i = 0; i < 5; i++) {
        const a = i * (Math.PI * 2 / 5);
        c.beginPath();
        c.arc(cx + Math.cos(a) * r * 0.4, cy + Math.sin(a) * r * 0.4, 6, 0, Math.PI * 2);
        c.fill();
    }
}

function _canvasTex(w, h, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    draw(canvas.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}
