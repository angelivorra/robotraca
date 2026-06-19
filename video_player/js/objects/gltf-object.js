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
        console.log('[GltfObject] init, gltf:', this._gltf);
        if (!this._gltf) { console.warn('[GltfObject] no gltf data, skipping'); return; }

        // Use scene directly — clone(true) can silently fail on skinned/animated GLTFs
        const model = this._gltf.scene;

        // Auto-center and normalize to 2 units
        const box    = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size   = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        model.position.sub(center);
        if (maxDim > 0) model.scale.setScalar(2 / maxDim);

        const emissiveEnabled = theme.modelEmissive !== false;
        const primary   = new THREE.Color(theme.primaryColor);
        const secondary = new THREE.Color(theme.secondaryColor);
        let meshIdx = 0;
        model.traverse(child => {
            if (!child.isMesh) return;
            child.castShadow    = true;
            child.receiveShadow = true;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => {
                if (!m) return;
                if (emissiveEnabled) {
                    if ('emissive' in m && m.emissive.getHex() === 0) {
                        m.emissive.copy(meshIdx % 2 === 0 ? primary : secondary);
                    }
                    if ('emissiveIntensity' in m) m.emissiveIntensity = 0.4;
                } else {
                    // Matte: kill all emissive, bump roughness for a flat look
                    if ('emissive' in m)          m.emissive.set(0, 0, 0);
                    if ('emissiveIntensity' in m)  m.emissiveIntensity = 0;
                    if ('roughness' in m)          m.roughness = 1.0;
                    if ('metalness' in m)          m.metalness = 0.0;
                }
            });
            this._meshes.push(child);
            meshIdx++;
        });

        console.log('[GltfObject] meshes found:', this._meshes.length, '| model position:', model.position, '| scale:', model.scale);
        if (this._meshes.length === 0) {
            console.warn('[GltfObject] Model loaded but has no visible meshes:', this._gltf);
        }

        this._model = model;
        parentGroup.add(model);
    }

    update(reactive /*, delta */) {
        if (!this._model || !this._theme) return;
        if (this._theme.modelEmissive === false) return; // matte: no reactive glow
        const intensity = 0.3 + reactive.bassEnergy * 1.5 + reactive.highsEnergy * 1.0;
        for (const mesh of this._meshes) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach(m => {
                if (m && 'emissiveIntensity' in m) m.emissiveIntensity = intensity;
            });
        }
    }

    onBeat() {
        if (this._theme?.modelEmissive === false) return;
        for (const mesh of this._meshes) {
            if (mesh.material && 'emissiveIntensity' in mesh.material) {
                mesh.material.emissiveIntensity = 2.0;
            }
        }
    }

    onTap() {
        if (this._theme?.modelEmissive === false) return;
        for (const mesh of this._meshes) {
            if (mesh.material && 'emissiveIntensity' in mesh.material) {
                mesh.material.emissiveIntensity = 3.0;
            }
        }
    }

    dispose() {
        // Only detach from the parent — do NOT dispose geometries/materials here
        // because this._model is the shared gltf.scene from the asset cache.
        // Disposing it would permanently destroy the GPU resources for future plays.
        this._model?.parent?.remove(this._model);
        this._model  = null;
        this._meshes = [];
    }
}
