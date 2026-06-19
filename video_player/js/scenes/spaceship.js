import * as THREE from 'three';

const CORRIDOR_W = 4.6;
const CORRIDOR_H = 3.6;
const HALF_W     = CORRIDOR_W / 2;
const HALF_H     = CORRIDOR_H / 2;
const WAIN_H     = 1.15;   // wainscot (lower panel) height

const NUM_SEGS   = 14;
const SEG_LEN    = 5;
const TOTAL_Z    = NUM_SEGS * SEG_LEN;   // 70
const WRAP_Z     = SEG_LEN;              // wrap past the camera

export class SpaceshipScene {
    get useBloom() { return this._useBloom; }

    constructor() {
        this._group      = null;
        this._segs       = [];
        this._speedBoost = 0;
        this._beatFlash  = 0;
        this._time       = 0;
        this._useBloom   = !_isMobile();
        this._theme      = null;
    }

    init(threeScene, theme) {
        this._theme = theme;
        this._group = new THREE.Group();
        threeScene.add(this._group);

        threeScene.background = new THREE.Color('#010103');
        threeScene.fog = new THREE.FogExp2(new THREE.Color('#010103'), 0.04);

        _buildCorridor(this._group, theme, this._segs);
    }

    update(reactive, delta) {
        this._speedBoost *= 0.95;
        this._beatFlash  *= 0.86;
        this._time       += delta;

        const speed = 0.042 + reactive.bassEnergy * 0.22 + this._speedBoost;

        // Flicker: sine noise driven by highs, spike on beat
        const flicker  = (Math.sin(this._time * 13.7) * 0.15
                        + Math.sin(this._time * 5.1)  * 0.07)
                        * (0.3 + reactive.highsEnergy);
        const lightEmi = Math.max(0, 0.35 + reactive.bassEnergy * 3.5
                                 + this._beatFlash + flicker);
        const accentEmi = 0.2 + reactive.midsEnergy * 1.0;
        const screenEmi = 0.5 + reactive.highsEnergy * 2.0;

        for (const { group, lights, accents, screens } of this._segs) {
            group.position.z += speed;
            if (group.position.z > WRAP_Z) group.position.z -= TOTAL_Z;

            for (const m of lights)  m.material.emissiveIntensity = lightEmi;
            for (const m of accents) m.material.emissiveIntensity = accentEmi;
            for (const m of screens) m.material.emissiveIntensity = screenEmi;
        }
    }

    onBeat()  { this._beatFlash = 5.0; }
    onTap()   { this._beatFlash = 3.5; }
    onSwipe(dir) {
        if (dir === 'up')   this._speedBoost += 0.25;
        if (dir === 'down') this._speedBoost = Math.max(0, this._speedBoost - 0.1);
    }

    dispose() {
        this._group?.traverse(child => {
            if (!child.isMesh) return;
            child.geometry?.dispose();
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => m?.dispose());
        });
        this._group?.parent?.remove(this._group);
        this._group = null;
        this._segs  = [];
    }
}

// ── Corridor builder ───────────────────────────────────────────────────────────

function _buildCorridor(group, theme, segs) {
    const rand      = _seededRand(2099);
    const primary   = new THREE.Color(theme.primaryColor);
    const secondary = new THREE.Color(theme.secondaryColor);

    // Shared base materials
    const matWall      = _mat('#0d1015', 0.92, 0.55);
    const matWainscot  = _mat('#0a0c10', 0.90, 0.65);
    const matFloor     = _mat('#08090c', 1.00, 0.30);
    const matMetal     = _mat('#181c22', 0.75, 0.85);
    const matArch      = _mat('#12151a', 0.80, 0.80);
    const matPipe      = _mat('#1a1c24', 0.55, 0.90);
    const matDark      = _mat('#060709', 0.95, 0.50);

    for (let i = 0; i < NUM_SEGS; i++) {
        const sg = new THREE.Group();
        sg.position.set(0, 0, -i * SEG_LEN);

        const lights  = [];   // ceiling strips → react to bass/beat
        const accents = [];   // rail strips, hazard lines → react to mids
        const screens = [];   // computer screens → react to highs

        const hl = SEG_LEN / 2;

        // ── Core structure (no gaps between segments) ─────────────────────────
        _b(sg, CORRIDOR_W,    0.14, SEG_LEN, matFloor,   0,      -HALF_H,       -hl);
        _b(sg, CORRIDOR_W,    0.10, SEG_LEN, matWall,    0,       HALF_H,       -hl);
        _b(sg, 0.16, CORRIDOR_H,   SEG_LEN, matWall,  -HALF_W,   0,            -hl);
        _b(sg, 0.16, CORRIDOR_H,   SEG_LEN, matWall,   HALF_W,   0,            -hl);

        // Lower wainscot panels (Doom 2 signature: 2-tone wall)
        _b(sg, 0.07, WAIN_H, SEG_LEN, matWainscot, -HALF_W + 0.04, -HALF_H + WAIN_H / 2, -hl);
        _b(sg, 0.07, WAIN_H, SEG_LEN, matWainscot,  HALF_W - 0.04, -HALF_H + WAIN_H / 2, -hl);

        // Chair rail (horizontal divider strip between wainscot and upper wall)
        const railCol = primary.clone().multiplyScalar(0.35);
        const railMat = new THREE.MeshStandardMaterial({
            color: railCol, emissive: railCol,
            emissiveIntensity: 0.3, roughness: 0.0, metalness: 1.0,
        });
        const railL = _b(sg, 0.06, 0.04, SEG_LEN, railMat, -HALF_W + 0.04, -HALF_H + WAIN_H, -hl);
        const railR = _b(sg, 0.06, 0.04, SEG_LEN, railMat.clone(),  HALF_W - 0.04, -HALF_H + WAIN_H, -hl);
        accents.push(railL, railR);

        // Ceiling corner fillets (chamfer the top corners for a vault feel)
        for (const sx of [-1, 1]) {
            const fillet = new THREE.Mesh(
                new THREE.BoxGeometry(0.24, 0.24, SEG_LEN), _mat('#0b0d11', 0.9, 0.6)
            );
            fillet.position.set(sx * (HALF_W - 0.07), HALF_H - 0.07, -hl);
            fillet.rotation.z = Math.PI / 4;
            sg.add(fillet);
        }

        // ── Floor detail ──────────────────────────────────────────────────────
        // Metal plate seams (crossbars)
        for (let g = 0; g < SEG_LEN; g++) {
            _b(sg, CORRIDOR_W - 0.35, 0.025, 0.055, matMetal, 0, -HALF_H + 0.09, -g - 0.5);
        }
        // Hazard strip along floor edges
        const hazCol = secondary.clone().multiplyScalar(0.3);
        const hazMat = new THREE.MeshStandardMaterial({
            color: hazCol, emissive: hazCol, emissiveIntensity: 0.25,
            roughness: 0.0, metalness: 1.0,
        });
        const hL = _b(sg, 0.08, 0.025, SEG_LEN, hazMat, -(HALF_W - 0.25), -HALF_H + 0.09, -hl);
        const hR = _b(sg, 0.08, 0.025, SEG_LEN, hazMat.clone(), HALF_W - 0.25, -HALF_H + 0.09, -hl);
        accents.push(hL, hR);

        // ── Ceiling: cable tray ───────────────────────────────────────────────
        // Tray body
        _b(sg, 0.55, 0.07, SEG_LEN, matMetal, 0, HALF_H - 0.09, -hl);
        // Individual cable runs (thin strips inside tray)
        for (const cx of [-0.12, 0.0, 0.12]) {
            _b(sg, 0.02, 0.02, SEG_LEN, matPipe, cx, HALF_H - 0.12, -hl);
        }

        // ── Ceiling light strips ──────────────────────────────────────────────
        for (let li = 0; li < 2; li++) {
            const lz  = -(li + 0.5) * (SEG_LEN / 2);
            const col = (i + li) % 2 === 0
                ? primary.clone().multiplyScalar(0.9)
                : secondary.clone().multiplyScalar(0.9);
            const lMat = new THREE.MeshStandardMaterial({
                color: col, emissive: col, emissiveIntensity: 1.0,
                roughness: 0.0, metalness: 0.0,
            });
            _b(sg, 0.58, 0.055, 0.25, _mat('#0e1015', 0.9, 0.7), 0, HALF_H - 0.055, lz); // housing
            const strip = _b(sg, 0.42, 0.018, 0.2, lMat, 0, HALF_H - 0.08, lz);
            lights.push(strip);
        }

        // ── Wall panels (upper section, Doom-style tech bays) ─────────────────
        _addWallPanels(sg, i, primary, secondary, rand, accents, screens);

        // ── Overhead pipes ────────────────────────────────────────────────────
        if (rand() > 0.35) {
            const px = (rand() - 0.5) * (CORRIDOR_W * 0.5);
            const py = HALF_H - 0.14 - rand() * 0.22;
            const r  = 0.022 + rand() * 0.04;
            const pipe = new THREE.Mesh(
                new THREE.CylinderGeometry(r, r, SEG_LEN, 7), matPipe
            );
            pipe.rotation.x = Math.PI / 2;
            pipe.position.set(px, py, -hl);
            sg.add(pipe);
        }

        // ── Bulkhead arches — OPEN rings, never block the passage ────────────
        // One arch per segment (at the near end z=0 local), spaced = SEG_LEN
        _addBulkheadArch(sg, matArch, theme, accents, 0);

        // Extra mid-segment support ring on every 3rd segment
        if (i % 3 === 0) _addBulkheadArch(sg, matArch, theme, accents, -hl);

        // ── Warning light beacon (wall-mounted, every 4th segment) ────────────
        if (i % 4 === 0) {
            const wCol  = primary.clone();
            const wMat  = new THREE.MeshStandardMaterial({
                color: wCol, emissive: wCol, emissiveIntensity: 2.5,
                roughness: 0.0, metalness: 0.0,
            });
            const side = i % 8 === 0 ? -1 : 1;
            const warn = _b(sg, 0.055, 0.055, 0.055, wMat,
                side * (HALF_W - 0.085), 0.7, -hl + 1.2);
            lights.push(warn);
        }

        // ── Computer terminal (every 5th segment, alternating sides) ──────────
        if (i % 5 === 0) {
            _addComputerTerminal(sg, i, primary, secondary, rand, screens, accents);
        }

        group.add(sg);
        segs.push({ group: sg, lights, accents, screens });
    }
}

// ── Bulkhead arch: a RING frame around the corridor — fully open passageway ──

function _addBulkheadArch(sg, mat, theme, accents, z) {
    const T = 0.13;  // thickness of the ring beams
    const D = 0.20;  // depth of the ring (z depth)

    // Top beam
    _b(sg, CORRIDOR_W + T * 2, T, D, mat, 0,       HALF_H + T / 2,  z);
    // Bottom beam
    _b(sg, CORRIDOR_W + T * 2, T, D, mat, 0,      -HALF_H - T / 2,  z);
    // Left post
    _b(sg, T, CORRIDOR_H + T * 2, D, mat, -HALF_W - T / 2, 0, z);
    // Right post
    _b(sg, T, CORRIDOR_H + T * 2, D, mat,  HALF_W + T / 2, 0, z);

    // Caution accent strips on the bottom of the arch posts
    const hCol = new THREE.Color(theme.primaryColor).multiplyScalar(0.5);
    for (const sx of [-1, 1]) {
        const hMat = new THREE.MeshStandardMaterial({
            color: hCol, emissive: hCol, emissiveIntensity: 0.4,
            roughness: 0.0, metalness: 1.0,
        });
        for (let s = 0; s < 4; s++) {
            const stripe = _b(sg, T + 0.02, 0.06, D + 0.02, hMat,
                sx * (HALF_W + T / 2),
                -HALF_H + 0.1 + s * 0.5, z);
            accents.push(stripe);
        }
    }
}

// ── Wall tech panels (upper wall, Doom 2 recessed bays) ──────────────────────

function _addWallPanels(sg, segIdx, primary, secondary, rand, accents, screens) {
    const panelPositions = [
        { z: -SEG_LEN * 0.22, side: -1 },
        { z: -SEG_LEN * 0.22, side:  1 },
        { z: -SEG_LEN * 0.72, side: -1 },
        { z: -SEG_LEN * 0.72, side:  1 },
    ];

    for (const { z, side } of panelPositions) {
        const ph = 0.7 + rand() * 0.4;
        const pw = SEG_LEN * 0.22 - 0.08;
        const py = WAIN_H * 0.15 + ph / 2 + 0.04; // sits above chair rail

        // Main panel face (slightly recessed from wall)
        _b(sg, 0.055, ph, pw, _mat('#0b0e12', 0.88, 0.7),
            side * (HALF_W - 0.045), py, z);

        // Horizontal bolt/rivet lines across panel
        for (let row = 0; row < 3; row++) {
            const ry = py - ph / 2 + (row + 0.5) * (ph / 3);
            _b(sg, 0.025, 0.018, pw * 0.85, _mat('#1c2028', 0.7, 0.9),
                side * (HALF_W - 0.03), ry, z);
        }

        // Status LED strip (thin emissive strip at panel edge)
        const ledCol = side < 0 ? primary.clone().multiplyScalar(0.6)
                                : secondary.clone().multiplyScalar(0.6);
        const ledMat = new THREE.MeshStandardMaterial({
            color: ledCol, emissive: ledCol, emissiveIntensity: 0.5,
            roughness: 0.0, metalness: 1.0,
        });
        const led = _b(sg, 0.02, ph * 0.7, 0.025, ledMat,
            side * (HALF_W - 0.025), py, z - pw / 2 + 0.015);
        accents.push(led);
    }
}

// ── Computer terminal ─────────────────────────────────────────────────────────

function _addComputerTerminal(sg, segIdx, primary, secondary, rand, screens, accents) {
    const side  = segIdx % 10 === 0 ? -1 : 1;
    const termZ = -SEG_LEN * 0.5;
    const termH = 1.8;
    const termW = 0.7;
    const termD = 0.22;
    const termY = -HALF_H + termH / 2;

    // Body of terminal
    _b(sg, termD, termH, termW, _mat('#0c0e13', 0.85, 0.7),
        side * (HALF_W - termD / 2 - 0.01), termY, termZ);

    // Top trim
    const trimCol = primary.clone().multiplyScalar(0.4);
    const trimMat = new THREE.MeshStandardMaterial({
        color: trimCol, emissive: trimCol, emissiveIntensity: 0.5,
        roughness: 0.0, metalness: 1.0,
    });
    const trim = _b(sg, termD + 0.02, 0.04, termW + 0.04, trimMat,
        side * (HALF_W - termD / 2 - 0.01), termY + termH / 2, termZ);
    accents.push(trim);

    // Multiple small screen panels
    const screenPositions = [
        { dy:  0.35, h: 0.42, w: 0.38 },
        { dy: -0.15, h: 0.22, w: 0.28 },
        { dy: -0.48, h: 0.16, w: 0.18 },
    ];
    for (const { dy, h, w } of screenPositions) {
        const sCol = (rand() > 0.5 ? secondary : primary).clone().multiplyScalar(0.7);
        const sMat = new THREE.MeshStandardMaterial({
            color: sCol, emissive: sCol, emissiveIntensity: 0.8,
            roughness: 0.0, metalness: 0.0,
        });
        const scr = _b(sg, termD * 0.55, h, w, sMat,
            side * (HALF_W - termD * 0.12), termY + dy, termZ);
        screens.push(scr);
    }

    // Keyboard/control surface at the bottom
    _b(sg, termD + 0.06, 0.04, termW * 0.7, _mat('#141820', 0.7, 0.8),
        side * (HALF_W - termD / 2 - 0.01), termY - termH / 2 + 0.3, termZ);
}

// ── Utility ───────────────────────────────────────────────────────────────────

function _b(parent, w, h, d, mat, px, py, pz) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(px, py, pz);
    parent.add(mesh);
    return mesh;
}

function _mat(hex, roughness, metalness) {
    return new THREE.MeshStandardMaterial({
        color: new THREE.Color(hex), roughness, metalness,
    });
}

function _seededRand(seed) {
    let s = seed >>> 0;
    return () => { s = Math.imul(48271, s) >>> 0; return s / 0xffffffff; };
}

function _isMobile() {
    return navigator.maxTouchPoints > 0 || window.innerWidth < 768;
}
