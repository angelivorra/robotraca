import * as THREE from 'three';

// Doom II-style hall: a wide, mostly-static room (floor/ceiling/walls are
// each ONE static plane with a scrolling texture — no segmented geometry, so
// there is nothing to seam or pop, ever) with columns, hanging lamps and the
// occasional monster sprite drifting down the room as discrete props,
// individually recycled to the back when they pass the camera.
const ROOM_W      = 14;
const ROOM_H      = 6;
const HALF_W      = ROOM_W / 2;
const HALF_H      = ROOM_H / 2;
const HALL_LEN    = 140;   // static floor/ceiling/wall run — well past the fog
const TILE        = 2;     // world units per texture tile

const STATION_GAP   = 7;
const NUM_STATIONS  = 18;
const TOTAL_Z       = NUM_STATIONS * STATION_GAP;
const WRAP_Z        = STATION_GAP;

const TEX_BASE = 'img/textures/doom/';

export class DoomScene {
    get useBloom() { return false; }

    constructor() {
        this._group    = null;
        this._stations = [];
        this._lights   = [];
        this._scrollTextures = [];
        this._staticTextures = [];
        this._speedBoost = 0;
        this._beatFlash  = 0;
        this._time       = 0;
        this._theme      = null;
    }

    init(threeScene, theme) {
        this._theme = theme;
        this._group = new THREE.Group();
        threeScene.add(this._group);

        threeScene.background = new THREE.Color('#020203');
        threeScene.fog = new THREE.FogExp2(new THREE.Color('#020203'), 0.02);

        _buildRoom(this._group, theme, this._scrollTextures);
        _buildProps(this._group, theme, this._stations, this._lights, this._staticTextures);
    }

    update(reactive, delta) {
        this._speedBoost *= 0.95;
        this._beatFlash  *= 0.86;
        this._time       += delta;

        const speed = 0.042 + reactive.bassEnergy * 0.22 + this._speedBoost;

        // Floor/ceiling/walls never move — only their texture's UV offset
        // scrolls, which is seamless by construction (no segment boundaries).
        // Each surface has its own rotation, so "forward" maps to a different
        // UV axis/sign per surface — see the table built in _buildRoom().
        for (const { tex, axis, dir } of this._scrollTextures) {
            tex.offset[axis] += dir * speed / TILE;
        }

        const flicker  = (Math.sin(this._time * 13.7) * 0.15
                        + Math.sin(this._time * 5.1)  * 0.07)
                        * (0.3 + reactive.highsEnergy);
        const lightEmi = Math.max(0, 0.9 + reactive.bassEnergy * 3.5
                                 + this._beatFlash + flicker);
        const accentEmi = 0.3 + reactive.midsEnergy * 1.2;
        const screenEmi = 0.5 + reactive.highsEnergy * 2.0;

        for (const st of this._stations) {
            st.group.position.z += speed;
        }
        this._wrapStations();

        for (const st of this._stations) {
            for (const m of st.accents) m.material.emissiveIntensity = accentEmi;
            for (const m of st.screens) m.material.emissiveIntensity = screenEmi;
        }
        for (const light of this._lights) {
            light.intensity = lightEmi * light.userData.baseScale;
        }
    }

    _wrapStations() {
        for (const st of this._stations) {
            if (st.group.position.z > WRAP_Z) st.group.position.z -= TOTAL_Z;
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
            if (child.isMesh || child.isSprite) {
                child.geometry?.dispose();
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(m => m?.dispose());
            }
        });
        for (const { tex } of this._scrollTextures) tex.dispose();
        for (const tex of this._staticTextures) tex.dispose();
        this._group?.parent?.remove(this._group);
        this._group    = null;
        this._stations = [];
        this._lights   = [];
        this._scrollTextures = [];
        this._staticTextures = [];
    }
}

// ── Static room shell: floor, ceiling, far side walls ───────────────────────

function _loadTex(loader, name, repeatX, repeatY) {
    const tex = loader.load(TEX_BASE + name);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.magFilter = THREE.NearestFilter; // keep the chunky original-res look
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function _buildRoom(group, theme, scrollTextures) {
    const loader = new THREE.TextureLoader();
    const lenTiles  = HALL_LEN / TILE;
    const widthTiles = ROOM_W / TILE;
    const heightTiles = ROOM_H / TILE;

    const floorTex = _loadTex(loader, 'floor.png', widthTiles, lenTiles);
    const floorMat = new THREE.MeshStandardMaterial({
        map: floorTex, roughness: 0.9, metalness: 0.1,
        emissive: new THREE.Color('#1a1814'), emissiveIntensity: 0.18,
        side: THREE.DoubleSide,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, HALL_LEN), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -HALF_H, -HALL_LEN / 2 + 10);
    group.add(floor);

    const ceilTex = _loadTex(loader, 'ceiling.png', widthTiles, lenTiles);
    const ceilMat = new THREE.MeshStandardMaterial({
        map: ceilTex, roughness: 0.9, metalness: 0.1,
        emissive: new THREE.Color('#141418'), emissiveIntensity: 0.16,
        side: THREE.DoubleSide,
    });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, HALL_LEN), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, HALF_H, -HALL_LEN / 2 + 10);
    group.add(ceiling);

    const wallTexL = _loadTex(loader, 'wall.png', lenTiles, heightTiles);
    const wallTexR = _loadTex(loader, 'wall.png', lenTiles, heightTiles);
    const wallMatL = new THREE.MeshStandardMaterial({
        map: wallTexL, roughness: 0.85, metalness: 0.15,
        emissive: new THREE.Color('#201a16'), emissiveIntensity: 0.16,
        side: THREE.DoubleSide,
    });
    const wallMatR = new THREE.MeshStandardMaterial({
        map: wallTexR, roughness: 0.85, metalness: 0.15,
        emissive: new THREE.Color('#201a16'), emissiveIntensity: 0.16,
        side: THREE.DoubleSide,
    });
    const wallL = new THREE.Mesh(new THREE.PlaneGeometry(HALL_LEN, ROOM_H), wallMatL);
    wallL.rotation.y = Math.PI / 2;
    wallL.position.set(-HALF_W, 0, -HALL_LEN / 2 + 10);
    group.add(wallL);
    const wallR = new THREE.Mesh(new THREE.PlaneGeometry(HALL_LEN, ROOM_H), wallMatR);
    wallR.rotation.y = -Math.PI / 2;
    wallR.position.set(HALF_W, 0, -HALL_LEN / 2 + 10);
    group.add(wallR);

    // Each plane's rotation maps its texture's V/U axis to world Z with a
    // different sign (floor and ceiling are mirrored around X; the two side
    // walls are mirrored around Y) — scroll each on the axis/sign that makes
    // it move toward the camera, same direction as the columns.
    scrollTextures.push(
        { tex: floorTex,  axis: 'y', dir: +1 },
        { tex: ceilTex,   axis: 'y', dir: -1 },
        { tex: wallTexL,  axis: 'x', dir: +1 },
        { tex: wallTexR,  axis: 'x', dir: -1 },
    );
}

// ── Columns, hanging lamps, monster sprites — discrete props ────────────────

function _buildProps(group, theme, stations, lights, staticTextures) {
    const loader    = new THREE.TextureLoader();
    const rand      = _seededRand(4071);
    const primary   = new THREE.Color(theme.primaryColor);
    const secondary = new THREE.Color(theme.secondaryColor);

    const columnTextures = [
        _loadTex(loader, 'column.png', 1, ROOM_H / TILE),
        _loadTex(loader, 'column2.png', 1, ROOM_H / TILE),
    ];
    const columnMats = columnTextures.map(tex => new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.8, metalness: 0.2,
        emissive: new THREE.Color('#1c1916'), emissiveIntensity: 0.2,
    }));

    const panelTextures = [
        _loadTex(loader, 'panel_comp.png', 1, 1),
        _loadTex(loader, 'panel_cons.png', 1, 1),
        _loadTex(loader, 'panel_light.png', 1, 1),
    ];
    const monsterTex = loader.load(TEX_BASE + 'monster_lostsoul.png');
    monsterTex.magFilter = THREE.NearestFilter;
    monsterTex.colorSpace = THREE.SRGBColorSpace;
    staticTextures.push(...columnTextures, ...panelTextures, monsterTex);

    const monsterMat = new THREE.SpriteMaterial({ map: monsterTex, transparent: true, alphaTest: 0.3 });
    const monsterAspect = 49 / 54; // extracted sprite's own width/height

    for (let i = 0; i < NUM_STATIONS; i++) {
        const baseZ = -i * STATION_GAP;
        const sg = new THREE.Group();
        sg.position.z = baseZ;

        const accents = [];
        const screens = [];
        let stationLight = null;

        // Sparse, asymmetric columns: usually one side or none, rarely both —
        // "de vez en cuando una columna a la izquierda o a la derecha".
        const roll = rand();
        const sides = roll < 0.12 ? [-1, 1]
                    : roll < 0.40 ? [-1]
                    : roll < 0.68 ? [1]
                    : [];

        for (const side of sides) {
            const matSet = columnMats[Math.floor(rand() * columnMats.length)];
            const w = 0.9 + rand() * 0.5;
            const d = 0.9 + rand() * 0.5;
            const colX = HALF_W - 1.3 - rand() * 0.6;
            const col = new THREE.Mesh(new THREE.BoxGeometry(w, ROOM_H, d), matSet);
            col.position.set(side * colX, 0, 0);
            sg.add(col);

            // Tech accent panel facing the room centre on some columns
            if (rand() > 0.45) {
                const panelTex = panelTextures[Math.floor(rand() * panelTextures.length)];
                const panelMat = new THREE.MeshStandardMaterial({
                    map: panelTex, roughness: 0.6, metalness: 0.3,
                    emissive: (side < 0 ? primary : secondary), emissiveIntensity: 0.5,
                });
                const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.9), panelMat);
                panel.position.set(side * (colX - w / 2 - 0.01), -0.3, 0);
                panel.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
                sg.add(panel);
                screens.push(panel);
            }
        }

        // Hanging ceiling lamp — real point light, every other station
        if (i % 2 === 0) {
            const lampCol = (i % 4 === 0) ? primary.clone() : secondary.clone();
            const lampMat = new THREE.MeshStandardMaterial({
                color: lampCol, emissive: lampCol, emissiveIntensity: 1.2,
                roughness: 0.3, metalness: 0.0,
            });
            const lampHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.3, 10), lampMat);
            lampHousing.position.set(0, HALF_H - 0.35, 0);
            sg.add(lampHousing);
            accents.push(lampHousing);

            stationLight = new THREE.PointLight(lampCol, 2.4, 13, 1.5);
            stationLight.position.set(0, HALF_H - 0.6, 0);
            stationLight.userData.baseScale = 0.85 + rand() * 0.3;
            sg.add(stationLight);
            lights.push(stationLight);
        }

        // Occasional Doom II monster sprite — a Lost Soul floating to one side.
        if (rand() > 0.82) {
            const monster = new THREE.Sprite(monsterMat);
            const h = 1.1 + rand() * 0.5;
            monster.scale.set(h * monsterAspect, h, 1);
            const mSide = rand() > 0.5 ? -1 : 1;
            monster.position.set(mSide * (HALF_W - 2.5 - rand() * 2), -0.3 + rand() * 1.8, rand() * STATION_GAP * 0.6);
            sg.add(monster);
        }

        group.add(sg);
        stations.push({ group: sg, accents, screens, light: stationLight });
    }
}

function _seededRand(seed) {
    let s = seed >>> 0;
    return () => { s = Math.imul(48271, s + 0x6d2b79f5) >>> 0; return s / 0xffffffff; };
}
