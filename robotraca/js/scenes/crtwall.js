import * as THREE from 'three';

// Retro CRT monitor wall: a grid of beige-framed monitors behind and around the
// central model. A handful of animated canvas textures (static, SMPTE bars,
// oscilloscope, pixel faces, terminal text, equalizer, radar, no-signal) are
// shared by all screens and redrawn ~8 times per second with scanlines and
// vignette. On every beat random screens glitch (texture swap, jitter, flash).
// Dark floor, hanging cables and a faint glow. All procedural.
const COLS      = 7;
const ROWS      = 5;
const SP_X      = 2.25;
const SP_Y      = 1.75;
const SCR_W     = 1.95;
const SCR_H     = 1.45;
const WALL_Z    = -3.6;
const BASE_Y    = 0.5;
const TEX_W     = 128;
const TEX_H     = 96;
const REDRAW    = 0.12;
const FLOOR_Y   = -3.6;

const PHOSPHOR = '#3dff7a';
const MAGENTA  = '#ff2a9d';
const CYAN     = '#27f5ff';

export class CrtWallScene {
    get useBloom() { return false; }

    constructor() {
        this._group = null;
        this._screens = [];
        this._texs = [];
        this._glows = [];
        this._disposables = [];
        this._beatFlash = 0;
        this._glitchLevel = 1;
        this._time = 0;
        this._acc = 0;
        this._bass = 0;
        this._primary = new THREE.Color();
        this._secondary = new THREE.Color();
        this._tint = new THREE.Color();
    }

    init(threeScene, theme) {
        this._group = new THREE.Group();
        threeScene.add(this._group);
        this._primary.set(theme.primaryColor || MAGENTA);
        this._secondary.set(theme.secondaryColor || CYAN);

        threeScene.background = new THREE.Color('#07020f');
        threeScene.fog = null;

        this._rand = _rng(77);
        this._buildTextures();
        this._buildScreens();
        this._buildFloor();
        this._buildCables();
        this._redraw(0);
    }

    update(reactive, delta) {
        this._time += delta;
        this._beatFlash *= Math.pow(0.84, delta * 60);
        const bass = reactive.bassEnergy;
        this._bass = bass;

        this._acc += delta;
        if (this._acc >= REDRAW) {
            this._acc = 0;
            this._redraw(this._time);
        }

        for (const s of this._screens) {
            // gentle float/sway
            s.group.position.y = s.baseY + Math.sin(this._time * 0.8 + s.phase) * 0.06;
            s.group.rotation.y = s.baseRotY + Math.sin(this._time * 0.5 + s.phase * 1.3) * 0.03;

            s.glitch *= Math.pow(0.84, delta * 60);
            const g = s.glitch;
            if (g < 0.08 && s.glitching) {
                s.glitching = false;
                s.mat.map = this._texs[s.texIdx];
                s.mat.needsUpdate = true;
                s.glass.position.x = 0;
            }
            if (s.glitching) {
                s.glass.position.x = (Math.random() - 0.5) * 0.18 * g;
                if (Math.random() < 0.3) {
                    s.mat.map = this._texs[(Math.random() * this._texs.length) | 0];
                    s.mat.needsUpdate = true;
                }
            }
            // brightness: dim in the center cell group, bass lifts all
            const base = s.dim * (0.62 + bass * 0.55) + this._beatFlash * 0.25 * s.dim;
            this._tint.setScalar(base);
            if (s.glitching) {
                this._tint.lerp(Math.random() < 0.5 ? this._primary : this._secondary, 0.5 * g);
                this._tint.multiplyScalar(1 + g * 0.8);
            }
            s.mat.color.copy(this._tint);
        }

        for (const gl of this._glows) {
            gl.mat.opacity = gl.base * (0.6 + bass * 0.9 + this._beatFlash * 0.5);
        }
    }

    // -- Textures ----------------------------------------------------------

    _buildTextures() {
        const draws = [
            this._drawStatic, this._drawBars, this._drawScope, this._drawFace,
            this._drawTerminal, this._drawEq, this._drawRadar, this._drawNoSignal,
        ];
        for (const fn of draws) {
            const canvas = document.createElement('canvas');
            canvas.width = TEX_W; canvas.height = TEX_H;
            const tex = new THREE.CanvasTexture(canvas);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.magFilter = THREE.NearestFilter;
            this._texs.push(tex);
            this._disposables.push(tex);
            tex.userData = { canvas, ctx: canvas.getContext('2d'), fn: fn.bind(this) };
        }
    }

    _redraw(t) {
        const gl = this._glitchLevel;
        for (let i = 0; i < this._texs.length; i++) {
            const { canvas, ctx, fn } = this._texs[i].userData;
            fn(ctx, TEX_W, TEX_H, t, i);
            // glitch strips: horizontal displacement of random bands right after a beat
            if (this._beatFlash > 0.15) {
                const n = 2 + ((this._beatFlash * 4 * gl) | 0);
                for (let k = 0; k < n; k++) {
                    const y = (Math.random() * TEX_H) | 0;
                    const h = 3 + ((Math.random() * 12) | 0);
                    const dx = ((Math.random() - 0.5) * 40 * this._beatFlash * gl) | 0;
                    ctx.drawImage(canvas, 0, y, TEX_W, h, dx, y, TEX_W, h);
                }
            }
            // scanlines
            ctx.fillStyle = 'rgba(0,0,0,0.28)';
            for (let y = 0; y < TEX_H; y += 2) ctx.fillRect(0, y, TEX_W, 1);
            // vignette
            const v = ctx.createRadialGradient(TEX_W / 2, TEX_H / 2, TEX_H * 0.35, TEX_W / 2, TEX_H / 2, TEX_W * 0.72);
            v.addColorStop(0, 'rgba(0,0,0,0)');
            v.addColorStop(1, 'rgba(0,0,0,0.65)');
            ctx.fillStyle = v;
            ctx.fillRect(0, 0, TEX_W, TEX_H);
            this._texs[i].needsUpdate = true;
        }
    }

    _drawStatic(c, w, h) {
        const img = c.createImageData(w, h);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
            const v = 40 + Math.random() * 215;
            d[i] = v * 0.85; d[i + 1] = v; d[i + 2] = v * 0.95; d[i + 3] = 255;
        }
        c.putImageData(img, 0, 0);
    }

    _drawBars(c, w, h, t) {
        const cols = ['#c8c8c8', '#c8c800', '#00c8c8', '#00c800', '#c800c8', '#c80000', '#0000c8'];
        const bw = w / 7;
        cols.forEach((col, i) => { c.fillStyle = col; c.fillRect(i * bw, 0, bw + 1, h * 0.7); });
        const low = ['#0000c8', '#111', '#c800c8', '#111', '#00c8c8', '#111', '#c8c8c8'];
        low.forEach((col, i) => { c.fillStyle = col; c.fillRect(i * bw, h * 0.7, bw + 1, h * 0.12); });
        c.fillStyle = '#10103a'; c.fillRect(0, h * 0.82, w, h * 0.18);
        c.fillStyle = '#fff'; c.fillRect(((t * 20) % (w + 20)) - 10, h * 0.86, 10, h * 0.1);
    }

    _drawScope(c, w, h, t) {
        c.fillStyle = '#021208'; c.fillRect(0, 0, w, h);
        c.strokeStyle = '#0c4a24'; c.lineWidth = 1;
        for (let x = 0; x <= w; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
        for (let y = 0; y <= h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
        const amp = 14 + this._bass * 24 + this._beatFlash * 10;
        c.strokeStyle = PHOSPHOR; c.lineWidth = 2;
        c.beginPath();
        for (let x = 0; x <= w; x += 2) {
            const y = h / 2 + Math.sin(x * 0.12 + t * 6) * amp * 0.7 + Math.sin(x * 0.31 - t * 9) * amp * 0.3;
            if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.stroke();
    }

    _drawFace(c, w, h, t) {
        const palette = [CYAN, MAGENTA, PHOSPHOR];
        const col = palette[((t * 0.4) | 0) % 3];
        c.fillStyle = '#05050f'; c.fillRect(0, 0, w, h);
        const px = 6, ox = 32, oy = 16;
        const blink = (t % 3) < 0.2;
        const grid = [
            '..XXXXXXXXXX..',
            '.X..........X.',
            'X............X',
            'X..XX....XX..X',
            'X..XX....XX..X',
            'X............X',
            'X.X........X.X',
            'X..X......X..X',
            '.X..XXXXXX..X.',
            '..XXXXXXXXXX..',
        ];
        c.fillStyle = col;
        grid.forEach((row, y) => {
            for (let x = 0; x < row.length; x++) {
                if (row[x] !== 'X') continue;
                if (blink && (y === 3 || y === 4) && x > 2 && x < 11) { if (y === 3) continue; }
                c.fillRect(ox + x * px - 4, oy + y * px, px, px);
            }
        });
    }

    _drawTerminal(c, w, h, t) {
        c.fillStyle = '#020c05'; c.fillRect(0, 0, w, h);
        c.fillStyle = PHOSPHOR; c.font = 'bold 11px monospace';
        const lines = ['SYSTEM ONLINE', '> LINK OK', '> ROBOTRACA v2', '> SYNC .... 100%', '> BEAT SEQ ARMED', '> NO SIGNAL LOST', '> LOADING MUSIC', '> WAKE UP, NEO'];
        const off = Math.floor(t * 1.5);
        for (let i = 0; i < 6; i++) c.fillText(lines[(i + off) % lines.length], 6, 16 + i * 14);
        if (((t * 3) | 0) % 2) c.fillRect(6, 16 + 6 * 14 - 10, 7, 10);
    }

    _drawEq(c, w, h, t) {
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#1a0030'); g.addColorStop(1, '#05000c');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
        const n = 12, bw = w / n;
        for (let i = 0; i < n; i++) {
            const v = 0.2 + 0.5 * Math.abs(Math.sin(t * 3 + i * 0.7)) + this._bass * 0.4;
            const bh = Math.min(0.95, v) * (h - 8);
            c.fillStyle = i % 2 ? MAGENTA : CYAN;
            c.fillRect(i * bw + 2, h - bh - 2, bw - 4, bh);
        }
    }

    _drawRadar(c, w, h, t) {
        c.fillStyle = '#01100a'; c.fillRect(0, 0, w, h);
        const cx = w / 2, cy = h / 2, r = h * 0.44;
        c.strokeStyle = '#146b3a'; c.lineWidth = 1;
        for (let k = 1; k <= 3; k++) { c.beginPath(); c.arc(cx, cy, r * k / 3, 0, 7); c.stroke(); }
        c.beginPath(); c.moveTo(cx - r, cy); c.lineTo(cx + r, cy); c.moveTo(cx, cy - r); c.lineTo(cx, cy + r); c.stroke();
        const a = t * 3;
        for (let k = 0; k < 10; k++) {
            c.strokeStyle = `rgba(61,255,122,${(1 - k / 10) * 0.8})`; c.lineWidth = 2;
            c.beginPath(); c.moveTo(cx, cy);
            c.lineTo(cx + Math.cos(a - k * 0.08) * r, cy + Math.sin(a - k * 0.08) * r); c.stroke();
        }
        c.fillStyle = '#c8ffd8';
        c.fillRect(cx + Math.cos(2.1) * r * 0.6, cy + Math.sin(2.1) * r * 0.6, 4, 4);
        c.fillRect(cx + Math.cos(4.4) * r * 0.4, cy + Math.sin(4.4) * r * 0.4, 4, 4);
    }

    _drawNoSignal(c, w, h, t) {
        c.fillStyle = '#1020a8'; c.fillRect(0, 0, w, h);
        const y0 = ((t * 30) % (h + 20)) - 20;
        c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(0, y0, w, 14);
        c.fillStyle = '#fff'; c.font = 'bold 14px monospace'; c.textAlign = 'center';
        if (((t * 2) | 0) % 2 === 0) c.fillText('NO SIGNAL', w / 2, h / 2 + 5);
        c.textAlign = 'left';
    }

    // -- Screens -----------------------------------------------------------

    _buildScreens() {
        const frameGeo = new THREE.BoxGeometry(SCR_W + 0.3, SCR_H + 0.3, 0.55);
        const frameMatA = new THREE.MeshBasicMaterial({ color: '#8a8070', toneMapped: false });
        const frameMatB = new THREE.MeshBasicMaterial({ color: '#4b4a52', toneMapped: false });
        const glassGeo = new THREE.PlaneGeometry(SCR_W, SCR_H);
        const knobGeo = new THREE.BoxGeometry(0.1, 0.1, 0.06);
        const knobMat = new THREE.MeshBasicMaterial({ color: '#1a1a1e', toneMapped: false });
        const ledMat = new THREE.MeshBasicMaterial({ color: PHOSPHOR, toneMapped: false });
        this._disposables.push(frameGeo, frameMatA, frameMatB, glassGeo, knobGeo, knobMat, ledMat);

        const cx = (COLS - 1) / 2, cy = (ROWS - 1) / 2;
        for (let j = 0; j < ROWS; j++) {
            for (let i = 0; i < COLS; i++) {
                const x = (i - cx) * SP_X;
                const y = BASE_Y + (j - cy) * SP_Y;
                const center = Math.abs(i - cx) <= 1 && Math.abs(j - cy) <= 0.5;
                const group = new THREE.Group();
                const z = WALL_Z - (center ? 1.8 : 0) + ((i + j) % 2) * 0.3;
                group.position.set(x, y, z);
                const rotY = -Math.sign(x) * Math.min(Math.abs(x), 6) * 0.025;
                group.rotation.y = rotY;

                const frame = new THREE.Mesh(frameGeo, (i + j) % 3 ? frameMatA : frameMatB);
                frame.position.z = -0.28;
                group.add(frame);

                const texIdx = (i * 3 + j * 5 + ((this._rand() * 4) | 0)) % this._texs.length;
                const mat = new THREE.MeshBasicMaterial({ map: this._texs[texIdx], toneMapped: false });
                const glass = new THREE.Mesh(glassGeo, mat);
                glass.position.z = 0.005;
                group.add(glass);

                const knob = new THREE.Mesh(knobGeo, knobMat);
                knob.position.set(SCR_W / 2 + 0.05, -SCR_H / 2 - 0.08, 0.0);
                group.add(knob);
                const led = new THREE.Mesh(knobGeo, ledMat);
                led.scale.set(0.5, 0.5, 1);
                led.position.set(-SCR_W / 2, -SCR_H / 2 - 0.08, 0.0);
                group.add(led);

                this._group.add(group);
                this._disposables.push(mat);
                this._screens.push({
                    group, glass, mat, texIdx, baseY: y, baseRotY: rotY,
                    phase: this._rand() * 6.28, glitch: 0, glitching: false,
                    dim: center ? 0.7 : 1,
                });
            }
        }
    }

    // -- Floor, glow, cables ------------------------------------------------

    _buildFloor() {
        const floorMat = new THREE.MeshBasicMaterial({ color: '#0b0516', toneMapped: false });
        const floorGeo = new THREE.PlaneGeometry(60, 40);
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, FLOOR_Y, -8);
        this._group.add(floor);

        const tex = _canvasTex(256, 128, (c, w, h) => {
            const g = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = g; c.fillRect(0, 0, w, h);
        });
        const mk = (color, x, base) => {
            const mat = new THREE.MeshBasicMaterial({
                map: tex, color, transparent: true, opacity: base, depthWrite: false,
                blending: THREE.AdditiveBlending, toneMapped: false,
            });
            const geo = new THREE.PlaneGeometry(14, 7);
            const m = new THREE.Mesh(geo, mat);
            m.rotation.x = -Math.PI / 2;
            m.position.set(x, FLOOR_Y + 0.02, WALL_Z + 1.5);
            this._group.add(m);
            this._glows.push({ mat, base });
            this._disposables.push(mat, geo);
        };
        mk(this._primary, -4, 0.55);
        mk(this._secondary, 4, 0.55);

        // faint grid lines on floor
        const grid = new THREE.GridHelper(60, 40, '#3a1458', '#1d0a30');
        grid.position.set(0, FLOOR_Y + 0.01, -8);
        this._group.add(grid);
        this._disposables.push(grid.geometry, grid.material);

        this._disposables.push(floorMat, floorGeo, tex);
    }

    _buildCables() {
        const colors = ['#ff2a9d', '#27f5ff', '#1a1a22', '#3dff7a'];
        const topY = BASE_Y + (ROWS / 2) * SP_Y + 0.4;
        for (let k = 0; k < 14; k++) {
            const x0 = (this._rand() * 2 - 1) * 7.5;
            const x1 = x0 + (this._rand() - 0.5) * 3;
            const z0 = WALL_Z + 0.6 + this._rand() * 0.8;
            const sag = 1.2 + this._rand() * 2.2;
            const pts = [];
            for (let s = 0; s <= 16; s++) {
                const u = s / 16;
                pts.push(new THREE.Vector3(
                    x0 + (x1 - x0) * u,
                    topY - Math.sin(u * Math.PI) * sag - u * 1.2 * (k % 3),
                    z0 + Math.sin(u * 3) * 0.1));
            }
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            const mat = new THREE.LineBasicMaterial({
                color: colors[k % colors.length], transparent: true, opacity: 0.7, toneMapped: false,
            });
            this._group.add(new THREE.Line(geo, mat));
            this._disposables.push(geo, mat);
        }
    }

    // -- Interaction -------------------------------------------------------

    onBeat() {
        this._beatFlash = 1.0;
        for (const s of this._screens) {
            if (this._rand() < 0.28 * this._glitchLevel || Math.random() < 0.28 * this._glitchLevel) {
                s.glitch = 1; s.glitching = true;
            }
        }
    }

    onTap() {
        this._beatFlash = 1.5;
        for (const s of this._screens) { s.glitch = 1; s.glitching = true; }
    }

    onSwipe(dir) {
        if (dir === 'up')   this._glitchLevel = Math.min(2.5, this._glitchLevel + 0.5);
        if (dir === 'down') this._glitchLevel = Math.max(0.2, this._glitchLevel - 0.5);
    }

    dispose() {
        for (const d of this._disposables) d.dispose();
        this._group?.parent?.remove(this._group);
        this._group = null;
        this._screens = [];
        this._texs = [];
        this._glows = [];
        this._disposables = [];
    }
}

function _rng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
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
