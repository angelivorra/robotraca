import * as THREE from 'three';

/**
 * Electric spark burst — two-layer: bright white core + colored glow halo.
 * Positioned in front of the 3D model (z > 0, between model and camera).
 * Particles zigzag each frame for the electric look.
 */
export class TapBurstEffect {
    constructor(threeScene, primaryColor) {
        this._count  = 180;
        this._active = false;
        this._timer  = 0;
        this._vel    = new Float32Array(this._count * 3);
        this._jitter = new Float32Array(this._count * 3);

        // ── White core: small, very bright ──────────────────────────────────
        const posC = new Float32Array(this._count * 3);
        const geoC = new THREE.BufferGeometry();
        geoC.setAttribute('position', new THREE.BufferAttribute(posC, 3));
        this._matCore = new THREE.PointsMaterial({
            color: 0xffffff,
            size:  0.09,
            transparent: true, opacity: 0,
            sizeAttenuation: true,
            blending:   THREE.AdditiveBlending,
            depthWrite: false,
            depthTest:  false,
        });
        this._core = new THREE.Points(geoC, this._matCore);
        this._core.renderOrder = 999;
        this._core.visible = false;
        threeScene.add(this._core);

        // ── Colored glow: large, semi-transparent halo around sparks ─────────
        const posG = new Float32Array(this._count * 3);
        const geoG = new THREE.BufferGeometry();
        geoG.setAttribute('position', new THREE.BufferAttribute(posG, 3));
        this._matGlow = new THREE.PointsMaterial({
            color: new THREE.Color(primaryColor),
            size:  0.275,
            transparent: true, opacity: 0,
            sizeAttenuation: true,
            blending:   THREE.AdditiveBlending,
            depthWrite: false,
            depthTest:  false,
        });
        this._glow = new THREE.Points(geoG, this._matGlow);
        this._glow.renderOrder = 998;
        this._glow.visible = false;
        threeScene.add(this._glow);
    }

    trigger(color, position) {
        if (color) this._matGlow.color.set(color);
        this._active = true;
        this._timer  = 0;
        this._core.visible = true;
        this._glow.visible = true;
        this._matCore.opacity = 1.0;
        this._matGlow.opacity = 0.7;

        const posC = this._core.geometry.attributes.position.array;
        const posG = this._glow.geometry.attributes.position.array;

        // Origin: tap position projected onto z=1.5 plane, or center if unknown
        const OX = position ? position.x : 0;
        const OY = position ? position.y : 0;
        const OZ = position ? position.z : 1.5;

        for (let i = 0; i < this._count; i++) {
            const i3 = i * 3;
            posC[i3]   = OX + (Math.random() - 0.5) * 0.125;
            posC[i3+1] = OY + (Math.random() - 0.5) * 0.125;
            posC[i3+2] = OZ + (Math.random() - 0.5) * 0.075;
            posG[i3]   = posC[i3];
            posG[i3+1] = posC[i3+1];
            posG[i3+2] = posC[i3+2];

            // Velocity: contained burst (~half screen spread max)
            const theta = Math.random() * Math.PI * 2;
            const phi   = Math.acos(2 * Math.random() - 1);
            const spd   = 0.009 + Math.random() * 0.0275;
            this._vel[i3]   = Math.sin(phi) * Math.cos(theta) * spd;
            this._vel[i3+1] = Math.sin(phi) * Math.sin(theta) * spd * 0.6;
            this._vel[i3+2] = Math.abs(Math.cos(phi)) * spd * 0.4 + 0.004;

            // Initial jitter (randomized each frame → electric zigzag)
            this._jitter[i3]   = (Math.random() - 0.5) * 0.009;
            this._jitter[i3+1] = (Math.random() - 0.5) * 0.009;
            this._jitter[i3+2] = 0;
        }
        this._core.geometry.attributes.position.needsUpdate = true;
        this._glow.geometry.attributes.position.needsUpdate = true;
    }

    update(delta) {
        if (!this._active) return;
        this._timer += delta;
        const DURATION = 0.42;
        const progress = this._timer / DURATION;

        const posC = this._core.geometry.attributes.position.array;
        const posG = this._glow.geometry.attributes.position.array;

        for (let i = 0; i < this._count; i++) {
            const i3 = i * 3;

            posC[i3]   += this._vel[i3]   + this._jitter[i3];
            posC[i3+1] += this._vel[i3+1] + this._jitter[i3+1] - 0.002; // gravity
            posC[i3+2] += this._vel[i3+2];

            posG[i3]   = posC[i3];
            posG[i3+1] = posC[i3+1];
            posG[i3+2] = posC[i3+2];

            // Re-randomize jitter every frame → electric zigzag
            this._jitter[i3]   = (Math.random() - 0.5) * 0.008;
            this._jitter[i3+1] = (Math.random() - 0.5) * 0.008;
        }
        this._core.geometry.attributes.position.needsUpdate = true;
        this._glow.geometry.attributes.position.needsUpdate = true;

        // Fast quadratic fade — bright flash at start, quick drop-off
        const fade = Math.max(0, 1 - progress * progress);
        this._matCore.opacity = fade;
        this._matGlow.opacity = fade * 0.55;

        if (progress >= 1) {
            this._active = false;
            this._core.visible = false;
            this._glow.visible = false;
        }
    }

    dispose() {
        this._core.geometry.dispose();  this._matCore.dispose();
        this._glow.geometry.dispose();  this._matGlow.dispose();
        this._core.parent?.remove(this._core);
        this._glow.parent?.remove(this._glow);
    }
}

/**
 * Expanding ring that fades out from the origin on trigger().
 */
export class RingPulseEffect {
    constructor(threeScene, primaryColor) {
        this._timer  = 0;
        this._active = false;

        const geo = new THREE.RingGeometry(0.05, 0.175, 64);
        this._mat = new THREE.MeshBasicMaterial({
            color:       new THREE.Color(primaryColor),
            transparent: true,
            opacity:     0.0,
            side:        THREE.DoubleSide,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
            depthTest:   false,
        });

        this._mesh = new THREE.Mesh(geo, this._mat);
        this._mesh.renderOrder = 997;
        // Face the camera (XY plane, since camera is on Z axis)
        this._mesh.position.z = 1.5;
        this._mesh.visible = false;
        threeScene.add(this._mesh);
    }

    trigger(color, position) {
        this._active = true;
        this._timer  = 0;
        if (color) this._mat.color.set(color);
        this._mesh.position.set(
            position ? position.x : 0,
            position ? position.y : 0,
            position ? position.z : 1.5
        );
        this._mesh.visible = true;
        this._mesh.scale.setScalar(0.1);
        this._mat.opacity = 1.0;
    }

    update(delta) {
        if (!this._active) return;
        this._timer += delta;
        const progress = this._timer / 0.55;

        this._mesh.scale.setScalar(0.1 + progress * 2.75);
        this._mat.opacity = Math.max(0, 1 - progress);

        if (progress >= 1) {
            this._active = false;
            this._mesh.visible = false;
        }
    }

    dispose() {
        this._mesh.geometry.dispose();
        this._mat.dispose();
        this._mesh.parent?.remove(this._mesh);
    }
}

/**
 * Pixel-art ripple: where you touch, a ring of chunky pixels spreads out, displacing and
 * posterizing the image underneath.
 *
 * Cheap on purpose: no full-screen post-processing. After the normal render we copy just a
 * small square of the framebuffer around the touch into a texture, then redraw that square
 * with a shader. Nothing is drawn or copied while the effect is idle.
 */
export class PixelRippleEffect {
    constructor(renderer) {
        this._renderer = renderer;
        this._active   = false;
        this._timer    = 0;
        this._tex      = null;
        this._rect     = { x: 0, y: 0, size: 0 };   // drawing-buffer pixels

        this._cam   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this._scene = new THREE.Scene();
        this._mat   = new THREE.ShaderMaterial({
            depthTest: false, depthWrite: false,
            uniforms: {
                uTex:      { value: null },
                uCenter:   { value: new THREE.Vector2(0.5, 0.5) },   // touch point inside the square (0..1)
                uProgress: { value: 0 },
                uCells:    { value: 40 },                            // chunky pixels across the square
            },
            vertexShader: `
                varying vec2 vUv;
                void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
            fragmentShader: `
                uniform sampler2D uTex;
                uniform vec2  uCenter;
                uniform float uProgress;
                uniform float uCells;
                varying vec2 vUv;
                void main() {
                    vec4 orig = texture2D(uTex, vUv);
                    // Snap to a chunky pixel grid
                    vec2 q = (floor(vUv * uCells) + 0.5) / uCells;
                    vec2 d = q - uCenter;
                    float dist = length(d);
                    // Ring front grows from the touch point and fades out (0.45 = square half-size)
                    float r    = uProgress * 0.46;
                    float band = 0.075 + 0.05 * uProgress;
                    // Sharp front, longer wake behind it
                    float s    = dist < r ? band * 2.4 : band;
                    float ring = exp(-pow((dist - r) / s, 2.0));
                    ring *= 1.0 - uProgress * uProgress;
                    if (ring < 0.03) discard;
                    // Push pixels outward along the ring, in whole-cell steps
                    vec2 dir  = d / max(dist, 1e-4);
                    vec2 src  = q - dir * floor(ring * 5.0 + 0.5) / uCells;
                    vec3 col  = texture2D(uTex, src).rgb;
                    // Retro palette: few levels per channel, plus a brighter crest on the front
                    col = floor(col * 5.0 + 0.5) / 5.0;
                    col += step(0.8, ring) * 0.12;
                    gl_FragColor = vec4(mix(orig.rgb, col, smoothstep(0.03, 0.3, ring)), 1.0);
                }`,
        });
        this._scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._mat));
    }

    /** x, y in CSS pixels (clientX / clientY). */
    trigger(x, y) {
        const r   = this._renderer;
        const pr  = r.getPixelRatio();
        const buf = r.getDrawingBufferSize(new THREE.Vector2());
        const css = Math.min(window.innerWidth, window.innerHeight);
        const size = Math.min(Math.round(Math.min(300, css * 0.78) * pr), buf.x, buf.y);

        const cx = x * pr, cy = buf.y - y * pr;                       // buffer coords, origin bottom-left
        const ox = Math.min(Math.max(Math.round(cx - size / 2), 0), buf.x - size);
        const oy = Math.min(Math.max(Math.round(cy - size / 2), 0), buf.y - size);
        this._rect = { x: ox, y: oy, size };

        if (!this._tex || this._tex.image.width !== size) {
            this._tex?.dispose();
            this._tex = new THREE.FramebufferTexture(size, size);
            this._tex.minFilter = THREE.NearestFilter;
            this._tex.magFilter = THREE.NearestFilter;
        }
        this._mat.uniforms.uTex.value = this._tex;
        this._mat.uniforms.uCenter.value.set((cx - ox) / size, (cy - oy) / size);
        this._mat.uniforms.uCells.value = Math.max(8, Math.round(size / (5 * pr)));   // ~5 CSS px per chunky pixel
        this._timer  = 0;
        this._active = true;
    }

    update(delta) {
        if (!this._active) return;
        this._timer += delta;
        if (this._timer >= DURATION_RIPPLE) this._active = false;
        // Stepped animation (about 12 steps per second) for the pixel-art feel
        this._mat.uniforms.uProgress.value = Math.floor(Math.min(this._timer / DURATION_RIPPLE, 1) * 9) / 9;
    }

    /** Call right after the scene has been rendered. */
    render() {
        if (!this._active || !this._tex) return;
        const r  = this._renderer, pr = r.getPixelRatio(), { x, y, size } = this._rect;
        r.copyFramebufferToTexture(this._tex, new THREE.Vector2(x, y));

        const vp = r.getViewport(new THREE.Vector4());
        const auto = r.autoClear;
        r.autoClear = false;
        r.setViewport(x / pr, y / pr, size / pr, size / pr);
        r.render(this._scene, this._cam);
        r.setViewport(vp);
        r.autoClear = auto;
    }

    dispose() {
        this._tex?.dispose();
        this._mat.dispose();
        this._scene.children[0].geometry.dispose();
    }
}

const DURATION_RIPPLE = 0.75;   // seconds
