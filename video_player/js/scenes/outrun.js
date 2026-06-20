import * as THREE from 'three';

// ── Constants ─────────────────────────────────────────────────────────────────
const ROAD_Y   = -1.5;
const ROAD_W   =  6.0;
const BORDER_W =  0.42;
const GRASS_W  =  8.0;
const SEG_D    =  0.52;
const NUM_SEGS =  88;
const NEAR_Z   =  4.5;
const FAR_Z    = NEAR_Z - NUM_SEGS * SEG_D;
const TOTAL_Z  = NUM_SEGS * SEG_D;
const NUM_TREES = 22;
const NUM_CARS  =  5;
const LANE_X    =  ROAD_W / 4;

const ROAD_COLS   = ['#3c3c3c', '#4a4a4a'];
const GRASS_COLS  = ['#007722', '#00aa33'];
const BORDER_COLS = ['#dd2000', '#f5f5f5'];
const BORDER_PEAKS = ['#ff5500', '#ffff88'];
const GRASS_PEAKS  = ['#00dd55', '#00ff77'];

export class OutrunScene {
    get useBloom() { return this._useBloom; }

    constructor() {
        this._group      = null;
        this._time       = 0;
        this._speedBoost = 0;
        this._beatFlash  = 0;
        this._beatPulse  = 0;   // decae más lento que beatFlash — para sky/sol
        this._useBloom   = false;
        this._theme      = null;

        this._segs       = [];
        this._treesL     = [];
        this._treesR     = [];
        this._signsL     = [];  // carteles de neón que scrollean
        this._signsR     = [];
        this._glitters   = [];
        this._neonSigns  = [];  // { mat, seed } — actualización de emissive
        this._cars       = [];
        this._sunMesh    = null;
        this._skyMats    = [];  // { mat, base, peak }

        this._curveDrift  = 0;
        this._curveTarget = 0;
        this._curveTimer  = 0;

        // Colores pre-allocados para animar bordillos y hierba sin crear objetos por frame
        this._borderBase = BORDER_COLS.map(c => new THREE.Color(c));
        this._borderPeak = BORDER_PEAKS.map(c => new THREE.Color(c));
        this._grassBase  = GRASS_COLS.map(c => new THREE.Color(c));
        this._grassPeak  = GRASS_PEAKS.map(c => new THREE.Color(c));
        this._tmpCol     = new THREE.Color();
    }

    init(threeScene, theme) {
        this._theme = theme;
        this._group = new THREE.Group();
        threeScene.add(this._group);

        threeScene.background = new THREE.Color('#1a0844');
        threeScene.fog = new THREE.FogExp2(new THREE.Color('#3a1044'), 0.016);

        this._sunMesh = _buildSky(this._group, this._glitters, this._skyMats);
        _buildMountains(this._group);
        _buildBaseGround(this._group);
        _buildRoad(this._group, this._segs);
        _buildTrees(this._group, this._treesL, -1);
        _buildTrees(this._group, this._treesR,  1);
        _buildSigns(this._group, this._signsL, this._neonSigns, -1);
        _buildSigns(this._group, this._signsR, this._neonSigns,  1);
        _buildCars(this._group, this._cars);
    }

    update(reactive, delta) {
        this._speedBoost *= 0.96;
        this._beatFlash  *= Math.pow(0.82, delta * 60);
        this._beatPulse  *= Math.pow(0.88, delta * 60);
        this._time       += delta;

        const speed = 0.12 + reactive.bassEnergy * 0.28 + this._speedBoost;

        // ── Curve ─────────────────────────────────────────────────────────────
        this._curveTimer -= delta;
        if (this._curveTimer <= 0) {
            const r = Math.random();
            this._curveTarget = r < 0.33 ? 0 : (r < 0.66 ? 3.5 : -3.5);
            this._curveTimer  = 3.5 + Math.random() * 2.5;
        }
        this._curveDrift += (this._curveTarget - this._curveDrift) * delta * 1.2;

        // ── Pulso de color en el cielo ────────────────────────────────────────
        const skyT = Math.min(1.0, this._beatPulse * 0.85 + reactive.bassEnergy * 0.3);
        for (const { mat, base, peak } of this._skyMats) {
            mat.color.lerpColors(base, peak, skyT);
        }

        // ── Pulso de escala del sol ───────────────────────────────────────────
        if (this._sunMesh) {
            const s = 1.0 + this._beatFlash * 0.12 + reactive.bassEnergy * 0.06;
            this._sunMesh.scale.setScalar(Math.min(1.35, s));
        }

        // ── Brillo de estrellas / sol / horizonte (más reactivo al beat) ──────
        const baseEmi = 1.5 + reactive.highsEnergy * 3.0 + reactive.bassEnergy * 1.2 + this._beatFlash * 2.5;
        for (const f of this._glitters) {
            if (!f.material?.emissive) continue;
            f.material.emissiveIntensity = Math.max(0.4,
                baseEmi + Math.sin(this._time * 13 + (f.userData.seed ?? 0)) * 0.9
                        + (Math.random() - 0.5) * 0.3);
        }

        // ── Carteles de neón ──────────────────────────────────────────────────
        const signEmi = 1.0 + reactive.midsEnergy * 2.5 + this._beatFlash * 5.5;
        for (const { mat, seed } of this._neonSigns) {
            mat.emissiveIntensity = Math.min(9.0,
                signEmi + Math.sin(this._time * 8.0 + seed) * 0.5);
        }

        // ── Segmentos de carretera ────────────────────────────────────────────
        const borderT = Math.min(1.0, this._beatFlash * 0.45 + reactive.bassEnergy * 0.3);
        const grassT  = Math.min(0.8, reactive.bassEnergy * 0.4 + this._beatFlash * 0.18);

        for (const s of this._segs) {
            s.z += speed;
            if (s.z > NEAR_Z) {
                s.z -= TOTAL_Z;
                s.stripe ^= 1;
                _applyStripe(s);
            }
            const t = Math.max(0, Math.min(1, (NEAR_Z - s.z) / (NEAR_Z - FAR_Z)));
            s.group.position.z = s.z;
            s.group.position.x = this._curveDrift * t;

            // Bordillos flashean al beat
            this._tmpCol.lerpColors(this._borderBase[s.stripe], this._borderPeak[s.stripe], borderT);
            s.bL.material.color.copy(this._tmpCol);
            s.bR.material.color.copy(this._tmpCol);

            // Hierba se intensifica con el bajo
            this._tmpCol.lerpColors(this._grassBase[s.stripe], this._grassPeak[s.stripe], grassT);
            s.gL.material.color.copy(this._tmpCol);
            s.gR.material.color.copy(this._tmpCol);
        }

        // ── Árboles ───────────────────────────────────────────────────────────
        for (const side of [-1, 1]) {
            const arr = side < 0 ? this._treesL : this._treesR;
            for (const tr of arr) {
                tr.z += speed;
                if (tr.z > NEAR_Z + 1) tr.z -= TOTAL_Z;
                const t = Math.max(0, Math.min(1, (NEAR_Z - tr.z) / (NEAR_Z - FAR_Z)));
                tr.group.position.z = tr.z;
                tr.group.position.x = side * tr.sideX + this._curveDrift * t;
            }
        }

        // ── Carteles (mismo scroll que árboles) ───────────────────────────────
        for (const side of [-1, 1]) {
            const arr = side < 0 ? this._signsL : this._signsR;
            for (const sg of arr) {
                sg.z += speed;
                if (sg.z > NEAR_Z + 1) sg.z -= TOTAL_Z;
                const t = Math.max(0, Math.min(1, (NEAR_Z - sg.z) / (NEAR_Z - FAR_Z)));
                sg.group.position.z = sg.z;
                sg.group.position.x = side * sg.sideX + this._curveDrift * t;
            }
        }

        // ── Coches ────────────────────────────────────────────────────────────
        for (const car of this._cars) {
            car.z += speed * car.relSpeed;
            if (car.z > NEAR_Z + 2) {
                car.z = FAR_Z - 1 - Math.random() * 8;
            }
            const t = Math.max(0, Math.min(1, (NEAR_Z - car.z) / (NEAR_Z - FAR_Z)));
            car.group.position.z = car.z;
            car.group.position.x = car.lane * LANE_X + this._curveDrift * t;
        }
    }

    onBeat()  { this._beatFlash = 3.5; this._beatPulse = 1.0; this._speedBoost += 0.14; }
    onTap()   { this._beatFlash = 2.0; this._beatPulse = 0.6; }
    onSwipe(dir) {
        if (dir === 'up')   this._speedBoost += 0.22;
        if (dir === 'down') this._speedBoost = Math.max(0, this._speedBoost - 0.08);
    }

    dispose() {
        this._group?.traverse(child => {
            if (!child.isMesh) return;
            child.geometry?.dispose();
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => m?.dispose());
        });
        this._group?.parent?.remove(this._group);
        this._group     = null;
        this._segs      = [];
        this._treesL    = [];
        this._treesR    = [];
        this._signsL    = [];
        this._signsR    = [];
        this._glitters  = [];
        this._neonSigns = [];
        this._cars      = [];
        this._sunMesh   = null;
        this._skyMats   = [];
    }
}

// ── Sky ───────────────────────────────────────────────────────────────────────

function _buildSky(group, glitters, skyMats) {
    // Bandas con colores base y peak (hacia dónde shiftan en el beat)
    const bandDefs = [
        { y:  22, h: 16, col: '#0d0528', peak: '#1a0840' },
        { y:  10, h:  9, col: '#1a0844', peak: '#2d1266' },
        { y:   4, h:  7, col: '#6b0f5a', peak: '#c01a9a' },
        { y:   0, h:  5, col: '#c42060', peak: '#ff2878' },
        { y:  -2, h:  3, col: '#ff6832', peak: '#ff9020' },
        { y: -3.6, h: 2.2, col: '#ffcc44', peak: '#ffee60' },
    ];
    for (const { y, h, col, peak } of bandDefs) {
        const mat = _flat(col);
        skyMats.push({ mat, base: new THREE.Color(col), peak: new THREE.Color(peak) });
        _bm(group, 130, h, 0.1, mat, 0, y, -46);
    }

    // Sol
    const sunMat = new THREE.MeshStandardMaterial({
        color: '#ffe600', emissive: '#ffe600', emissiveIntensity: 5.5,
        roughness: 0, metalness: 0,
    });
    const sun = _bm(group, 5.2, 5.2, 0.2, sunMat, -2.5, 0.5, -45.5);
    sun.userData.seed = 7;
    glitters.push(sun);

    // Líneas horizontales del sol (estilo Outrun clásico)
    const scanMat = _flat('#1a0844');
    for (let i = 0; i < 8; i++) {
        _bm(group, 5.4, 0.10, 0.15, scanMat, -2.5, -1.2 + i * 0.28, -45.4);
    }

    // Halo del sol
    const haloMat = new THREE.MeshStandardMaterial({
        color: '#ff5020', emissive: '#ff5020', emissiveIntensity: 2.0,
        transparent: true, opacity: 0.32,
    });
    const halo = _bm(group, 9.5, 9.5, 0.15, haloMat, -2.5, 0.5, -46);
    halo.userData.seed = 13;
    glitters.push(halo);

    // Brillo de horizonte
    const horizMat = new THREE.MeshStandardMaterial({
        color: '#ff8040', emissive: '#ff8040', emissiveIntensity: 1.5,
        transparent: true, opacity: 0.42,
    });
    const horiz = _bm(group, 130, 1.0, 0.1, horizMat, 0, ROAD_Y + 0.3, -45.5);
    horiz.userData.seed = 21;
    glitters.push(horiz);

    // Estrellas
    const starMat = new THREE.MeshStandardMaterial({
        color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 3.0,
        transparent: true, opacity: 0.7,
    });
    const sRand = _seededRand(44);
    for (let i = 0; i < 32; i++) {
        const s    = 0.05 + sRand() * 0.10;
        const star = _bm(group, s, s, 0.08, starMat,
            (sRand() - 0.5) * 90, 9 + sRand() * 14, -45.8);
        star.userData.seed = sRand() * 60;
        glitters.push(star);
    }

    // Siluetas de palmeras en el horizonte
    const silMat = _flat('#2a0a44');
    const sil = _seededRand(88);
    for (let i = 0; i < 8; i++) {
        const x = -55 + i * 16 + sil() * 6;
        const h = 4 + sil() * 5;
        _bm(group, 0.22, h, 0.1, silMat, x, ROAD_Y + h / 2, -44.5);
        for (let l = 0; l < 5; l++) {
            const a = -Math.PI * 0.65 + (l / 4) * Math.PI * 1.3;
            const ll = 0.8 + sil() * 1.4;
            const leaf = new THREE.Mesh(new THREE.BoxGeometry(ll, 0.12, 0.06), silMat);
            leaf.position.set(Math.cos(a) * ll * 0.46, ROAD_Y + h + Math.sin(a) * ll * 0.36, -44.5);
            leaf.rotation.z = a;
            group.add(leaf);
        }
    }

    return sun;
}

// ── Mountains ─────────────────────────────────────────────────────────────────

function _buildMountains(group) {
    const rand = _seededRand(55);
    const cols = ['#4b1a6e', '#3a1558', '#5a2280', '#2a0e44'];
    for (let i = 0; i < 14; i++) {
        const x   = (i - 7) * 13 + rand() * 8;
        const h   = 3.0 + rand() * 5.5;
        const w   = 7.0 + rand() * 11;
        const col = cols[Math.floor(rand() * 4)];
        _bm(group, w,         h * 0.50, 0.5, _flat(col), x, ROAD_Y + h * 0.25, -41.5);
        _bm(group, w * 0.72,  h * 0.55, 0.5, _flat(col), x, ROAD_Y + h * 0.58, -42);
        _bm(group, w * 0.42,  h * 0.40, 0.5, _flat(col), x, ROAD_Y + h * 0.86, -42.5);
    }
}

// ── Base ground plane ─────────────────────────────────────────────────────────

function _buildBaseGround(group) {
    _bm(group, 200, 0.06, 100, _flat(GRASS_COLS[0]), 0, ROAD_Y - 0.01, -22);
}

// ── Road segments ─────────────────────────────────────────────────────────────

function _buildRoad(group, segs) {
    for (let i = 0; i < NUM_SEGS; i++) {
        const z      = FAR_Z + i * SEG_D + SEG_D * 0.5;
        const stripe = i % 2;
        const g      = new THREE.Group();
        g.position.set(0, ROAD_Y, z);

        const road = _bm(g, ROAD_W,   0.08, SEG_D, _flat(ROAD_COLS[stripe]),    0, 0, 0);
        const gL   = _bm(g, GRASS_W,  0.06, SEG_D, _flat(GRASS_COLS[stripe]),  -(ROAD_W / 2 + GRASS_W / 2),  -0.01, 0);
        const gR   = _bm(g, GRASS_W,  0.06, SEG_D, _flat(GRASS_COLS[stripe]),   (ROAD_W / 2 + GRASS_W / 2),  -0.01, 0);
        const bL   = _bm(g, BORDER_W, 0.10, SEG_D, _flat(BORDER_COLS[stripe]), -(ROAD_W / 2 + BORDER_W / 2),  0.01, 0);
        const bR   = _bm(g, BORDER_W, 0.10, SEG_D, _flat(BORDER_COLS[stripe]),  (ROAD_W / 2 + BORDER_W / 2),  0.01, 0);
        const dash = _bm(g, 0.18, 0.09, SEG_D * 0.55, _flat('#f0f0f0'), 0, 0.01, 0);
        dash.visible = stripe === 0;

        group.add(g);
        segs.push({ group: g, z, stripe, road, gL, gR, bL, bR, dash });
    }
}

function _applyStripe(s) {
    s.road.material.color.set(ROAD_COLS[s.stripe]);
    s.gL.material.color.set(GRASS_COLS[s.stripe]);
    s.gR.material.color.set(GRASS_COLS[s.stripe]);
    s.bL.material.color.set(BORDER_COLS[s.stripe]);
    s.bR.material.color.set(BORDER_COLS[s.stripe]);
    s.dash.visible = s.stripe === 0;
}

// ── Roadside trees ────────────────────────────────────────────────────────────

function _buildTrees(group, treesArr, side) {
    const rand    = _seededRand(side > 0 ? 33 : 77);
    const spacing = TOTAL_Z / NUM_TREES;

    for (let i = 0; i < NUM_TREES; i++) {
        const sideX = 4.2 + rand() * 3.0;
        const z     = FAR_Z + i * spacing + rand() * spacing * 0.55;
        const g     = new THREE.Group();
        g.position.set(side * sideX, ROAD_Y, z);

        if (rand() > 0.18) {
            _buildPalm(g, rand);
        } else {
            _buildPole(g, rand);
        }

        group.add(g);
        treesArr.push({ group: g, z, sideX });
    }
}

function _buildPalm(parent, rand) {
    const h        = 2.5 + rand() * 4.0;
    const lean     = (rand() - 0.5) * 0.18;
    const trunkMat = _flat('#5a3a1a');
    const notchMat = _flat('#4a2a10');

    for (let s = 0; s < 5; s++) {
        const sw = Math.max(0.07, 0.20 - s * 0.022);
        _bm(parent, sw, h / 5 + 0.04, sw, trunkMat, lean * s * 0.28, h * (s / 5) + h / 10, 0);
    }
    for (let n = 1; n < 5; n++) {
        _bm(parent, 0.24, 0.03, 0.24, notchMat, lean * n * 0.10, h * n / 5, 0);
    }

    const greens = ['#1a6b1a', '#228822', '#165014', '#2a8a28', '#0e5010'];
    for (let l = 0; l < 7; l++) {
        const angle = -Math.PI * 0.72 + (l / 6) * Math.PI * 1.44;
        const llen  = 0.9 + rand() * 1.8;
        const leaf  = new THREE.Mesh(
            new THREE.BoxGeometry(llen, 0.12, 0.07),
            _flat(greens[Math.floor(rand() * 5)])
        );
        leaf.position.set(
            Math.cos(angle) * llen * 0.47 + lean * 3.5 * 0.16,
            h + Math.sin(angle) * llen * 0.37 + 0.08,
            0
        );
        leaf.rotation.z = angle;
        parent.add(leaf);
    }

    if (rand() > 0.45) {
        const cocoMat = _flat('#6b3f10');
        for (let c = 0; c < 3; c++) {
            _bm(parent, 0.14, 0.14, 0.14, cocoMat,
                (rand() - 0.5) * 0.28 + lean * 3 * 0.16,
                h - 0.18, (rand() - 0.5) * 0.18);
        }
    }
}

function _buildPole(parent, rand) {
    const stripeCols = ['#cc2200', '#f5f5f5'];
    _bm(parent, 0.10, 2.8, 0.10, _flat('#aaaaaa'), 0, 1.4, 0);
    for (let s = 0; s < 5; s++) {
        _bm(parent, 0.12, 0.28, 0.12, _flat(stripeCols[s % 2]), 0, 0.4 + s * 0.52, 0);
    }
    const capCols = ['#ff2200', '#00ccff', '#ffcc00'];
    _bm(parent, 0.22, 0.14, 0.22, _flat(capCols[Math.floor(rand() * 3)]), 0, 2.87, 0);
}

// ── Carteles de neón (scrollean igual que los árboles) ────────────────────────

function _buildSigns(group, signsArr, neonSigns, side) {
    const rand    = _seededRand(side > 0 ? 401 : 503);
    const cols    = ['#ff1a88', '#00aaff', '#ffcc00', '#ff4400', '#aa22ff'];
    const count   = 4;
    const spacing = TOTAL_Z / count;

    for (let i = 0; i < count; i++) {
        const sideX = 8.5 + rand() * 2.5;
        const z     = FAR_Z + i * spacing + rand() * spacing * 0.4;
        const col   = cols[Math.floor(rand() * cols.length)];
        const g     = new THREE.Group();
        g.position.set(side * sideX, ROAD_Y, z);

        // Poste
        _bm(g, 0.10, 4.2, 0.10, _flat('#555566'), 0, 2.1, 0);

        // Panel principal
        const boardMat = new THREE.MeshStandardMaterial({
            color: col, emissive: col, emissiveIntensity: 2.5,
            roughness: 0, metalness: 0.5,
        });
        const board = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.1, 0.12), boardMat);
        board.position.set(0, 4.7, 0);
        g.add(board);
        neonSigns.push({ mat: boardMat, seed: rand() * 100 });

        // Marcos superior e inferior (blanco neón)
        for (const fy of [5.27, 4.13]) {
            const fMat = new THREE.MeshStandardMaterial({
                color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 2.0,
                roughness: 0, metalness: 0,
            });
            const strip = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 0.16), fMat);
            strip.position.set(0, fy, 0);
            g.add(strip);
            neonSigns.push({ mat: fMat, seed: rand() * 100 });
        }

        group.add(g);
        signsArr.push({ group: g, z, sideX });
    }
}

// ── Cars ──────────────────────────────────────────────────────────────────────

const CAR_COLS = ['#cc1100', '#0033dd', '#ddbb00', '#ffffff', '#ff5500'];

function _buildCars(group, cars) {
    const rand    = _seededRand(123);
    const darkMat = _flat('#111111');
    const winMat  = _flat('#223355');

    for (let i = 0; i < NUM_CARS; i++) {
        const g       = new THREE.Group();
        const bodyMat = _flat(CAR_COLS[i % CAR_COLS.length]);

        _bm(g, 1.20, 0.30, 2.20, bodyMat, 0,     0.15, 0);
        _bm(g, 0.86, 0.22, 0.95, bodyMat, 0,     0.41, 0.08);
        _bm(g, 0.76, 0.18, 0.05, winMat,  0,     0.41,  0.55);
        _bm(g, 0.76, 0.18, 0.05, winMat,  0,     0.41, -0.39);
        for (const [wx, wz] of [[-0.56, -0.76], [0.56, -0.76], [-0.56, 0.76], [0.56, 0.76]]) {
            _bm(g, 0.14, 0.16, 0.36, darkMat, wx, -0.02, wz);
        }
        _bm(g, 0.18, 0.07, 0.04, _flat('#ffffcc'), -0.38, 0.14,  1.13);
        _bm(g, 0.18, 0.07, 0.04, _flat('#ffffcc'),  0.38, 0.14,  1.13);
        _bm(g, 0.18, 0.07, 0.04, _flat('#ff2200'), -0.38, 0.14, -1.13);
        _bm(g, 0.18, 0.07, 0.04, _flat('#ff2200'),  0.38, 0.14, -1.13);

        const lane     = (i % 2 === 0) ? -1 : 1;
        const z        = FAR_Z + (i / NUM_CARS) * TOTAL_Z * 0.72;
        const relSpeed = 0.90 + rand() * 0.25;

        g.position.set(lane * LANE_X, ROAD_Y, z);
        group.add(g);
        cars.push({ group: g, z, lane, relSpeed });
    }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function _flat(hex) {
    return new THREE.MeshBasicMaterial({ color: new THREE.Color(hex) });
}

function _bm(parent, w, h, d, mat, px, py, pz) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(px, py, pz);
    parent.add(m);
    return m;
}

function _seededRand(seed) {
    let s = (seed * 9301 + 49297) >>> 0;
    return () => { s = Math.imul(48271, s) >>> 0; return s / 0xffffffff; };
}
