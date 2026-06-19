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
            size:  0.18,
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
            size:  0.55,
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
            posC[i3]   = OX + (Math.random() - 0.5) * 0.25;
            posC[i3+1] = OY + (Math.random() - 0.5) * 0.25;
            posC[i3+2] = OZ + (Math.random() - 0.5) * 0.15;
            posG[i3]   = posC[i3];
            posG[i3+1] = posC[i3+1];
            posG[i3+2] = posC[i3+2];

            // Velocity: contained burst (~half screen spread max)
            const theta = Math.random() * Math.PI * 2;
            const phi   = Math.acos(2 * Math.random() - 1);
            const spd   = 0.018 + Math.random() * 0.055;
            this._vel[i3]   = Math.sin(phi) * Math.cos(theta) * spd;
            this._vel[i3+1] = Math.sin(phi) * Math.sin(theta) * spd * 0.6;
            this._vel[i3+2] = Math.abs(Math.cos(phi)) * spd * 0.4 + 0.008;

            // Initial jitter (randomized each frame → electric zigzag)
            this._jitter[i3]   = (Math.random() - 0.5) * 0.018;
            this._jitter[i3+1] = (Math.random() - 0.5) * 0.018;
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
            posC[i3+1] += this._vel[i3+1] + this._jitter[i3+1] - 0.004; // gravity
            posC[i3+2] += this._vel[i3+2];

            posG[i3]   = posC[i3];
            posG[i3+1] = posC[i3+1];
            posG[i3+2] = posC[i3+2];

            // Re-randomize jitter every frame → electric zigzag
            this._jitter[i3]   = (Math.random() - 0.5) * 0.016;
            this._jitter[i3+1] = (Math.random() - 0.5) * 0.016;
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

        const geo = new THREE.RingGeometry(0.1, 0.35, 64);
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
        this._mesh.scale.setScalar(0.2);
        this._mat.opacity = 1.0;
    }

    update(delta) {
        if (!this._active) return;
        this._timer += delta;
        const progress = this._timer / 0.55;

        this._mesh.scale.setScalar(0.2 + progress * 5.5);
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
