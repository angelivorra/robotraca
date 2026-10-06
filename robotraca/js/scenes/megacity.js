import * as THREE from 'three';

// Blade Runner-style megacity canyon: the viewer flies forward between two
// walls of enormous lit towers. Holographic billboards flicker on the inner
// faces, flying cars streak past as light trails, searchlights sweep the haze
// and red beacons blink on the rooftops. Everything is procedural (canvas
// textures + boxes), so there are no external assets to load.
const NUM_ROWS    = 11;
const ROW_SPACING = 10;
const TOTAL_Z     = NUM_ROWS * ROW_SPACING;
const WRAP_Z      = 9;
const BASE_Y      = -40;
const NUM_CARS    = 46;
const CELL_WORLD  = 4;    // world units covered by one window texture tile

const NEON = ['#ff2a9d', '#27f5ff', '#ffe14d', '#b05cff', '#ff6a3d'];

export class MegacityScene {
    get useBloom() { return false; }

    constructor() {
        this._group = null;
        this._rows = [];
        this._cars = [];
        this._beams = [];
        this._disposables = [];
        this._beatFlash = 0;
        this._speedBoost = 0;
        this._time = 0;
    }

    init(threeScene, theme) {
        this._group = new THREE.Group();
        threeScene.add(this._group);

        const fogCol = new THREE.Color('#3b0f5e');
        threeScene.background = new THREE.Color('#12002a');
        threeScene.fog = new THREE.FogExp2(fogCol, 0.021);

        const rand = _rng(11);
        this._buildBackdrop();
        this._buildTowers(rand);
        this._buildCars(rand);
        this._buildBeams();
    }

    update(reactive, delta) {
        this._time += delta;
        this._beatFlash  *= Math.pow(0.84, delta * 60);
        this._speedBoost *= Math.pow(0.95, delta * 60);

        const bass  = reactive.bassEnergy;
        const speed = (5 + bass * 14 + this._speedBoost * 16) * delta;

        for (const row of this._rows) {
            row.group.position.z += speed;
            if (row.group.position.z > WRAP_Z) row.group.position.z -= TOTAL_Z;
            for (const t of row.towers) {
                t.mat.color.setScalar(0.8 + bass * 0.5 + this._beatFlash * 0.5 * t.beatW);
                if (t.beacon) t.beacon.visible = Math.sin(this._time * 2.2 + t.phase) > 0.2;
                if (t.board) {
                    const flick = Math.sin(this._time * t.board.rate + t.phase) > 0.92 ? 0.3 : 1;
                    t.board.mat.color.setScalar((0.8 + reactive.midsEnergy * 0.8 + this._beatFlash * 0.5) * flick);
                }
            }
        }

        for (const car of this._cars) {
            car.mesh.position.z += speed - car.v * delta;
            if (car.mesh.position.z > 8)    this._respawnCar(car, -95);
            if (car.mesh.position.z < -100) this._respawnCar(car, 8);
        }

        const sweep = this._time * 0.35;
        this._beams.forEach((b, i) => {
            b.rotation.z = Math.sin(sweep + i * 2.1) * 0.55 + (i ? 0.15 : -0.15);
            b.material.opacity = 0.18 + reactive.highsEnergy * 0.25 + this._beatFlash * 0.15;
        });
    }

    // ── Haze backdrop + searchlights ────────────────────────────────────────

    _buildBackdrop() {
        const tex = _canvasTex(8, 512, (c, w, h) => {
            const g = c.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0.00, '#05000f');
            g.addColorStop(0.40, '#1d0540');
            g.addColorStop(0.70, '#6a1470');
            g.addColorStop(0.88, '#ff3f8e');
            g.addColorStop(1.00, '#ffa85c');
            c.fillStyle = g; c.fillRect(0, 0, w, h);
        });
        const mat = new THREE.MeshBasicMaterial({ map: tex, fog: false, toneMapped: false });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(420, 200), mat);
        mesh.position.set(0, 18, -88);
        this._group.add(mesh);
        this._disposables.push(tex, mat, mesh.geometry);
    }

    _buildBeams() {
        const tex = _canvasTex(64, 256, (c, w, h) => {
            const g = c.createLinearGradient(0, h, 0, 0);
            g.addColorStop(0, 'rgba(180,240,255,0.9)');
            g.addColorStop(1, 'rgba(180,240,255,0)');
            c.fillStyle = g;
            c.beginPath(); c.moveTo(w * 0.42, h); c.lineTo(w * 0.58, h);
            c.lineTo(w * 0.95, 0); c.lineTo(w * 0.05, 0); c.fill();
        });
        this._disposables.push(tex);
        for (let i = 0; i < 2; i++) {
            const mat = new THREE.MeshBasicMaterial({
                map: tex, transparent: true, opacity: 0.2, depthWrite: false,
                blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
            });
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(26, 90), mat);
            // Pivot at the bottom of the beam, far down the canyon.
            mesh.geometry.translate(0, 45, 0);
            mesh.position.set(i ? 9 : -9, -22, -80 + i * 6);
            this._group.add(mesh);
            this._beams.push(mesh);
            this._disposables.push(mat, mesh.geometry);
        }
    }

    // ── Towers, billboards, beacons ─────────────────────────────────────────

    _buildTowers(rand) {
        const windowTex = [0.32, 0.46, 0.24].map(d => {
            const t = _canvasTex(256, 256, (c, w, h) => _drawWindows(c, w, h, d, rand));
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.magFilter = THREE.NearestFilter;
            this._disposables.push(t);
            return t;
        });
        const boardTex = NEON.map((col, i) => _boardTexture(col, i));
        this._disposables.push(...boardTex);
        const beaconGeo = new THREE.SphereGeometry(0.28, 6, 6);
        const beaconMat = new THREE.MeshBasicMaterial({ color: '#ff2020', toneMapped: false, fog: false });
        this._disposables.push(beaconGeo, beaconMat);

        for (let r = 0; r < NUM_ROWS; r++) {
            const group = new THREE.Group();
            group.position.z = -r * ROW_SPACING;
            const row = { group, towers: [] };

            for (const side of [-1, 1]) {
                for (const outer of [false, true]) {
                    const w = 4 + rand() * 3.5;
                    const d = 5 + rand() * 3;
                    const h = outer ? 40 + rand() * 25 : 22 + rand() * 24;
                    const inner = outer ? 13 + rand() * 4 : 6.2 + rand() * 2.2;
                    const cx = side * (inner + w / 2);
                    const tower = _tower(w, h, d, windowTex[Math.floor(rand() * 3)]);
                    tower.mesh.position.set(cx, BASE_Y + h / 2, (rand() - 0.5) * 2);
                    group.add(tower.mesh);
                    this._disposables.push(tower.geo, tower.mat);

                    const t = { mat: tower.mat, beatW: 0.4 + rand() * 0.8, phase: rand() * 10 };
                    const topY = BASE_Y + h;
                    if (rand() < 0.7) {
                        const b = new THREE.Mesh(beaconGeo, beaconMat);
                        b.position.set(cx, topY + 0.4, tower.mesh.position.z);
                        group.add(b);
                        t.beacon = b;
                    }
                    if (!outer && rand() < 0.75) {
                        const bw = Math.min(d * 0.9, 6), bh = bw * 1.5;
                        const idx = Math.floor(rand() * boardTex.length);
                        const mat = new THREE.MeshBasicMaterial({
                            map: boardTex[idx], transparent: true, toneMapped: false,
                        });
                        const board = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), mat);
                        board.rotation.y = -side * Math.PI / 2;
                        board.position.set(side * (inner - 0.05), -4 + rand() * 12, tower.mesh.position.z);
                        group.add(board);
                        t.board = { mat, rate: 3 + rand() * 8 };
                        this._disposables.push(mat, board.geometry);
                    }
                    row.towers.push(t);
                }
            }
            this._group.add(group);
            this._rows.push(row);
        }
    }

    // ── Flying cars (light bars along z) ─────────────────────────────────────────

    _buildCars(rand) {
        const geo = new THREE.BoxGeometry(0.14, 0.14, 3);
        this._disposables.push(geo);

        for (let i = 0; i < NUM_CARS; i++) {
            const oncoming = rand() < 0.5;
            const mat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(oncoming ? '#e8fbff' : '#ff3050'),
                transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending,
                depthWrite: false, toneMapped: false,
            });
            const mesh = new THREE.Mesh(geo, mat);
            const car = { mesh, oncoming, rand };
            this._respawnCar(car, -95 * rand());
            this._group.add(mesh);
            this._cars.push(car);
            this._disposables.push(mat);
        }
    }

    // v is the car's own speed along +z (positive = coming toward the viewer
    // slower than the camera moves); the update adds camera speed on top.
    _respawnCar(car, z) {
        const r = car.rand;
        const lane = r();
        car.mesh.position.set(
            (r() * 2 - 1) * 5.2,
            -8 + lane * 18,
            z,
        );
        car.v = car.oncoming ? -(8 + r() * 20) : (2 + r() * 4);
    }

    // ── Interaction ─────────────────────────────────────────────────────────

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
        this._rows = [];
        this._cars = [];
        this._beams = [];
        this._disposables = [];
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

// Box whose UVs are scaled so the window texture keeps a constant world size
// on every face regardless of the tower's dimensions.
function _tower(w, h, d, map) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const uv = geo.attributes.uv;
    const normal = geo.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
        const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i));
        const uSize = nx > 0.5 ? d : w;
        if (ny > 0.5) { uv.setXY(i, 0, 0); continue; }   // roof: single dark texel
        uv.setXY(i, uv.getX(i) * uSize / CELL_WORLD, uv.getY(i) * h / CELL_WORLD);
    }
    const mat = new THREE.MeshBasicMaterial({ map });
    return { geo, mat, mesh: new THREE.Mesh(geo, mat) };
}

function _drawWindows(c, w, h, density, rand) {
    c.fillStyle = '#07021a';
    c.fillRect(0, 0, w, h);
    const lit = ['#fff1c9', '#fff1c9', '#27f5ff', '#ff2a9d', '#ffe14d', '#b05cff'];
    const cell = 32;
    for (let y = 0; y < h; y += cell) {
        for (let x = 0; x < w; x += cell) {
            if (rand() < density) {
                c.fillStyle = lit[Math.floor(rand() * lit.length)];
                c.fillRect(x + 6, y + 7, cell - 12, cell - 14);
            }
        }
    }
    // Thin floor lines give the facade a structural rhythm.
    c.fillStyle = 'rgba(80,40,140,0.45)';
    for (let y = 0; y < h; y += cell * 4) c.fillRect(0, y, w, 2);
}

function _boardTexture(color, idx) {
    const words = ['電脳', 'NEON', 'ロボ', '2049', '夜市'];
    return _canvasTex(128, 192, (c, w, h) => {
        c.fillStyle = 'rgba(6,0,18,0.88)'; c.fillRect(0, 0, w, h);
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.globalAlpha = 0.35; c.fillStyle = g; c.fillRect(0, 0, w, h); c.globalAlpha = 1;
        c.strokeStyle = color; c.lineWidth = 5; c.strokeRect(4, 4, w - 8, h - 8);
        c.fillStyle = color; c.shadowColor = color; c.shadowBlur = 14;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = `bold ${w * 0.5}px sans-serif`;
        c.fillText(words[idx % words.length], w / 2, h * 0.42, w - 18);
        c.font = `bold ${w * 0.16}px monospace`;
        for (let i = 0; i < 4; i++) c.fillRect(14, h * 0.7 + i * 10, (w - 28) * (0.4 + ((i * 37 + idx * 13) % 60) / 100), 4);
    });
}
