import * as THREE from 'three';

/**
 * Burst of 60 particles emanating from origin on trigger().
 * Uses AdditiveBlending so it glows on dark backgrounds.
 */
export class TapBurstEffect {
    constructor(threeScene, primaryColor) {
        this._count = 60;
        this._timer = 0;
        this._active = false;
        this._velocities = new Float32Array(this._count * 3);

        const positions = new Float32Array(this._count * 3);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const mat = new THREE.PointsMaterial({
            color:       new THREE.Color(primaryColor),
            size:        0.12,
            transparent: true,
            opacity:     0.0,
            sizeAttenuation: true,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
        });

        this._points = new THREE.Points(geo, mat);
        this._points.visible = false;
        threeScene.add(this._points);
    }

    trigger(color) {
        this._active = true;
        this._timer  = 0;
        this._points.visible = true;
        if (color) this._points.material.color.set(color);
        this._points.material.opacity = 1.0;

        const pos = this._points.geometry.attributes.position;
        for (let i = 0; i < this._count; i++) {
            pos.array[i * 3]     = 0;
            pos.array[i * 3 + 1] = 0;
            pos.array[i * 3 + 2] = 0;
            // Random spherical direction
            const theta = Math.random() * Math.PI * 2;
            const phi   = Math.acos(2 * Math.random() - 1);
            const spd   = 0.04 + Math.random() * 0.09;
            this._velocities[i * 3]     = Math.sin(phi) * Math.cos(theta) * spd;
            this._velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * spd;
            this._velocities[i * 3 + 2] = Math.cos(phi) * spd;
        }
        pos.needsUpdate = true;
    }

    update(delta) {
        if (!this._active) return;
        this._timer += delta;
        const progress = this._timer / 0.8; // 800ms lifetime

        const pos = this._points.geometry.attributes.position;
        for (let i = 0; i < this._count; i++) {
            pos.array[i * 3]     += this._velocities[i * 3];
            pos.array[i * 3 + 1] += this._velocities[i * 3 + 1];
            pos.array[i * 3 + 2] += this._velocities[i * 3 + 2];
        }
        pos.needsUpdate = true;

        this._points.material.opacity = Math.max(0, 1 - progress);

        if (progress >= 1) {
            this._active = false;
            this._points.visible = false;
        }
    }

    dispose() {
        this._points.geometry.dispose();
        this._points.material.dispose();
        this._points.parent?.remove(this._points);
    }
}

/**
 * Expanding ring that fades out from the origin on trigger().
 */
export class RingPulseEffect {
    constructor(threeScene, primaryColor) {
        this._timer  = 0;
        this._active = false;

        const geo = new THREE.RingGeometry(0.05, 0.15, 48);
        const mat = new THREE.MeshBasicMaterial({
            color:       new THREE.Color(primaryColor),
            transparent: true,
            opacity:     0.0,
            side:        THREE.DoubleSide,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
        });

        this._mesh = new THREE.Mesh(geo, mat);
        this._mesh.visible = false;
        threeScene.add(this._mesh);
    }

    trigger(color) {
        this._active = true;
        this._timer  = 0;
        if (color) this._mesh.material.color.set(color);
        this._mesh.visible = true;
        this._mesh.scale.setScalar(0.1);
        this._mesh.material.opacity = 1.0;
    }

    update(delta) {
        if (!this._active) return;
        this._timer += delta;
        const progress = this._timer / 0.6; // 600ms lifetime

        this._mesh.scale.setScalar(0.1 + progress * 4.0);
        this._mesh.material.opacity = Math.max(0, 1 - progress);

        if (progress >= 1) {
            this._active = false;
            this._mesh.visible = false;
        }
    }

    dispose() {
        this._mesh.geometry.dispose();
        this._mesh.material.dispose();
        this._mesh.parent?.remove(this._mesh);
    }
}
