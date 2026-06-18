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
        this._useBloom      = !_isMobile();
        this._theme         = null;
    }

    init(threeScene, theme) {
        this._theme = theme;
        this._group = new THREE.Group();
        threeScene.add(this._group);

        threeScene.background = new THREE.Color(theme.bgColor);
        threeScene.fog = new THREE.FogExp2(new THREE.Color(theme.bgColor), 0.022);

        this._buildFloor(theme);
        this._buildCity(theme);
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
                const xVar = rand() * 1.2;           // slight x offset for variety
                const bx   = side * (BLDG_LANE_X + w / 2 + xVar);

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
                    const sy   = (s + 0.5) * (h / numStrips) + 0.1;
                    const strip = new THREE.Mesh(
                        new THREE.BoxGeometry(w + 0.06, 0.04, d + 0.06),
                        new THREE.MeshStandardMaterial({
                            color: neonColor, emissive: neonColor,
                            emissiveIntensity: 0.8, roughness: 0.0, metalness: 1.0,
                        })
                    );
                    strip.position.set(bx, sy, 0);
                    rowGroup.add(strip);
                    reactive.push(strip);
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
                    reactive.push(edge);
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
                    reactive.push(lamp);
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
                reactive.push(roof);
            }

            this._group.add(rowGroup);
            this._rows.push({ group: rowGroup, reactive });
        }
    }

    // ── Per-frame update ──────────────────────────────────────────────────────

    update(reactive /*, delta */) {
        this._speedBoost *= 0.96;
        const speed = 0.05 + reactive.bassEnergy * 0.22 + this._speedBoost;

        // Animated center line (feels like road rushing toward you)
        if (this._centerLineMat) this._centerLineMat.dashOffset -= speed * 0.4;

        this._beatFlash *= 0.87;
        const emissive = 0.5 + reactive.bassEnergy * 1.5 + this._beatFlash;
        // Color shift on mids
        const colorMix = reactive.midsEnergy * 0.4;

        for (const { group, reactive: meshes } of this._rows) {
            group.position.z += speed;
            if (group.position.z > WRAP_Z) group.position.z -= TOTAL_Z;

            for (const mesh of meshes) {
                mesh.material.emissiveIntensity = emissive;
                // Slight color mix between primary/secondary with mids
                const base = mesh.material.emissive.clone();
                const alt  = new THREE.Color(this._theme.secondaryColor);
                base.lerp(alt, colorMix);
                mesh.material.emissive.copy(base);
            }
        }
    }

    onSwipe(dir) {
        if (dir === 'left')  this._speedBoost += 0.32;
        if (dir === 'right') this._speedBoost = Math.max(0, this._speedBoost - 0.12);
    }

    onTap()  { this._beatFlash = 2.5; }
    onBeat() { this._beatFlash = 3.8; }

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
