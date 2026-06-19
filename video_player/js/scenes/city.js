import * as THREE from 'three';

const NUM_ROWS      = 14;        // pairs of buildings (left + right) per "slot"
const ROW_SPACING   = 5;         // z distance between rows
const TOTAL_Z       = NUM_ROWS * ROW_SPACING;
const WRAP_Z        = 8;         // rows wrap when they pass this z
const ROAD_HALF_W   = 2.5;       // half-width of road (lane markers)
const BLDG_LANE_X   = 5.2;       // center x of building columns

export class CityScene {
    get useBloom() { return this._useBloom; }

    constructor() {
        this._group         = null;
        this._rows          = [];     // [{ group, reactive[] }]
        this._centerLineMat = null;
        this._speedBoost    = 0;
        this._beatFlash     = 0;
        this._beatSweep     = 2.0;   // > 1 = inactive; 0→1 = sweep front position
        this._time          = 0;
        this._useBloom      = !_isMobile();
        this._theme         = null;
        this._primaryCol    = null;
        this._secondaryCol  = null;
        this._white         = new THREE.Color(1, 1, 1);
    }

    init(threeScene, theme) {
        this._theme = theme;
        this._group = new THREE.Group();
        threeScene.add(this._group);

        threeScene.background = new THREE.Color(theme.bgColor);
        threeScene.fog = new THREE.FogExp2(new THREE.Color(theme.bgColor), 0.022);

        this._buildFloor(theme);
        this._buildCity(theme);

        this._primaryCol   = new THREE.Color(theme.primaryColor);
        this._secondaryCol = new THREE.Color(theme.secondaryColor);
    }

    // ── Floor & road markings ────────────────────────────────────────────────

    _buildFloor(theme) {
        const primary   = new THREE.Color(theme.primaryColor);
        const secondary = new THREE.Color(theme.secondaryColor);

        // Tron-style grid
        const grid = new THREE.GridHelper(
            200, 100,
            primary.clone().multiplyScalar(0.3),
            secondary.clone().multiplyScalar(0.1)
        );
        grid.position.y = -1.8;
        this._group.add(grid);

        // Road edge lines
        const edgeMat = new THREE.LineBasicMaterial({ color: secondary });
        for (const x of [-ROAD_HALF_W, ROAD_HALF_W]) {
            const pts = [
                new THREE.Vector3(x, -1.79, -(TOTAL_Z + 10)),
                new THREE.Vector3(x, -1.79, WRAP_Z),
            ];
            this._group.add(new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(pts), edgeMat.clone()
            ));
        }

        // Animated dashed center line
        this._centerLineMat = new THREE.LineDashedMaterial({
            color:    primary,
            dashSize: 0.8,
            gapSize:  0.8,
        });
        const centerPts = [
            new THREE.Vector3(0, -1.79, -(TOTAL_Z + 10)),
            new THREE.Vector3(0, -1.79, WRAP_Z),
        ];
        const centerLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(centerPts),
            this._centerLineMat
        );
        centerLine.computeLineDistances();
        this._group.add(centerLine);
    }

    // ── Buildings ────────────────────────────────────────────────────────────

    _buildCity(theme) {
        const rand      = _seededRand(137);
        const primary   = new THREE.Color(theme.primaryColor);
        const secondary = new THREE.Color(theme.secondaryColor);

        for (let i = 0; i < NUM_ROWS; i++) {
            const rowGroup = new THREE.Group();
            rowGroup.position.set(0, -1.8, -i * ROW_SPACING);
            const reactive = [];

            for (const side of [-1, 1]) {
                const h    = 2.0  + rand() * 7.5;
                const w    = 1.3  + rand() * 1.8;
                const d    = 0.9  + rand() * 1.8;
                const xVar = rand() * 1.2;
                const bx   = side * (BLDG_LANE_X + w / 2 + xVar);

                // Deterministic per-building phase offset (no rand() consumed)
                const bPhase = (i * 2.399 + side * 1.618) % (Math.PI * 2);

                // ── Body ──────────────────────────────────────────
                const body = new THREE.Mesh(
                    new THREE.BoxGeometry(w, h, d),
                    new THREE.MeshStandardMaterial({
                        color: new THREE.Color('#050510'), roughness: 0.9, metalness: 0.2,
                    })
                );
                body.position.set(bx, h / 2, 0);
                rowGroup.add(body);

                // ── Neon floor strips ──────────────────────────────
                const neonColor = (i + (side > 0 ? 1 : 0)) % 2 === 0
                    ? primary.clone() : secondary.clone();
                const numStrips = Math.max(1, Math.floor(h / 1.1));

                for (let s = 0; s < numStrips; s++) {
                    const sy    = (s + 0.5) * (h / numStrips) + 0.1;
                    const syN   = (s + 0.5) / numStrips;   // 0=bottom, 1=top (normalised)
                    const strip = new THREE.Mesh(
                        new THREE.BoxGeometry(w + 0.06, 0.04, d + 0.06),
                        new THREE.MeshStandardMaterial({
                            color: neonColor, emissive: neonColor,
                            emissiveIntensity: 0.8, roughness: 0.0, metalness: 1.0,
                        })
                    );
                    strip.position.set(bx, sy, 0);
                    rowGroup.add(strip);
                    reactive.push({ mesh: strip, sy: syN, bPhase, type: 'strip', col: neonColor.clone() });
                }

                // ── Vertical edge neon lines ───────────────────────
                const edgeMat = new THREE.MeshStandardMaterial({
                    color: neonColor, emissive: neonColor,
                    emissiveIntensity: 1.2, roughness: 0.0, metalness: 1.0,
                });
                for (const ex of [-w / 2 + 0.01, w / 2 - 0.01]) {
                    const edge = new THREE.Mesh(
                        new THREE.BoxGeometry(0.04, h, 0.04),
                        edgeMat.clone()
                    );
                    edge.position.set(bx + ex, h / 2, d / 2);
                    rowGroup.add(edge);
                    reactive.push({ mesh: edge, sy: 0.5, bPhase, type: 'edge', col: neonColor.clone() });
                }

                // ── Street light (every 3 rows) ────────────────────
                if (i % 3 === 0) {
                    const lampColor = neonColor.clone();
                    const pole = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.035, 0.035, 2.8, 6),
                        new THREE.MeshStandardMaterial({ color: '#0d0d1a' })
                    );
                    pole.position.set(side * (ROAD_HALF_W + 0.5), 1.4, d / 2);
                    rowGroup.add(pole);

                    const lamp = new THREE.Mesh(
                        new THREE.BoxGeometry(0.3, 0.07, 0.3),
                        new THREE.MeshStandardMaterial({
                            color: lampColor, emissive: lampColor,
                            emissiveIntensity: 1.6, roughness: 0.0, metalness: 0.9,
                        })
                    );
                    lamp.position.set(side * (ROAD_HALF_W + 0.5), 2.9, d / 2);
                    rowGroup.add(lamp);
                    reactive.push({ mesh: lamp, sy: 0.5, bPhase, type: 'lamp', col: lampColor });
                }

                // ── Neon rooftop accent ────────────────────────────
                const roofColor = (i % 3 === 0) ? primary.clone() : secondary.clone();
                const roof = new THREE.Mesh(
                    new THREE.BoxGeometry(w, 0.06, d),
                    new THREE.MeshStandardMaterial({
                        color: roofColor, emissive: roofColor,
                        emissiveIntensity: 1.0, roughness: 0.0, metalness: 1.0,
                    })
                );
                roof.position.set(bx, h + 0.03, 0);
                rowGroup.add(roof);
                reactive.push({ mesh: roof, sy: 1.0, bPhase, type: 'roof', col: roofColor.clone() });
            }

            this._group.add(rowGroup);
            this._rows.push({ group: rowGroup, reactive });
        }
    }

    // ── Per-frame update ──────────────────────────────────────────────────────

    update(reactive, delta) {
        this._speedBoost *= 0.96;
        this._time       += delta;
        this._beatSweep  += delta * 7.2;
        // Delta-correct decay: at 60fps ≈ 0.82 per frame → near-zero within ~1 beat
        this._beatFlash  *= Math.pow(0.82, delta * 60);

        const t     = this._time;
        const bf    = this._beatFlash;
        const speed = 0.06 + reactive.bassEnergy * 0.08 + this._speedBoost;

        if (this._centerLineMat) this._centerLineMat.dashOffset -= speed * 0.4;

        const sweepActive = this._beatSweep < 1.0;

        for (const { group, reactive: meshes } of this._rows) {
            group.position.z += speed;
            if (group.position.z > WRAP_Z) group.position.z -= TOTAL_Z;

            for (const el of meshes) {
                const { mesh, sy, bPhase, type, col } = el;

                // Scan line: steady time-based, no energy dependency
                const scan = Math.max(0, 1.0 - Math.abs(sy - ((t * 1.5 + bPhase * 0.16) % 1.0)) * 9) * 1.4;

                // Beat sweep: bright front racing from bottom on every beat
                const sweepDist = sweepActive ? Math.abs(sy - this._beatSweep) : 2;
                const sweep     = Math.max(0, 1.0 - sweepDist * 14) * 5.0;

                let intensity;

                if (type === 'strip') {
                    // Subtle background wave + beat flash as the dominant light source
                    const wave = (Math.sin(t * 5.0 - sy * Math.PI * 3.0 + bPhase) + 1) * 0.5;
                    intensity  = 0.05 + wave * 0.45 + scan + sweep + bf * (1.2 + sy * 2.2);
                    const colorMix = (Math.sin(t * 0.8 + sy * Math.PI + bPhase * 0.5) + 1) * 0.5;
                    mesh.material.emissive.lerpColors(
                        this._primaryCol, this._secondaryCol, colorMix * (0.5 + bf * 0.07));

                } else if (type === 'edge') {
                    const pulse = (Math.sin(t * 3.5 + bPhase) + 1) * 0.5;
                    intensity   = 0.06 + pulse * 0.35 + sweep * 0.4 + bf * 1.6;
                    mesh.material.emissive.lerpColors(col, this._white, Math.min(0.85, bf * 0.18));

                } else if (type === 'roof') {
                    intensity = 0.12 + sweep * 0.25 + bf * 2.8;
                    const colorMix = (Math.sin(t * 2.5 + bPhase) + 1) * 0.5;
                    mesh.material.emissive.lerpColors(this._primaryCol, this._secondaryCol, colorMix);

                } else {  // lamp
                    intensity = 0.35 + bf * 2.0;
                    mesh.material.emissive.copy(col);
                }

                mesh.material.emissiveIntensity = Math.min(5.5, intensity);
            }
        }
    }

    onSwipe(dir) {
        if (dir === 'left')  this._speedBoost += 0.32;
        if (dir === 'right') this._speedBoost = Math.max(0, this._speedBoost - 0.12);
    }

    onTap()  { this._beatFlash = 2.5; this._beatSweep = 0.0; }
    onBeat() { this._beatFlash = 5.0; this._beatSweep = 0.0; }

    // ── Cleanup ───────────────────────────────────────────────────────────────

    dispose() {
        this._group?.traverse(child => {
            if (!child.isMesh && !(child.isLine)) return;
            child.geometry?.dispose();
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => m?.dispose());
        });
        this._group?.parent?.remove(this._group);
        this._group         = null;
        this._rows          = [];
        this._centerLineMat = null;
    }
}

// Deterministic PRNG (Park-Miller) — same seed → same city every time
function _seededRand(seed) {
    let s = seed >>> 0;
    return function () {
        s = Math.imul(48271, s) >>> 0;
        return s / 0xffffffff;
    };
}

function _isMobile() {
    return navigator.maxTouchPoints > 0 || window.innerWidth < 768;
}
