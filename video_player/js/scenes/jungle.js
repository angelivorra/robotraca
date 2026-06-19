import * as THREE from 'three';

const GROUND_Y = -2.0;
const SCROLL_W = 30;
const WRAP_MID = 40;
const WRAP_FAR = 60;

const PALETTES = [
    { skin: '#ffccaa', shirt: '#ff3366', pants: '#ff3366', shoes: '#ffee88', hair: '#331100' },
    { skin: '#ffccaa', shirt: '#3388ff', pants: '#3388ff', shoes: '#ffffaa', hair: '#221100' },
    { skin: '#ffddbb', shirt: '#ff8800', pants: '#ff8800', shoes: '#ffff88', hair: '#662200' },
    { skin: '#ffbbaa', shirt: '#22cc66', pants: '#22cc66', shoes: '#ffddaa', hair: '#000000' },
    { skin: '#c08050', shirt: '#ff55cc', pants: '#ff55cc', shoes: '#ffee88', hair: '#220000' },
    { skin: '#cc9966', shirt: '#ffee00', pants: '#ffee00', shoes: '#ffddaa', hair: '#331100' },
];

const SPARKLE_COLS = ['#88ddff', '#aaeeff', '#ffffff', '#66ccff', '#ddf4ff'];
const BIKE_COLORS  = ['#ff3344', '#44aaff', '#ffcc00', '#22dd88', '#ff7700', '#cc44ff'];

export class JungleScene {
    get useBloom() { return this._useBloom; }

    constructor() {
        this._group      = null;
        this._time       = 0;
        this._speedBoost = 0;
        this._beatFlash  = 0;
        this._useBloom   = false;
        this._theme      = null;

        this._bathers  = [];
        this._bikes    = [];
        this._glitters = [];
        this._farPalms = [];
        this._midObjs  = [];
    }

    init(threeScene, theme) {
        this._theme = theme;
        this._group = new THREE.Group();
        threeScene.add(this._group);

        threeScene.background = new THREE.Color('#87ceeb');
        threeScene.fog = new THREE.FogExp2(new THREE.Color('#c8e8f8'), 0.010);

        _buildSky(this._group, this._glitters);
        _buildGround(this._group);
        _buildFarLayer(this._group, this._farPalms);
        _buildMidLayer(this._group, this._midObjs, this._glitters);
        _spawnForeground(this._group, this._bathers, this._bikes, theme);
    }

    update(reactive, delta) {
        this._speedBoost *= 0.96;
        this._beatFlash  *= 0.82;
        this._time       += delta;

        const speed = 0.038 + reactive.bassEnergy * 0.12 + this._speedBoost;

        // Water / sun sparkle flicker
        const baseEmi = 1.5 + reactive.highsEnergy * 3.0 + this._beatFlash * 0.4;
        for (const f of this._glitters) {
            if (!f.material?.emissive) continue;
            f.material.emissiveIntensity = Math.max(0.2,
                baseEmi + Math.sin(this._time * 16 + (f.userData.seed ?? 0)) * 0.7 + (Math.random() - 0.5) * 0.3);
            f.scale.y = 0.6 + Math.random() * 0.8;
            f.scale.x = 0.7 + Math.random() * 0.6;
        }

        // Far palm parallax
        for (const el of this._farPalms) {
            el.group.position.x -= speed * 0.18;
            if (el.group.position.x < -WRAP_FAR) el.group.position.x += WRAP_FAR * 2;
        }

        // Mid objects parallax
        for (const el of this._midObjs) {
            el.group.position.x -= speed * 0.48;
            if (el.group.position.x < -WRAP_MID) el.group.position.x += WRAP_MID * 2;
        }

        // Bathers walk + scroll
        for (const h of this._bathers) {
            const t = this._time * 3.2 * h.walkSpeed + h.phase;
            _animateHuman(h.group, t);
            h.group.position.x -= speed * (0.55 + h.walkSpeed * 0.1);
            h.group.position.y = GROUND_Y + Math.abs(Math.sin(t * 2)) * 0.04 * h.group.scale.x;
            if (h.group.position.x < -SCROLL_W / 2 - 1) {
                h.group.position.x = SCROLL_W / 2 + 1 + Math.random() * 4;
                h.group.position.z = -0.4 + Math.random() * 1.2;
            }
        }

        // Bikes scroll + wheel spin
        for (const b of this._bikes) {
            b.group.position.x -= speed * b.scrollMult;
            b.wPF.rotation.z -= speed * 3.2;
            b.wPR.rotation.z -= speed * 3.2;
            if (b.group.position.x < -SCROLL_W / 2 - 3) {
                b.group.position.x = SCROLL_W / 2 + 2 + Math.random() * 6;
                b.group.position.z = -0.3 + Math.random() * 0.6;
            }
        }
    }

    onBeat()  { this._beatFlash = 3.0; this._speedBoost += 0.08; }
    onTap()   { this._beatFlash = 2.0; }
    onSwipe(dir) {
        if (dir === 'up')   this._speedBoost += 0.18;
        if (dir === 'down') this._speedBoost = Math.max(0, this._speedBoost - 0.06);
    }

    dispose() {
        this._group?.traverse(child => {
            if (!child.isMesh) return;
            child.geometry?.dispose();
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => m?.dispose());
        });
        this._group?.parent?.remove(this._group);
        this._group    = null;
        this._bathers  = [];
        this._bikes    = [];
        this._glitters = [];
        this._farPalms = [];
        this._midObjs  = [];
    }
}

// ── Sky ───────────────────────────────────────────────────────────────────────

function _buildSky(group, glitters) {
    // Sky gradient bands top → horizon
    const skyBands = [
        { y:  7.5, h: 4.0, col: '#1a6699' },
        { y:  4.8, h: 3.5, col: '#2a8fcc' },
        { y:  2.5, h: 3.0, col: '#44aadd' },
        { y:  0.8, h: 2.0, col: '#77ccee' },
    ];
    for (const { y, h, col } of skyBands) {
        _bm(group, 220, h, 0.1, _flat(col), 0, y, -13);
    }

    // Sea bands (horizon to ground)
    const seaBands = [
        { y:  0.5, h: 1.8, col: '#004d88' },
        { y: -0.5, h: 1.2, col: '#0077aa' },
        { y: -1.3, h: 1.0, col: '#0099bb' },
        { y: -1.85, h: 0.22, col: '#55ccee' }, // foam
    ];
    for (const { y, h, col } of seaBands) {
        _bm(group, 220, h, 0.1, _flat(col), 0, y, -11);
    }

    // Water sparkles
    const rand = _seededRand(99);
    for (let i = 0; i < 22; i++) {
        const x   = (i - 11) * 11 + rand() * 7;
        const col = SPARKLE_COLS[Math.floor(rand() * SPARKLE_COLS.length)];
        const sMat = new THREE.MeshStandardMaterial({
            color: col, emissive: col, emissiveIntensity: 2.0,
            transparent: true, opacity: 0.85, roughness: 0.0, metalness: 0.0,
        });
        const sp = _bm(group, 0.22 + rand() * 0.55, 0.09, 0.04, sMat,
            x, -0.5 + rand() * 1.2, -10.5);
        sp.userData.seed = rand() * 100;
        glitters.push(sp);
    }

    // Sun
    const sunMat = new THREE.MeshStandardMaterial({
        color: '#ffee55', emissive: '#ffee55', emissiveIntensity: 4.5,
        roughness: 0.0, metalness: 0.0,
    });
    const sun = _bm(group, 1.0, 1.0, 0.22, sunMat, -5.0, 5.5, -12.5);
    sun.userData.seed = 7;
    glitters.push(sun);

    // Sun rays
    const rayMat = new THREE.MeshStandardMaterial({
        color: '#ffdd44', emissive: '#ffdd44', emissiveIntensity: 2.5,
        transparent: true, opacity: 0.38, roughness: 0.0, metalness: 0.0,
    });
    for (let a = 0; a < 8; a++) {
        const ray = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.5, 0.04), rayMat);
        ray.position.set(-5.0, 5.5, -12.6);
        ray.rotation.z = (a / 8) * Math.PI;
        group.add(ray);
        ray.userData.seed = a * 11;
        glitters.push(ray);
    }

    // Clouds
    const cloudMat = _flat('#eef8ff');
    const cRand = _seededRand(55);
    for (let i = 0; i < 6; i++) {
        const cx = (i - 3) * 22 + cRand() * 10;
        const cy = 2.5 + cRand() * 2.5;
        const cw = 4.5 + cRand() * 4;
        _bm(group, cw,          0.65, 0.5, cloudMat,  cx,              cy,       -12.5);
        _bm(group, cw * 0.65,   0.92, 0.5, cloudMat,  cx + 0.4,        cy + 0.48, -12.5);
        _bm(group, cw * 0.55,   0.78, 0.5, cloudMat,  cx - cw * 0.28,  cy + 0.28, -12.5);
    }

    // Birds (tiny V silhouettes)
    const birdMat = _flat('#224466');
    const bRand = _seededRand(77);
    for (let i = 0; i < 8; i++) {
        const bx = (bRand() - 0.5) * 40;
        const by = 2.8 + bRand() * 2.8;
        const s  = 0.10 + bRand() * 0.14;
        const lw = new THREE.Mesh(new THREE.BoxGeometry(s, 0.04, 0.04), birdMat);
        lw.position.set(bx - s * 0.5, by, -12.3);
        lw.rotation.z =  0.42;
        group.add(lw);
        const rw = new THREE.Mesh(new THREE.BoxGeometry(s, 0.04, 0.04), birdMat);
        rw.position.set(bx + s * 0.5, by, -12.3);
        rw.rotation.z = -0.42;
        group.add(rw);
    }
}

// ── Ground ────────────────────────────────────────────────────────────────────

function _buildGround(group) {
    _bm(group, 220, 0.18, 7, _flat('#e8d5a3'), 0, GROUND_Y - 0.09, 0);
    _bm(group, 220, 0.10, 2, _flat('#f0e4b8'), 0, GROUND_Y + 0.04, -1.5);
    _bm(group, 220, 0.08, 1, _flat('#c4a882'), 0, GROUND_Y + 0.03, -3.2);
    const pMat = _flat('#d8c8a0');
    const rand = _seededRand(33);
    for (let x = -80; x < 80; x += 3.0) {
        const ps = 0.08 + rand() * 0.14;
        _bm(group, ps, 0.05, ps, pMat,
            x + (rand() - 0.5) * 2.5, GROUND_Y + 0.02, (rand() - 0.5) * 3.0);
    }
}

// ── Far layer: jungle silhouettes (z ≈ -9) ───────────────────────────────────

function _buildFarLayer(group, farPalms) {
    const rand = _seededRand(42);
    for (let i = 0; i < 26; i++) {
        const x = (i - 13) * 5.0 + rand() * 3.5;
        const h = 2.0 + rand() * 6.5;
        const g = new THREE.Group();
        g.position.set(x, GROUND_Y, -9);

        const tw = 0.18 + rand() * 0.12;
        _bm(g, tw, h, tw, _flat('#1a4018'), 0, h / 2, 0);

        // Fronds fanning in XY plane
        const leafMat = _flat('#164814');
        for (let l = 0; l < 5; l++) {
            const angle = -Math.PI * 0.7 + (l / 4) * Math.PI * 1.4;
            const llen  = 0.6 + rand() * 1.3;
            const leaf  = new THREE.Mesh(new THREE.BoxGeometry(llen, 0.14, 0.08), leafMat);
            leaf.position.set(Math.cos(angle) * llen * 0.5, h + Math.sin(angle) * llen * 0.38 + 0.1, 0);
            leaf.rotation.z = angle;
            g.add(leaf);
        }

        group.add(g);
        farPalms.push({ group: g });
    }
}

// ── Mid layer: palms + umbrellas (z ≈ -4.5) ──────────────────────────────────

function _buildMidLayer(group, midObjs, glitters) {
    const rand = _seededRand(87);
    for (let i = 0; i < 16; i++) {
        const x = (i - 8) * 5.8 + rand() * 3.8;
        const g = new THREE.Group();
        g.position.set(x, GROUND_Y, -4.5);
        if (rand() > 0.45) {
            _buildPalm(g, rand);
        } else {
            _buildUmbrella(g, rand, glitters);
        }
        group.add(g);
        midObjs.push({ group: g });
    }
}

function _buildPalm(parent, rand) {
    const h = 2.2 + rand() * 3.8;
    const trunkCols = ['#8b5e3c', '#7a5230', '#6b4a28', '#9a6840'];
    const trunkCol  = trunkCols[Math.floor(rand() * trunkCols.length)];
    const lean = (rand() - 0.5) * 0.26;

    // Trunk segments
    const notchMat = _flat('#5a3a1a');
    for (let s = 0; s < 5; s++) {
        const sw = Math.max(0.07, 0.21 - s * 0.025);
        _bm(parent, sw, h / 5 + 0.04, sw, _flat(trunkCol), lean * s * 0.3, h * (s / 5) + h / 10, 0);
    }
    for (let n = 1; n < 5; n++) {
        _bm(parent, 0.26, 0.04, 0.26, notchMat, lean * n * 0.12, h * n / 5, 0);
    }

    // Fronds
    const greens = ['#2d9b2d', '#228b22', '#38aa38', '#1a7a1a', '#33bb33'];
    for (let l = 0; l < 7; l++) {
        const angle = -Math.PI * 0.75 + (l / 6) * Math.PI * 1.5;
        const llen  = 1.0 + rand() * 1.7;
        const leaf  = new THREE.Mesh(
            new THREE.BoxGeometry(llen, 0.13, 0.07),
            _flat(greens[Math.floor(rand() * greens.length)])
        );
        leaf.position.set(
            Math.cos(angle) * llen * 0.48 + lean * 3.5 * 0.18,
            h + Math.sin(angle) * llen * 0.38 + 0.1,
            0
        );
        leaf.rotation.z = angle;
        parent.add(leaf);
    }

    // Coconuts
    if (rand() > 0.4) {
        const cocoMat = _flat('#6b4010');
        for (let c = 0; c < 3; c++) {
            _bm(parent, 0.16, 0.16, 0.16, cocoMat,
                (rand() - 0.5) * 0.3 + lean * 3 * 0.18,
                h - 0.22, (rand() - 0.5) * 0.2);
        }
    }
}

function _buildUmbrella(parent, rand, glitters) {
    const cols    = ['#ff3333', '#3388ff', '#ffcc00', '#22cc66', '#ff55aa', '#ff8800'];
    const col     = cols[Math.floor(rand() * cols.length)];
    const stripeMat = _flat('#ffffff');

    _bm(parent, 0.06, 2.2, 0.06, _flat('#cccccc'), 0, 1.1, 0);  // pole
    _bm(parent, 2.5,  0.09, 2.5, _flat(col), 0, 2.2, 0);        // canopy disk
    _bm(parent, 1.8,  0.20, 1.8, _flat(col), 0, 2.26, 0);        // dome bump
    _bm(parent, 2.7,  0.14, 2.7, _flat(col), 0, 2.10, 0);        // fringe

    for (let s = 0; s < 4; s++) {
        _bm(parent, 0.14, 0.10, 2.5, stripeMat, -0.90 + s * 0.60, 2.21, 0);
    }

    // Lounger / towel beneath
    if (rand() > 0.35) {
        const towelCols = ['#ff5555', '#5599ff', '#55cc55', '#ffaa33'];
        _bm(parent, 0.92, 0.04, 0.46, _flat(towelCols[Math.floor(rand() * 4)]), 0, 0.02, 0.1);
        _bm(parent, 0.82, 0.10, 0.22, _flat('#ffccaa'), 0, 0.10, 0.1); // lying silhouette
    }

    // Optional beach sign glow
    if (rand() > 0.7) {
        const signCols = ['#ff4488', '#44aaff', '#ffcc00'];
        const sc = signCols[Math.floor(rand() * 3)];
        const sMat = new THREE.MeshStandardMaterial({
            color: sc, emissive: sc, emissiveIntensity: 1.5,
            transparent: true, opacity: 0.8,
        });
        const sign = _bm(parent, 0.8, 0.22, 0.08, sMat, 0, 1.5, 0.28);
        sign.userData.seed = rand() * 100;
        glitters.push(sign);
    }
}

// ── Foreground: bathers + cyclists ───────────────────────────────────────────

function _spawnForeground(group, bathers, bikes, theme) {
    const zDepths = [-0.5, 0.1, 0.4, -0.2, 0.8, -0.6, 0.2, 0.5];
    for (let i = 0; i < 8; i++) {
        const x     = (i - 4) * (SCROLL_W / 8) + (Math.random() - 0.5) * 2;
        const z     = zDepths[i];
        const scale = 0.65 + Math.random() * 0.35;
        const pal   = PALETTES[i % PALETTES.length];
        const phase = (i / 8) * Math.PI * 2;
        const spd   = 0.55 + Math.random() * 0.4;
        const h     = _buildHuman(group, x, GROUND_Y, z, pal, scale);
        bathers.push({ group: h, phase, walkSpeed: spd });
    }

    const bikeZs = [-0.1, 0.3, -0.3, 0.5];
    for (let i = 0; i < 4; i++) {
        const x   = (i - 2) * (SCROLL_W / 4) + (Math.random() - 0.5) * 3;
        const z   = bikeZs[i];
        const col = BIKE_COLORS[i % BIKE_COLORS.length];
        const pal = PALETTES[(i + 1) % PALETTES.length];
        const b   = _buildBike(group, x, GROUND_Y, z, col, pal);
        bikes.push({ group: b.root, scrollMult: 1.1 + Math.random() * 0.6, wPF: b.wPF, wPR: b.wPR });
    }
}

// ── Human figure (same SNES proportions as apocalypse) ────────────────────────

function _buildHuman(scene, x, groundY, z, pal, scale) {
    const root = new THREE.Group();
    root.position.set(x, groundY, z);
    root.scale.setScalar(scale);

    const ms = _flat(pal.skin);
    const mt = _flat(pal.shirt);
    const mp = _flat(pal.pants);
    const mh = _flat(pal.shoes);
    const mr = _flat(pal.hair);

    _bm(root, 0.42, 0.44, 0.30, ms, 0, 1.62, 0);
    _bm(root, 0.44, 0.14, 0.32, mr, 0, 1.90, 0);
    const eyeMat = _flat('#111111');
    _bm(root, 0.08, 0.08, 0.04, eyeMat, -0.10, 1.66, 0.15);
    _bm(root, 0.08, 0.08, 0.04, eyeMat,  0.10, 1.66, 0.15);
    _bm(root, 0.38, 0.46, 0.26, mt, 0, 1.18, 0);

    const pv = (parent, px, py, pz) => {
        const g = new THREE.Group(); g.position.set(px, py, pz); parent.add(g); return g;
    };

    const lS = pv(root,  0.25, 1.42, 0);
    const rS = pv(root, -0.25, 1.42, 0);
    _bm(lS, 0.15, 0.34, 0.15, mt, 0, -0.17, 0);
    _bm(rS, 0.15, 0.34, 0.15, mt, 0, -0.17, 0);
    const lE = pv(lS, 0, -0.34, 0);
    const rE = pv(rS, 0, -0.34, 0);
    _bm(lE, 0.13, 0.28, 0.13, ms, 0, -0.14, 0);
    _bm(rE, 0.13, 0.28, 0.13, ms, 0, -0.14, 0);

    const lH = pv(root,  0.12, 0.94, 0);
    const rH = pv(root, -0.12, 0.94, 0);
    _bm(lH, 0.19, 0.44, 0.19, mp, 0, -0.22, 0);
    _bm(rH, 0.19, 0.44, 0.19, mp, 0, -0.22, 0);
    const lK = pv(lH, 0, -0.44, 0);
    const rK = pv(rH, 0, -0.44, 0);
    _bm(lK, 0.17, 0.38, 0.17, mp, 0, -0.19, 0);
    _bm(rK, 0.17, 0.38, 0.17, mp, 0, -0.19, 0);
    _bm(lK, 0.19, 0.10, 0.26, mh,  0.02, -0.43, 0.06);
    _bm(rK, 0.19, 0.10, 0.26, mh,  0.02, -0.43, 0.06);

    root.userData = { lS, rS, lE, rE, lH, rH, lK, rK };
    scene.add(root);
    return root;
}

function _animateHuman(root, t) {
    const { lS, rS, lE, rE, lH, rH, lK, rK } = root.userData;
    const LEG = 0.72, ARM = 0.52;

    lH.rotation.x =  Math.sin(t) * LEG;
    rH.rotation.x = -Math.sin(t) * LEG;
    lK.rotation.x = Math.max(0, -Math.sin(t)) * 1.2;
    rK.rotation.x = Math.max(0, Math.sin(t))  * 1.2;
    lS.rotation.x = -Math.sin(t) * ARM;
    rS.rotation.x =  Math.sin(t) * ARM;
    lE.rotation.x = Math.max(0, Math.sin(t + 0.4))  * 0.7;
    rE.rotation.x = Math.max(0, -Math.sin(t + 0.4)) * 0.7;
    root.rotation.x = -0.08;
}

// ── Bicycle ───────────────────────────────────────────────────────────────────

function _buildBike(scene, x, groundY, z, bikeColor, pal) {
    const root    = new THREE.Group();
    root.position.set(x, groundY, z);

    const mBike   = _flat(bikeColor);
    const mDark   = _flat('#1a1a1a');
    const mSilver = _flat('#999999');

    // Wheel pivot groups (rotated each frame for spinning)
    const wPF = new THREE.Group(); wPF.position.set( 0.66, 0.34, 0); root.add(wPF);
    const wPR = new THREE.Group(); wPR.position.set(-0.66, 0.34, 0); root.add(wPR);

    for (const wp of [wPF, wPR]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 12), mDark);
        w.rotation.x = Math.PI / 2;
        wp.add(w);
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.10, 8), mSilver);
        r.rotation.x = Math.PI / 2;
        wp.add(r);
        // Cross spoke
        _bm(wp, 0.54, 0.04, 0.04, mSilver, 0, 0, 0);
        _bm(wp, 0.04, 0.54, 0.04, mSilver, 0, 0, 0);
    }

    // Frame
    _bm(root, 1.26, 0.07, 0.07, mBike,  0.00, 0.74, 0); // top tube
    _bm(root, 0.06, 0.54, 0.06, mBike,  0.64, 0.60, 0); // fork
    _bm(root, 0.06, 0.46, 0.06, mBike, -0.10, 0.58, 0); // seat tube
    // Handlebars
    _bm(root, 0.08, 0.06, 0.44, mBike,  0.54, 0.90, 0);
    _bm(root, 0.08, 0.20, 0.06, mBike,  0.54, 0.82, 0);
    // Seat
    _bm(root, 0.36, 0.06, 0.18, _flat('#331100'), -0.12, 1.02, 0);

    // Rider
    const skinMat  = _flat(pal.skin);
    const shirtMat = _flat(pal.shirt);
    const pantsMat = _flat(pal.pants);
    const hairMat  = _flat(pal.hair);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.44, 0.22), shirtMat);
    torso.position.set(0.09, 1.30, 0);
    torso.rotation.z = -0.50;
    root.add(torso);

    _bm(root, 0.30, 0.30, 0.24, skinMat, 0.30, 1.62, 0);
    _bm(root, 0.32, 0.10, 0.26, hairMat, 0.30, 1.80, 0);
    const eMat = _flat('#111111');
    _bm(root, 0.07, 0.07, 0.04, eMat, 0.20, 1.65, 0.13);
    _bm(root, 0.07, 0.07, 0.04, eMat, 0.38, 1.65, 0.13);

    // Legs (simplified pedaling)
    _bm(root, 0.14, 0.38, 0.14, pantsMat, -0.02, 0.82,  0.10);
    _bm(root, 0.14, 0.38, 0.14, pantsMat, -0.02, 0.82, -0.10);
    _bm(root, 0.13, 0.30, 0.13, pantsMat,  0.18, 0.58,  0.10);
    _bm(root, 0.13, 0.30, 0.13, pantsMat,  0.18, 0.58, -0.10);

    scene.add(root);
    return { root, wPF, wPR };
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
