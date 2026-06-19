import * as THREE from 'three';

// ── Constants ──────────────────────────────────────────────────────────────────
const GROUND_Y  = -2.0;
const SCROLL_W  = 30;   // foreground wrap width
const WRAP_MID  = 40;   // mid-layer wrap
const WRAP_FAR  = 60;   // far-layer wrap

// SNES-style character color palettes
const PALETTES = [
    { skin: '#ffccaa', shirt: '#cc3300', pants: '#223399', shoes: '#221100', hair: '#221100' },
    { skin: '#ffccaa', shirt: '#227733', pants: '#554422', shoes: '#332200', hair: '#331100' },
    { skin: '#ffddbb', shirt: '#bbaa00', pants: '#554422', shoes: '#221100', hair: '#662200' },
    { skin: '#ffbbaa', shirt: '#993322', pants: '#222244', shoes: '#110011', hair: '#000000' },
    { skin: '#aaddaa', shirt: '#335533', pants: '#112211', shoes: '#001100', hair: '#001100' }, // zombie
    { skin: '#ffccaa', shirt: '#884488', pants: '#332244', shoes: '#110022', hair: '#440044' },
];

const FLAME_COLS = ['#ff3300', '#ff6600', '#ffaa00', '#ff4400', '#ffcc00'];

export class ApocalypseScene {
    get useBloom() { return this._useBloom; }

    constructor() {
        this._group      = null;
        this._time       = 0;
        this._speedBoost = 0;
        this._beatFlash  = 0;
        this._useBloom   = !_isMobile();
        this._theme      = null;

        this._humans      = [];   // { group, phase, runSpeed }
        this._cars        = [];   // { group, scrollMult }
        this._flames      = [];   // meshes with emissive (flickered each frame)
        this._debris      = [];   // { group, vy, rot }
        this._farBldgs    = [];   // { group, wrap } - far parallax
        this._midBldgs    = [];   // { group, wrap } - mid parallax
    }

    init(threeScene, theme) {
        this._theme = theme;
        this._group = new THREE.Group();
        threeScene.add(this._group);

        threeScene.background = new THREE.Color('#100818');
        threeScene.fog = new THREE.FogExp2(new THREE.Color('#180a08'), 0.016);

        _buildSky(this._group, this._flames);
        _buildGround(this._group);
        _buildFarLayer(this._group, this._farBldgs, this._flames);
        _buildMidLayer(this._group, this._midBldgs, this._flames);
        _spawnForeground(this._group, this._humans, this._cars, this._debris, this._flames, theme);
    }

    update(reactive, delta) {
        this._speedBoost *= 0.96;
        this._beatFlash  *= 0.84;
        this._time       += delta;

        const speed = 0.042 + reactive.bassEnergy * 0.14 + this._speedBoost;

        // ── Fire flicker (all emissive meshes) ───────────────────────────────
        const baseEmi = 2.5 + reactive.bassEnergy * 5.0 + this._beatFlash;
        for (const f of this._flames) {
            if (!f.material?.emissive) continue;
            f.material.emissiveIntensity = Math.max(0.3,
                baseEmi + Math.sin(this._time * 22 + (f.userData.seed ?? 0)) * 0.7 + (Math.random() - 0.5));
            f.scale.y = 0.82 + Math.random() * 0.36;
            f.scale.x = 0.88 + Math.random() * 0.24;
        }

        // ── Parallax background layers ───────────────────────────────────────
        for (const el of this._farBldgs) {
            el.group.position.x -= speed * 0.18;
            if (el.group.position.x < -WRAP_FAR) el.group.position.x += WRAP_FAR * 2;
        }
        for (const el of this._midBldgs) {
            el.group.position.x -= speed * 0.48;
            if (el.group.position.x < -WRAP_MID) el.group.position.x += WRAP_MID * 2;
        }

        // ── Humans: run cycle + scroll ────────────────────────────────────────
        for (const h of this._humans) {
            const t = this._time * 5.5 * h.runSpeed + h.phase;
            _animateHuman(h.group, t);
            h.group.position.x -= speed * (0.85 + h.runSpeed * 0.15);
            h.group.position.y = GROUND_Y + Math.abs(Math.sin(t * 2)) * 0.07 * h.group.scale.x;
            if (h.group.position.x < -SCROLL_W / 2 - 1) {
                h.group.position.x = SCROLL_W / 2 + 1 + Math.random() * 4;
                h.group.position.z = -0.4 + Math.random() * 1.2;
            }
        }

        // ── Cars: scroll at varying speeds ────────────────────────────────────
        for (const c of this._cars) {
            c.group.position.x -= speed * c.scrollMult;
            if (c.group.position.x < -SCROLL_W / 2 - 3) {
                c.group.position.x = SCROLL_W / 2 + 2 + Math.random() * 6;
                c.group.position.z = -0.3 + Math.random() * 0.6;
            }
        }

        // ── Debris: fall + tumble + scroll ────────────────────────────────────
        for (const d of this._debris) {
            d.group.position.x -= speed * (0.35 + Math.random() * 0.3);
            d.group.position.y += d.vy;
            d.group.rotation.z += d.rot;
            if (d.group.position.y < GROUND_Y + 0.05) {
                d.group.position.y = GROUND_Y + 0.05;
                d.vy = Math.abs(d.vy) * 0.3;
            }
            if (d.group.position.x < -SCROLL_W / 2) {
                d.group.position.x = SCROLL_W / 2 + Math.random() * 5;
                d.group.position.y = GROUND_Y + 0.5 + Math.random() * 3;
                d.vy = -0.008 - Math.random() * 0.014;
            }
        }
    }

    onBeat()  { this._beatFlash = 5.5; this._speedBoost += 0.1; }
    onTap()   { this._beatFlash = 3.5; }
    onSwipe(dir) {
        if (dir === 'up')   this._speedBoost += 0.2;
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
        this._group   = null;
        this._humans  = [];
        this._cars    = [];
        this._flames  = [];
        this._debris  = [];
        this._farBldgs  = [];
        this._midBldgs  = [];
    }
}

// ── Sky ────────────────────────────────────────────────────────────────────────

function _buildSky(group, flames) {
    // Gradient bands from top to horizon
    const bands = [
        { y:  5.0, h: 2.5, col: '#0a0614' },
        { y:  3.0, h: 2.5, col: '#14081e' },
        { y:  1.0, h: 2.5, col: '#220a18' },
        { y: -0.5, h: 2.0, col: '#381008' }, // fire horizon
    ];
    for (const { y, h, col } of bands) {
        _bm(group, 220, h, 0.1, _flat(col), 0, y, -13);
    }

    // Horizon fire glow
    const glowMat = new THREE.MeshStandardMaterial({
        color: '#ff2200', emissive: '#ff2200', emissiveIntensity: 0.5,
        roughness: 0.0, metalness: 0.0, transparent: true, opacity: 0.25,
    });
    const glow = _bm(group, 220, 1.8, 0.1, glowMat, 0, GROUND_Y + 2.2, -12);
    glow.userData.seed = Math.random() * 100;
    flames.push(glow);

    // Moon
    const moonMat = new THREE.MeshBasicMaterial({ color: '#ccddff' });
    _bm(group, 0.6, 0.6, 0.2, moonMat, 3.5, 3.8, -12);
    // Moon glow
    const mgMat = new THREE.MeshStandardMaterial({
        color: '#8899cc', emissive: '#8899cc', emissiveIntensity: 0.8,
        transparent: true, opacity: 0.3,
    });
    _bm(group, 1.4, 1.4, 0.1, mgMat, 3.5, 3.8, -12.1);
}

// ── Ground ────────────────────────────────────────────────────────────────────

function _buildGround(group) {
    // Road surface
    _bm(group, 220, 0.16, 5, _flat('#1e1c18'), 0, GROUND_Y - 0.08, 0);
    // Sidewalk strips
    _bm(group, 220, 0.12, 0.3, _flat('#2a2820'), 0, GROUND_Y + 0.04, -2.0);
    _bm(group, 220, 0.12, 0.3, _flat('#2a2820'), 0, GROUND_Y + 0.04,  0.8);
    // Road centerline (yellow dashes)
    const dashMat = _flat('#666633');
    for (let x = -100; x < 100; x += 3.5) {
        _bm(group, 1.6, 0.025, 0.08, dashMat, x, GROUND_Y + 0.025, -0.6);
    }
    // Sidewalk cracks
    const crackMat = _flat('#151410');
    for (let x = -80; x < 80; x += 5.5) {
        _bm(group, 0.04, 0.025, 0.8 + Math.random() * 1.2, crackMat,
            x + (Math.random() - 0.5) * 3, GROUND_Y + 0.025, (Math.random() - 0.5) * 2);
    }
}

// ── Far background layer (z ≈ -9) ─────────────────────────────────────────────

function _buildFarLayer(group, farBldgs, flames) {
    const rand = _seededRand(77);
    const colors = ['#1a1a2e', '#221422', '#1e2218', '#1a1822', '#2a1818'];
    const winColors = ['#0a0a18', '#140a10', '#0a1210'];

    for (let i = 0; i < 22; i++) {
        const x   = (i - 11) * 5.5 + rand() * 3.5;
        const h   = 2.5 + rand() * 7;
        const w   = 1.4 + rand() * 3.2;
        const col = colors[Math.floor(rand() * colors.length)];
        const g   = new THREE.Group();
        g.position.set(x, GROUND_Y, -9);

        // Main body
        _bm(g, w, h, 0.5, _flat(col), 0, h / 2, 0);

        // Broken top
        if (rand() > 0.45) {
            const bt = new THREE.Mesh(
                new THREE.BoxGeometry(w * 0.55, h * 0.25, 0.4),
                _flat(col)
            );
            bt.position.set((rand() - 0.5) * w * 0.4, h + h * 0.12, 0);
            bt.rotation.z = (rand() - 0.5) * 0.45;
            g.add(bt);
        }

        // Windows
        const winMat = _flat(winColors[Math.floor(rand() * winColors.length)]);
        const rows = Math.max(1, Math.floor(h / 0.95));
        const cols = Math.max(1, Math.floor(w / 0.9));
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const isLit = rand() > 0.82;
                const wMat = isLit
                    ? new THREE.MeshStandardMaterial({ color: '#ffaa33', emissive: '#ffaa33', emissiveIntensity: 1.2 })
                    : winMat;
                const win = _bm(g, 0.25, 0.32, 0.07, wMat,
                    -w / 2 + 0.45 + c * 0.9, 0.55 + r * 0.95, 0.28);
                if (isLit) { win.userData.seed = rand() * 100; flames.push(win); }
            }
        }

        // Rooftop fire
        if (rand() > 0.55) {
            for (let f = 0; f < 3; f++) {
                const fh  = 0.35 + rand() * 0.55;
                const col = FLAME_COLS[Math.floor(rand() * FLAME_COLS.length)];
                const fMat = new THREE.MeshStandardMaterial({
                    color: col, emissive: col, emissiveIntensity: 4.0,
                    transparent: true, opacity: 0.88,
                });
                const fl = _bm(g, 0.22, fh, 0.16, fMat,
                    (rand() - 0.5) * w * 0.55, h + fh / 2, 0.28);
                fl.userData.seed = rand() * 100;
                flames.push(fl);
            }
        }

        group.add(g);
        farBldgs.push({ group: g, wrap: WRAP_FAR });
    }
}

// ── Mid layer (z ≈ -4.5) ──────────────────────────────────────────────────────

function _buildMidLayer(group, midBldgs, flames) {
    const rand = _seededRand(131);
    const colors = ['#2a2840', '#3a2222', '#22322a', '#302030', '#3a2818'];

    for (let i = 0; i < 14; i++) {
        const x   = (i - 7) * 6.2 + rand() * 4;
        const h   = 1.5 + rand() * 4.5;
        const w   = 1.2 + rand() * 2.8;
        const col = colors[Math.floor(rand() * colors.length)];
        const g   = new THREE.Group();
        g.position.set(x, GROUND_Y, -4.5);

        _bm(g, w, h, 0.6, _flat(col), 0, h / 2, 0);

        // Angled broken section
        if (rand() > 0.4) {
            const frag = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, h * 0.3, 0.5), _flat(col));
            frag.position.set((rand() - 0.5) * w * 0.5, h + h * 0.14, 0);
            frag.rotation.z = (rand() - 0.5) * 0.5;
            g.add(frag);
        }

        // Windows (fewer at this level - they're closer so windows are bigger)
        const winMat = _flat('#0d0d1a');
        const rows = Math.max(1, Math.floor(h / 0.9));
        const cols = Math.max(1, Math.floor(w / 0.85));
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (rand() < 0.25) continue; // some windows missing/shattered
                _bm(g, 0.28, 0.36, 0.08, winMat,
                    -w / 2 + 0.45 + c * 0.85, 0.5 + r * 0.9, 0.32);
            }
        }

        // Street-level detail: shop sign remnants
        if (rand() > 0.6) {
            const signCol = ['#cc3300', '#3388cc', '#ccaa00', '#33aa33'][Math.floor(rand() * 4)];
            const sMat = new THREE.MeshStandardMaterial({
                color: signCol, emissive: signCol, emissiveIntensity: 0.7,
                transparent: true, opacity: 0.75,
            });
            const sign = _bm(g, w * 0.65, 0.3, 0.1, sMat,
                (rand() - 0.5) * w * 0.3, 0.5, 0.35);
            sign.userData.seed = rand() * 100;
            flames.push(sign);
        }

        // Flames
        if (rand() > 0.4) {
            const fh  = 0.5 + rand() * 0.8;
            const col = FLAME_COLS[Math.floor(rand() * FLAME_COLS.length)];
            const fMat = new THREE.MeshStandardMaterial({
                color: col, emissive: col, emissiveIntensity: 5.0,
                transparent: true, opacity: 0.9,
            });
            const fl = _bm(g, 0.28, fh, 0.2, fMat,
                (rand() - 0.5) * w * 0.45, h + fh / 2, 0.35);
            fl.userData.seed = rand() * 100;
            flames.push(fl);
        }

        group.add(g);
        midBldgs.push({ group: g, wrap: WRAP_MID });
    }
}

// ── Foreground: humans, cars, debris ──────────────────────────────────────────

function _spawnForeground(group, humans, cars, debris, flames, theme) {
    // Humans — varied sizes for depth illusion
    const zDepths = [-0.5, 0, 0.4, -0.2, 0.8, -0.6, 0.2, 0.5];
    for (let i = 0; i < 8; i++) {
        const x     = (i - 4) * (SCROLL_W / 8) + (Math.random() - 0.5) * 2;
        const z     = zDepths[i];
        const scale = 0.7 + Math.random() * 0.4;
        const pal   = PALETTES[i % PALETTES.length];
        const phase = (i / 8) * Math.PI * 2;
        const spd   = 0.7 + Math.random() * 0.5;
        const h     = _buildHuman(group, x, GROUND_Y, z, pal, scale);
        humans.push({ group: h, phase, runSpeed: spd });
    }

    // Cars
    const carColors = ['#cc2200', '#1144cc', '#336622', '#888833', '#662288', '#cc6600'];
    for (let i = 0; i < 5; i++) {
        const x    = (i - 2.5) * (SCROLL_W / 5) + (Math.random() - 0.5) * 3;
        const z    = -0.3 + Math.random() * 0.5;
        const col  = carColors[i % carColors.length];
        const c    = _buildCar(group, x, GROUND_Y, z, col, flames);
        cars.push({ group: c, scrollMult: 0.18 + Math.random() * 0.25 });
    }

    // Debris
    for (let i = 0; i < 20; i++) {
        const x  = (Math.random() - 0.5) * SCROLL_W;
        const y  = GROUND_Y + 0.3 + Math.random() * 3;
        const z  = (Math.random() - 0.5) * 2;
        const d  = _buildDebris(group, x, y, z);
        debris.push({ group: d, vy: -0.007 - Math.random() * 0.013, rot: (Math.random() - 0.5) * 0.07 });
    }
}

// ── Human figure (SNES chunky proportions, all flat materials) ────────────────

function _buildHuman(scene, x, groundY, z, pal, scale) {
    const root = new THREE.Group();
    root.position.set(x, groundY, z);
    root.scale.setScalar(scale);

    const ms = _flat(pal.skin);
    const mt = _flat(pal.shirt);
    const mp = _flat(pal.pants);
    const mh = _flat(pal.shoes);
    const mr = _flat(pal.hair);

    // Head (big - SNES proportion: head = 1/3 height)
    _bm(root, 0.42, 0.44, 0.30, ms, 0, 1.62, 0);
    // Hair block on top
    _bm(root, 0.44, 0.14, 0.32, mr, 0, 1.90, 0);
    // Eyes (two tiny dark squares)
    const eyeMat = _flat('#111111');
    _bm(root, 0.08, 0.08, 0.04, eyeMat, -0.10, 1.66, 0.15);
    _bm(root, 0.08, 0.08, 0.04, eyeMat,  0.10, 1.66, 0.15);

    // Torso
    _bm(root, 0.38, 0.46, 0.26, mt, 0, 1.18, 0);

    // pivot helper
    const pv = (parent, px, py, pz) => {
        const g = new THREE.Group();
        g.position.set(px, py, pz);
        parent.add(g);
        return g;
    };

    // Arms
    const lS = pv(root, 0.25, 1.42, 0);
    const rS = pv(root, -0.25, 1.42, 0);
    _bm(lS, 0.15, 0.34, 0.15, mt, 0, -0.17, 0);
    _bm(rS, 0.15, 0.34, 0.15, mt, 0, -0.17, 0);
    const lE = pv(lS, 0, -0.34, 0);
    const rE = pv(rS, 0, -0.34, 0);
    _bm(lE, 0.13, 0.28, 0.13, ms, 0, -0.14, 0);
    _bm(rE, 0.13, 0.28, 0.13, ms, 0, -0.14, 0);

    // Legs
    const lH = pv(root, 0.12, 0.94, 0);
    const rH = pv(root, -0.12, 0.94, 0);
    _bm(lH, 0.19, 0.44, 0.19, mp, 0, -0.22, 0);
    _bm(rH, 0.19, 0.44, 0.19, mp, 0, -0.22, 0);
    const lK = pv(lH, 0, -0.44, 0);
    const rK = pv(rH, 0, -0.44, 0);
    _bm(lK, 0.17, 0.38, 0.17, mp, 0, -0.19, 0);
    _bm(rK, 0.17, 0.38, 0.17, mp, 0, -0.19, 0);
    // Feet (shoes)
    _bm(lK, 0.19, 0.10, 0.26, mh,  0.02, -0.43, 0.06);
    _bm(rK, 0.19, 0.10, 0.26, mh,  0.02, -0.43, 0.06);

    root.userData = { lS, rS, lE, rE, lH, rH, lK, rK };

    scene.add(root);
    return root;
}

function _animateHuman(root, t) {
    const { lS, rS, lE, rE, lH, rH, lK, rK } = root.userData;
    const LEG = 0.78, ARM = 0.58;

    lH.rotation.x =  Math.sin(t) * LEG;
    rH.rotation.x = -Math.sin(t) * LEG;
    lK.rotation.x = Math.max(0, -Math.sin(t)) * 1.35;
    rK.rotation.x = Math.max(0, Math.sin(t))  * 1.35;

    lS.rotation.x = -Math.sin(t) * ARM;
    rS.rotation.x =  Math.sin(t) * ARM;
    lE.rotation.x = Math.max(0, Math.sin(t + 0.4))  * 0.8;
    rE.rotation.x = Math.max(0, -Math.sin(t + 0.4)) * 0.8;

    root.rotation.x = -0.12; // slight forward lean
}

// ── Burning car ───────────────────────────────────────────────────────────────

function _buildCar(scene, x, groundY, z, color, flames) {
    const root = new THREE.Group();
    root.position.set(x, groundY, z);

    const mBody   = _flat(color);
    const mDark   = _flat('#0a0a0c');
    const mGlass  = _flat('#1a2a44');
    const mChrome = _flat('#888888');
    const mWheel  = _flat('#111111');
    const mRim    = _flat('#666666');

    // Body
    _bm(root, 2.1, 0.56, 0.90, mBody, 0, 0.44, 0);
    // Roof
    _bm(root, 1.15, 0.42, 0.82, mBody, -0.1, 0.90, 0);
    // Windshield
    _bm(root, 0.05, 0.36, 0.68, mGlass, 0.54, 0.88, 0);
    // Rear window
    _bm(root, 0.05, 0.30, 0.62, mGlass, -0.68, 0.84, 0);
    // Side windows (two small boxes left side visible to camera)
    _bm(root, 0.46, 0.28, 0.05, mGlass,  0.14, 0.88, 0.46);
    _bm(root, 0.46, 0.28, 0.05, mGlass, -0.28, 0.88, 0.46);
    // Bumpers
    _bm(root, 0.14, 0.18, 0.88, mChrome,  1.08, 0.26, 0);
    _bm(root, 0.14, 0.18, 0.88, mChrome, -1.08, 0.26, 0);
    // Door line
    _bm(root, 1.90, 0.03, 0.92, mDark, 0, 0.56, 0);

    // Wheels
    for (const [wx, wy, wz] of [[0.66,0.2,0.46],[0.66,0.2,-0.46],[-0.66,0.2,0.46],[-0.66,0.2,-0.46]]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.24,0.14,8), mWheel);
        w.rotation.x = Math.PI / 2;
        w.position.set(wx, wy, wz);
        root.add(w);
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.10,0.16,6), mRim);
        r.rotation.x = Math.PI / 2;
        r.position.set(wx, wy, wz);
        root.add(r);
    }

    // Flames from hood, roof and engine bay
    const flameSpots = [
        [0.55,0.75,0.22], [0.30,0.75,-0.10], [0.70,0.75, 0.00],
        [0.10,0.75, 0.18], [0.40,1.05,0.05], [0.00,1.05,0.20],
    ];
    const rand = _seededRand(x * 31 + z * 17);
    for (const [fx, fy, fz] of flameSpots) {
        const fh  = 0.2 + rand() * 0.55;
        const fw  = 0.12 + rand() * 0.14;
        const col = FLAME_COLS[Math.floor(rand() * FLAME_COLS.length)];
        const fMat = new THREE.MeshStandardMaterial({
            color: col, emissive: col, emissiveIntensity: 4.5,
            transparent: true, opacity: 0.88, roughness: 0.0, metalness: 0.0,
        });
        const fl = _bm(root, fw, fh, fw, fMat, fx, fy + fh / 2, fz);
        fl.userData.seed = rand() * 100;
        flames.push(fl);
    }

    scene.add(root);
    return root;
}

// ── Debris chunk ──────────────────────────────────────────────────────────────

function _buildDebris(scene, x, y, z) {
    const root = new THREE.Group();
    root.position.set(x, y, z);
    const colors = ['#332211','#222233','#333322','#221122','#334422','#442222'];
    const col = colors[Math.floor(Math.random() * colors.length)];
    const s   = 0.06 + Math.random() * 0.22;
    _bm(root, s, s * (0.4 + Math.random() * 0.8), s * (0.4 + Math.random()), _flat(col), 0, 0, 0);
    scene.add(root);
    return root;
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

function _isMobile() {
    return navigator.maxTouchPoints > 0 || window.innerWidth < 768;
}
