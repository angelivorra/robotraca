import * as THREE from 'three';

// Matrix data tunnel: glyph rain falls down the side walls, the floor and
// ceiling stream toward the camera, and neon gate frames fly past on the beat.
// Everything is procedural (one canvas glyph texture, a few planes and boxes).
const HALF_W   = 7;
const HALF_H   = 4;
const LENGTH   = 140;
const TILE_W   = 6;    // world size of one glyph texture tile
const TILE_H   = 12;
const GATE_COUNT   = 10;
const GATE_SPACING = 13;
const GATE_TOTAL   = GATE_COUNT * GATE_SPACING;
const GATE_WRAP    = 8;

export class MatrixScene {
    get useBloom() { return false; }

    constructor() {
        this._group = null;
        this._rain = [];      // { tex, dir, axis } — side walls (falling)
        this._flow = [];      // floor/ceiling (streaming)
        this._mats = [];
        this._gates = [];
        this._disposables = [];
        this._beatFlash = 0;
        this._speedBoost = 0;
        this._time = 0;
        this._primary = new THREE.Color();
        this._secondary = new THREE.Color();
    }

    init(threeScene, theme) {
        this._group = new THREE.Group();
        threeScene.add(this._group);
        this._primary.set(theme.primaryColor);
        this._secondary.set(theme.secondaryColor);

        threeScene.background = new THREE.Color('#00060a');
        threeScene.fog = new THREE.FogExp2(new THREE.Color('#00100f'), 0.02);

        this._buildWalls();
        this._buildGates();
        this._buildPortal();
    }

    update(reactive, delta) {
        this._time += delta;
        this._beatFlash  *= Math.pow(0.84, delta * 60);
        this._speedBoost *= Math.pow(0.95, delta * 60);

        const bass  = reactive.bassEnergy;
        const speed = (8 + bass * 20 + this._speedBoost * 20) * delta;

        for (const r of this._rain) r.tex.offset.y += (0.18 + bass * 0.25) * delta;
        for (const f of this._flow) f.tex.offset.y += f.dir * speed / TILE_H;

        const glow = 0.8 + bass * 0.7 + this._beatFlash * 0.5;
        for (const m of this._mats) m.color.copy(this._primary).multiplyScalar(glow);

        for (const g of this._gates) {
            g.group.position.z += speed;
            if (g.group.position.z > GATE_WRAP) g.group.position.z -= GATE_TOTAL;
            const wave = Math.max(0, Math.sin(this._time * 5 - g.group.position.z * 0.15));
            const b = 0.6 + this._beatFlash * 1.2 * wave + reactive.midsEnergy * 0.5;
            g.mat.color.copy(this._secondary).multiplyScalar(b);
        }
    }

    // ── Walls ────────────────────────────────────────────────────────────────

    _buildWalls() {
        const glyphs = _glyphTexture();
        this._disposables.push(glyphs);

        const make = (w, h, repeatX, repeatY) => {
            const tex = glyphs.clone();
            tex.needsUpdate = true;
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(repeatX, repeatY);
            const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
            this._mats.push(mat);
            this._disposables.push(tex, mat);
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
            this._disposables.push(mesh.geometry);
            this._group.add(mesh);
            return { mesh, tex };
        };

        const cz = -LENGTH / 2 + 10;
        for (const side of [-1, 1]) {
            const wall = make(LENGTH, HALF_H * 2, LENGTH / TILE_W, (HALF_H * 2) / TILE_H);
            // Plane's long axis (local x) must run along z; texture's u still
            // spans the wall, so rain columns are spread along the tunnel.
            wall.mesh.rotation.y = -side * Math.PI / 2;
            wall.mesh.position.set(side * HALF_W, 0, cz);
            this._rain.push(wall);
        }

        const floor = make(HALF_W * 2, LENGTH, (HALF_W * 2) / TILE_W, LENGTH / TILE_H);
        floor.mesh.rotation.x = -Math.PI / 2;
        floor.mesh.position.set(0, -HALF_H, cz);
        this._flow.push({ tex: floor.tex, dir: 1 });

        const ceil = make(HALF_W * 2, LENGTH, (HALF_W * 2) / TILE_W, LENGTH / TILE_H);
        ceil.mesh.rotation.x = Math.PI / 2;
        ceil.mesh.position.set(0, HALF_H, cz);
        this._flow.push({ tex: ceil.tex, dir: -1 });
    }

    // ── Neon gates ───────────────────────────────────────────────────────────

    _buildGates() {
        const t = 0.14;
        const bars = [
            [HALF_W * 2, t, 0, HALF_H - t / 2], [HALF_W * 2, t, 0, -HALF_H + t / 2],
            [t, HALF_H * 2, HALF_W - t / 2, 0], [t, HALF_H * 2, -HALF_W + t / 2, 0],
        ];
        for (let i = 0; i < GATE_COUNT; i++) {
            const mat = new THREE.MeshBasicMaterial({ color: this._secondary, toneMapped: false });
            const group = new THREE.Group();
            for (const [w, h, x, y] of bars) {
                const geo = new THREE.BoxGeometry(w, h, t);
                this._disposables.push(geo);
                const m = new THREE.Mesh(geo, mat);
                m.position.set(x, y, 0);
                group.add(m);
            }
            group.position.z = -i * GATE_SPACING;
            this._group.add(group);
            this._gates.push({ group, mat });
            this._disposables.push(mat);
        }
    }

    // ── Glowing portal at the far end ───────────────────────────────────────

    _buildPortal() {
        const tex = _canvasTex(256, 256, (c, w, h) => {
            const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
            g.addColorStop(0, 'rgba(255,255,255,0.9)');
            g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = g; c.fillRect(0, 0, w, h);
        });
        const mat = new THREE.MeshBasicMaterial({
            map: tex, color: this._primary, transparent: true, blending: THREE.AdditiveBlending,
            depthWrite: false, fog: false, toneMapped: false,
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 28), mat);
        mesh.position.set(0, 0, -90);
        this._group.add(mesh);
        this._disposables.push(tex, mat, mesh.geometry);
    }

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
        this._rain = [];
        this._flow = [];
        this._mats = [];
        this._gates = [];
        this._disposables = [];
    }
}

function _canvasTex(w, h, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    draw(canvas.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// Grayscale glyph rain (tinted by the material color). Streams wrap around the
// canvas vertically so the texture tiles and scrolls seamlessly.
function _glyphTexture() {
    const CELL = 32, COLS = 16, ROWS = 32;
    const chars = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎ0123456789ﾏﾐﾑﾒﾓ:+*=<>';
    return _canvasTex(COLS * CELL, ROWS * CELL, (c, w, h) => {
        c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
        c.font = `${CELL - 6}px monospace`;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        for (let col = 0; col < COLS; col++) {
            // Two independent streams per column so the rain looks dense.
            for (let s = 0; s < 2; s++) {
            if (Math.random() < 0.15) continue;
            const len  = 5 + Math.floor(Math.random() * 12);
            const head = (s * ROWS / 2 + Math.floor(Math.random() * ROWS / 2)) % ROWS;
            for (let k = 0; k < len; k++) {
                const row = (head - k + ROWS) % ROWS;
                const a = k === 0 ? 1 : Math.pow(1 - k / len, 1.6) * 0.85;
                const v = k === 0 ? 255 : Math.floor(110 + 120 * a);
                c.fillStyle = `rgba(${v},${v},${v},${a})`;
                const ch = chars[Math.floor(Math.random() * chars.length)];
                c.fillText(ch, col * CELL + CELL / 2, row * CELL + CELL / 2);
            }
            }
        }
    });
}
