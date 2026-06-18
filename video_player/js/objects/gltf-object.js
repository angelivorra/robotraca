import * as THREE from 'three';

export class GltfObject {
    constructor(gltf) {
        this._gltf  = gltf;
        this._model = null;
        this._theme = null;
        this._meshes = [];
    }

    init(parentGroup, theme) {
        this._theme = theme;
        if (!this._gltf) return;

        // Use scene directly — clone(true) can silently fail on skinned/animated GLTFs
        const model = this._gltf.scene;

        // Auto-center and normalize to 2 units
        const box    = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size   = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        model.position.sub(center);
        if (maxDim > 0) model.scale.setScalar(2 / maxDim);

        // Collect meshes for reactive updates
        model.traverse(child => {
            if (child.isMesh) {
                child.castShadow    = true;
                child.receiveShadow = true;
                this._meshes.push(child);
            }
        });

        if (this._meshes.length === 0) {
            console.warn('[GltfObject] Model loaded but has no visible meshes:', this._gltf);
        }

        this._model = model;
        parentGroup.add(model);
    }

    update(reactive /*, delta */) {
        if (!this._model || !this._theme) return;
        // Emissive with highs
        for (const mesh of this._meshes) {
            if (mesh.material && 'emissiveIntensity' in mesh.material) {
                mesh.material.emissiveIntensity = reactive.highsEnergy * 0.8;
            }
        }
    }

    onBeat() {
        for (const mesh of this._meshes) {
            if (mesh.material && 'emissiveIntensity' in mesh.material) {
                mesh.material.emissiveIntensity = 2.0;
            }
        }
    }

    onTap() {
        for (const mesh of this._meshes) {
            if (mesh.material && 'emissiveIntensity' in mesh.material) {
                mesh.material.emissiveIntensity = 3.0;
            }
        }
    }

    dispose() {
        if (this._model) {
            this._model.traverse(child => {
                if (child.isMesh) {
                    child.geometry?.dispose();
                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    mats.forEach(m => m?.dispose());
                }
            });
            this._model.parent?.remove(this._model);
        }
        this._model  = null;
        this._meshes = [];
    }
}
