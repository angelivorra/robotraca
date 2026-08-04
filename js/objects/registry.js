import { GltfObject }     from './gltf-object.js';
import { TorusKnotObject } from './torus-knot.js';
import { IcosahedronObject } from './icosahedron.js';

const PROCEDURAL = {
    'torus-knot':  TorusKnotObject,
    'icosahedron': IcosahedronObject,
};

function _isGltfPath(spec) {
    return spec.includes('/') || spec.endsWith('.glb') || spec.endsWith('.gltf');
}

/**
 * Picks one object spec from the list, preferring loaded GLTF files.
 * Falls back to procedurals if all GLTF entries failed to load.
 */
export function pickObjectSpec(specs, gltfs) {
    console.log('[registry] pickObjectSpec specs:', specs, 'gltfs keys:', Object.keys(gltfs), 'gltfs values null?:', Object.entries(gltfs).map(([k,v]) => `${k}=${v==null?'NULL':'OK'}`));
    const available = specs.filter(spec => {
        if (_isGltfPath(spec)) return gltfs[spec] != null;
        return spec in PROCEDURAL;
    });
    console.log('[registry] available:', available);
    if (available.length === 0) return 'icosahedron';
    return available[Math.floor(Math.random() * available.length)];
}

/**
 * Creates an object instance for the picked spec.
 */
export function createObject(spec, gltfs) {
    if (_isGltfPath(spec)) {
        return new GltfObject(gltfs[spec] ?? null);
    }
    const Cls = PROCEDURAL[spec] ?? IcosahedronObject;
    return new Cls();
}
