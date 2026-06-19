import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const _cache = new Map();

function _gltfPaths(songConfig) {
    return (songConfig.objects || []).filter(
        o => o.includes('/') || o.endsWith('.glb') || o.endsWith('.gltf')
    );
}

/**
 * Preloads all assets for a song in parallel.
 * Returns: { audioBuffer, gltfs, subtitleText, bgTexture }
 *   gltfs = { '<path>': gltfResult | null, … }
 */
export async function loadSongAssets(songConfig, onProgress) {
    if (_cache.has(songConfig.id)) {
        onProgress(1.0);
        return _cache.get(songConfig.id);
    }

    const paths  = _gltfPaths(songConfig);
    let total    = 1; // audio always present
    total += paths.length;
    if (songConfig.subtitles)  total++;
    if (songConfig.background) total++;

    let completed = 0;
    const tick = () => { completed++; onProgress(completed / total); };

    const tasks = [];

    // 1. Audio
    tasks.push(
        fetch(songConfig.audio)
            .then(r => { if (!r.ok) throw new Error(`Audio ${r.status}`); return r.arrayBuffer(); })
            .then(buf => { tick(); return { type: 'audio', data: buf }; })
    );

    // 2. GLTF models (one per path in objects array)
    const gltfLoader = new GLTFLoader();
    for (const path of paths) {
        tasks.push(
            gltfLoader.loadAsync(path)
                .then(g  => { console.log('[loader] GLTF OK:', path, g); tick(); return { type: 'gltf', path, data: g    }; })
                .catch(e => { console.error('[loader] GLTF FAIL:', path, e); tick(); return { type: 'gltf', path, data: null }; })
        );
    }

    // 3. Subtitles (optional)
    if (songConfig.subtitles) {
        tasks.push(
            fetch(songConfig.subtitles)
                .then(r => r.ok ? r.text() : null)
                .then(t => { tick(); return { type: 'subtitles', data: t }; })
                .catch(() => { tick(); return { type: 'subtitles', data: null }; })
        );
    }

    // 4. Background texture (optional)
    if (songConfig.background) {
        tasks.push(new Promise(resolve => {
            new THREE.TextureLoader().load(
                songConfig.background,
                tex => { tick(); resolve({ type: 'bg', data: tex  }); },
                undefined,
                ()  => { tick(); resolve({ type: 'bg', data: null }); }
            );
        }));
    }

    const results = await Promise.all(tasks);

    // Build gltfs map
    const gltfs = {};
    for (const r of results.filter(r => r.type === 'gltf')) {
        gltfs[r.path] = r.data;
    }

    const assets = {
        audioBuffer:  results.find(r => r.type === 'audio')?.data     ?? null,
        gltfs,
        subtitleText: results.find(r => r.type === 'subtitles')?.data ?? null,
        bgTexture:    results.find(r => r.type === 'bg')?.data        ?? null,
    };

    _cache.set(songConfig.id, assets);
    return assets;
}

/**
 * Disposes GPU resources for a song and removes it from the cache.
 * Safe to call after visualizer.dispose() has detached the GLTF model
 * from the Three.js scene (GltfObject.dispose removes it from its parent,
 * so we can safely call geometry/material dispose here without affecting
 * anything still live in the scene).
 */
export function evictSongAssets(songId) {
    const assets = _cache.get(songId);
    if (!assets) return;

    for (const gltf of Object.values(assets.gltfs)) {
        if (!gltf) continue;
        gltf.scene.traverse(child => {
            if (!child.isMesh) return;
            child.geometry?.dispose();
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => m?.dispose());
        });
    }

    assets.bgTexture?.dispose();
    _cache.delete(songId);
    console.log('[loader] evicted assets for:', songId);
}

export function clearAssetCache() {
    for (const id of [..._cache.keys()]) evictSongAssets(id);
}
