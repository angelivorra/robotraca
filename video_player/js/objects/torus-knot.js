import * as THREE from 'three';

export class TorusKnotObject {
    constructor() {
        this._mesh  = null;
        this._theme = null;
    }

    init(parentGroup, theme) {
        this._theme = theme;
        const geo = new THREE.TorusKnotGeometry(0.8, 0.2, 128, 16);
        const mat = new THREE.MeshStandardMaterial({
            color:            new THREE.Color(theme.primaryColor),
            emissive:         new THREE.Color(theme.primaryColor),
            emissiveIntensity: 0.3,
            roughness:        0.2,
            metalness:        0.9,
        });
        this._mesh = new THREE.Mesh(geo, mat);
        parentGroup.add(this._mesh);
    }

    update(reactive /*, delta */) {
        if (!this._mesh) return;
        // Slow self-rotation (complements the group rotation in visualizer)
        this._mesh.rotation.z += 0.003;
        // Emissive with highs
        this._mesh.material.emissiveIntensity = 0.2 + reactive.highsEnergy * 1.5;
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
