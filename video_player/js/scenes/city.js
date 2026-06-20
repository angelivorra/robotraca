import * as THREE from 'three';

const NUM_ROWS     = 14;
const ROW_SPACING  = 5;
const TOTAL_Z      = NUM_ROWS * ROW_SPACING;
const WRAP_Z       = 8;
const ROAD_HALF_W  = 2.5;
const BLDG_LANE_X  = 5.2;
const MAX_CARS     = 4;
const CAR_LANES    = [-1.2, 1.2];
const FILL_SPEED   = 2.8;   // 0→1 en ~0.36s por beat

export class CityScene {
    get useBloom() { return this._useBloom; }

    constructor() {
        this._group         = null;
        this._rows          = [];
        this._centerLineMat = null;
        this._roadEdgeMats  = [];
        this._speedBoost    = 0;
        this._beatFlash     = 0;
        this._beatSweep     = 2.0;
        this._beatFill      = 1.0;   // empieza lleno; se resetea a 0 en cada beat
        this._time          = 0;
        this._useBloom      = false;
        this._theme         = null;
        this._primaryCol    = null;
        this._secondaryCol  = null;
        this._white         = new THREE.Color(1, 1, 1);
        this._cars          = [];
        this._carSpawnTimer = 0;
        this._carSpawnNext  = 4.0;
        this._carGroup      = null;
    }

    init(threeScene, theme) {
        this._theme = theme;
        this._group = new THREE.Group();
        threeScene.add(this._group);

        threeScene.background = new THREE.Color(theme.bgColor);
        threeScene.fog = new THREE.FogExp2(new THREE.Color(theme.bgColor), 0.022);

        this._buildFloor(theme);
        this._buildCity(theme);

        this._carGroup = new THREE.Group();
        this._group.add(this._carGroup);

        this._primaryCol   = new THREE.Color(theme.primaryColor);
        this._secondaryCol = new THREE.Color(theme.secondaryColor);
    }

    // ── Suelo y marcas de carretera ──────────────────────────────────────────

    _buildFloor(theme) {
        const primary   = new THREE.Color(theme.primaryColor);
        const secondary = new THREE.Color(theme.secondaryColor);

        const grid = new THREE.GridHelper(
            200, 100,
            primary.clone().multiplyScalar(0.3),
            secondary.clone().multiplyScalar(0.1)
        );
        grid.position.y = -1.8;
        this._group.add(grid);

        // Líneas de borde de carretera — guardadas para reactividad al beat
        for (const x of [-ROAD_HALF_W, ROAD_HALF_W]) {
            const mat = new THREE.LineBasicMaterial({ color: secondary.clone() });
            this._roadEdgeMats.push({ mat, baseCol: secondary.clone() });
            const pts = [
                new THREE.Vector3(x, -1.79, -(TOTAL_Z + 10)),
                new THREE.Vector3(x, -1.79, WRAP_Z),
            ];
            this._group.add(new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(pts), mat
            ));
        }

        // Línea central discontinua animada
        this._centerLineMat = new THREE.LineDashedMaterial({
            color:    primary.clone(),
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

    // ── Edificios ────────────────────────────────────────────────────────────

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
                const bPhase = (i * 2.399 + side * 1.618) % (Math.PI * 2);
                // Desfase de llenado por edificio: los más altos se iluminan algo después
                const fillDelay = (i * 0.137 + (side > 0 ? 0.0 : 0.093) + h * 0.018) % 0.28;

                // ── Cuerpo ──────────────────────────────────────────
                const body = new THREE.Mesh(
                    new THREE.BoxGeometry(w, h, d),
                    new THREE.MeshStandardMaterial({
                        color: new THREE.Color('#050510'), roughness: 0.9, metalness: 0.2,
                    })
                );
                body.position.set(bx, h / 2, 0);
                rowGroup.add(body);

                // ── Tiras de neón por piso ──────────────────────────
                const neonColor = (i + (side > 0 ? 1 : 0)) % 2 === 0
                    ? primary.clone() : secondary.clone();
                const numStrips = Math.max(1, Math.floor(h / 1.1));

                for (let s = 0; s < numStrips; s++) {
                    const sy    = (s + 0.5) * (h / numStrips) + 0.1;
                    const syN   = (s + 0.5) / numStrips;   // 0=planta baja, 1=azotea
                    const strip = new THREE.Mesh(
                        new THREE.BoxGeometry(w + 0.06, 0.04, d + 0.06),
                        new THREE.MeshStandardMaterial({
                            color: neonColor, emissive: neonColor,
                            emissiveIntensity: 0.8, roughness: 0.0, metalness: 1.0,
                        })
                    );
                    strip.position.set(bx, sy, 0);
                    rowGroup.add(strip);
                    reactive.push({ mesh: strip, sy: syN, bPhase, fillDelay, type: 'strip', col: neonColor.clone() });
                }

                // ── Aristas verticales de neón ─────────────────────
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
                    reactive.push({ mesh: edge, sy: 0.5, bPhase, fillDelay, type: 'edge', col: neonColor.clone() });
                }

                // ── Farola (cada 3 filas) ──────────────────────────
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
                    reactive.push({ mesh: lamp, sy: 0.5, bPhase, fillDelay, type: 'lamp', col: lampColor });
                }

                // ── Acento de azotea ───────────────────────────────
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
                reactive.push({ mesh: roof, sy: 1.0, bPhase, fillDelay, type: 'roof', col: roofColor.clone() });
            }

            this._group.add(rowGroup);
            this._rows.push({ group: rowGroup, reactive });
        }
    }

    // ── Coches de Tron ───────────────────────────────────────────────────────

    _spawnCar() {
        const theme  = this._theme;
        const lane   = CAR_LANES[Math.floor(Math.random() * CAR_LANES.length)];
        const carCol = Math.random() > 0.5
            ? new THREE.Color(theme.primaryColor)
            : new THREE.Color(theme.secondaryColor);

        const carGrp = new THREE.Group();

        // Carrocería oscura
        carGrp.add(new THREE.Mesh(
            new THREE.BoxGeometry(1.0, 0.32, 2.0),
            new THREE.MeshStandardMaterial({ color: '#040408', roughness: 0.7, metalness: 0.5 })
        ));

        // Cabina
        const cockpit = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.22, 0.8),
            new THREE.MeshStandardMaterial({ color: '#080814', roughness: 0.2, metalness: 0.9 })
        );
        cockpit.position.set(0, 0.27, 0.1);
        carGrp.add(cockpit);

        const glowMats = [];

        const mkGlow = () => new THREE.MeshStandardMaterial({
            color: carCol.clone(), emissive: carCol.clone(),
            emissiveIntensity: 2.5, roughness: 0.0, metalness: 1.0,
        });

        // Tiras laterales de luz
        for (const sx of [-0.52, 0.52]) {
            const strip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 2.0), mkGlow());
            strip.position.set(sx, 0.05, 0);
            carGrp.add(strip);
            glowMats.push(strip.material);
        }

        // Faros delanteros blancos
        const frontMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(1, 1, 1), emissive: new THREE.Color(1, 1, 1),
            emissiveIntensity: 3.0, roughness: 0.0, metalness: 1.0,
        });
        const front = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.05, 0.04), frontMat);
        front.position.set(0, 0.08, -1.02);
        carGrp.add(front);

        // Pilotos traseros de color
        const rearMat = mkGlow();
        rearMat.emissiveIntensity = 2.0;
        const rear = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.05, 0.04), rearMat);
        rear.position.set(0, 0.08, 1.02);
        carGrp.add(rear);
        glowMats.push(rearMat);

        carGrp.position.set(lane, -1.64, -(TOTAL_Z + 5));
        this._carGroup.add(carGrp);

        const speed = 0.16 + Math.random() * 0.14;
        this._cars.push({ group: carGrp, speed, glowMats });
    }

    // ── Actualización por frame ───────────────────────────────────────────────

    update(reactive, delta) {
        this._speedBoost *= 0.96;
        this._time       += delta;
        this._beatSweep  += delta * 7.2;
        this._beatFlash  *= Math.pow(0.82, delta * 60);
        // Ola de llenado por pisos: avanza 0→1 desde el último beat
        this._beatFill    = Math.min(1.0, this._beatFill + delta * FILL_SPEED);

        const t     = this._time;
        const bf    = this._beatFlash;
        const speed = 0.06 + reactive.bassEnergy * 0.08 + this._speedBoost;

        // Línea central: pulso de color al beat
        if (this._centerLineMat) {
            this._centerLineMat.dashOffset -= speed * 0.4;
            const bright = Math.min(0.85, bf * 0.5 + reactive.bassEnergy * 0.35);
            this._centerLineMat.color.lerpColors(this._primaryCol, this._white, bright);
        }

        // Líneas de borde: se iluminan en el beat
        for (const { mat, baseCol } of this._roadEdgeMats) {
            const bright = Math.min(1.0, bf * 0.65 + reactive.bassEnergy * 0.45);
            mat.color.lerpColors(baseCol, this._white, bright);
        }

        const sweepActive = this._beatSweep < 1.0;

        for (const { group, reactive: meshes } of this._rows) {
            group.position.z += speed;
            if (group.position.z > WRAP_Z) group.position.z -= TOTAL_Z;

            for (const el of meshes) {
                const { mesh, sy, bPhase, fillDelay, type, col } = el;

                // Ola piso a piso: cada edificio tiene su propio desfase
                const adjFill = Math.max(0, this._beatFill - fillDelay);
                // Frente brillante de la ola en el piso actual
                const front   = Math.max(0, 1.0 - Math.abs(sy - adjFill) * 7) * 3.5;
                // Brillo continuo en los pisos ya iluminados por la ola
                const passed  = Math.max(0, Math.min(1.0, (adjFill - sy) * 7));
                const floorGlow = front + passed * 0.85;

                const scan = Math.max(0, 1.0 - Math.abs(sy - ((t * 1.5 + bPhase * 0.16) % 1.0)) * 9) * 0.9;

                const sweepDist = sweepActive ? Math.abs(sy - this._beatSweep) : 2;
                const sweep     = Math.max(0, 1.0 - sweepDist * 14) * 4.0;

                let intensity;

                if (type === 'strip') {
                    const wave = (Math.sin(t * 5.0 - sy * Math.PI * 3.0 + bPhase) + 1) * 0.5;
                    intensity  = 0.03 + wave * 0.12 + scan * 0.3 + sweep + floorGlow + bf * (0.6 + sy * 1.2);
                    const colorMix = (Math.sin(t * 0.8 + sy * Math.PI + bPhase * 0.5) + 1) * 0.5;
                    mesh.material.emissive.lerpColors(
                        this._primaryCol, this._secondaryCol, colorMix * (0.5 + bf * 0.07));

                } else if (type === 'edge') {
                    const pulse = (Math.sin(t * 3.5 + bPhase) + 1) * 0.5;
                    intensity   = 0.06 + pulse * 0.3 + sweep * 0.4 + bf * 1.4 + passed * 0.4;
                    mesh.material.emissive.lerpColors(col, this._white, Math.min(0.85, bf * 0.18));

                } else if (type === 'roof') {
                    intensity = 0.12 + sweep * 0.25 + bf * 2.5 + passed * 0.6;
                    const colorMix = (Math.sin(t * 2.5 + bPhase) + 1) * 0.5;
                    mesh.material.emissive.lerpColors(this._primaryCol, this._secondaryCol, colorMix);

                } else {  // lamp
                    intensity = 0.35 + bf * 2.0;
                    mesh.material.emissive.copy(col);
                }

                mesh.material.emissiveIntensity = Math.min(5.5, intensity);
            }
        }

        // Spawn y movimiento de coches Tron
        this._carSpawnTimer += delta;
        if (this._carSpawnTimer >= this._carSpawnNext && this._cars.length < MAX_CARS) {
            this._spawnCar();
            this._carSpawnTimer = 0;
            this._carSpawnNext  = 3.5 + Math.random() * 5.5;
        }

        const carGlow = 2.0 + bf * 2.5;
        for (let i = this._cars.length - 1; i >= 0; i--) {
            const car = this._cars[i];
            car.group.position.z += car.speed + speed;
            for (const mat of car.glowMats) mat.emissiveIntensity = carGlow;
            if (car.group.position.z > WRAP_Z + 4) {
                this._carGroup.remove(car.group);
                car.group.traverse(child => {
                    if (!child.isMesh) return;
                    child.geometry?.dispose();
                    Array.isArray(child.material)
                        ? child.material.forEach(m => m?.dispose())
                        : child.material?.dispose();
                });
                this._cars.splice(i, 1);
            }
        }
    }

    onSwipe(dir) {
        if (dir === 'left')  this._speedBoost += 0.32;
        if (dir === 'right') this._speedBoost = Math.max(0, this._speedBoost - 0.12);
    }

    onTap()  { this._beatFlash = 2.5; this._beatSweep = 0.0; this._beatFill = 0.0; }
    onBeat() { this._beatFlash = 5.0; this._beatSweep = 0.0; this._beatFill = 0.0; }

    // ── Limpieza ──────────────────────────────────────────────────────────────

    dispose() {
        this._group?.traverse(child => {
            if (!child.isMesh && !child.isLine) return;
            child.geometry?.dispose();
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => m?.dispose());
        });
        this._group?.parent?.remove(this._group);
        this._group         = null;
        this._rows          = [];
        this._centerLineMat = null;
        this._roadEdgeMats  = [];
        this._cars          = [];
        this._carGroup      = null;
    }
}

// PRNG determinista (Park-Miller) — misma semilla → misma ciudad
function _seededRand(seed) {
    let s = seed >>> 0;
    return function () {
        s = Math.imul(48271, s) >>> 0;
        return s / 0xffffffff;
    };
}
