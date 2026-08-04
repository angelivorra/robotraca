import * as THREE from 'three';

export class IcosahedronObject {
    constructor() {
        this._mesh     = null;
        this._theme    = null;
        this._tapTimer = 0;
    }

    init(parentGroup, theme) {
        this._theme = theme;
        const geo = new THREE.IcosahedronGeometry(1.2, 1);
        const mat = new THREE.MeshStandardMaterial({
            color:            new THREE.Color(theme.primaryColor),
            emissive:         new THREE.Color(theme.primaryColor),
            emissiveIntensity: 0.2,
            roughness:        0.4,
            metalness:        0.6,
            wireframe:        true,
        });
        this._mesh = new THREE.Mesh(geo, mat);
        parentGroup.add(this._mesh);
    }

    update(reactive /*, delta */) {
        if (!this._mesh) return;
        // Scale with bass
        const s = (this._theme?.modelBaseScale ?? 1) + reactive.bassEnergy * 0.4;
        this._mesh.parent.scale.setScalar(s);
        // Emissive with highs
        this._mesh.material.emissiveIntensity = 0.1 + reactive.highsEnergy * 1.2;
    }

    onBeat() {
        if (this._mesh) this._mesh.material.emissiveIntensity = 2.5;
    }

    onTap() {
        if (this._mesh) this._mesh.material.emissiveIntensity = 3.0;
    }

    dispose() {
        this._mesh?.geometry.dispose();
        this._mesh?.material.dispose();
        this._mesh?.parent?.remove(this._mesh);
        this._mesh = null;
    }
}
