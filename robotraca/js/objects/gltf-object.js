import * as THREE from 'three';
import { IdleAnimator } from './idle-animations.js';
import { WireSpark } from './wire-spark.js';
import { makeSilver } from './silver-material.js';

const HEADBANG_PITCH = 0.42;   // radians the head drops forward on each beat (~24°)

const GRID_LEAD = 0.03;   // seconds: start the nod slightly early so it lands on the beat

export class GltfObject {
    constructor(gltf) {
        this._gltf  = gltf;
        this._model = null;
        this._theme = null;
        this._meshes = [];

        // Optional rig (only models exported with these nodes, e.g. atodoquesi)
        this._mouth = null;
        this._mouthBase = null;
        this._lids  = null;
        this._open  = 0;          // smoothed mouth opening 0-1
        this._time  = 0;
        this._nextBlink = 2.5;
        this._blinkLeft = 0;      // seconds of blink remaining
        this._blinksQueued = 0;

        this._idle  = new IdleAnimator();
        this._speaking = false;
        this._grid = null;        // beat times of the song (seconds), if analysed offline
        this._gridIdx = 0;
        this._lastT = 0;
        this._beatCount = 0;
        this._bang  = 0;          // headbang impulse, set on beat while nobody sings
        this._bangShown = 0;
        this._spark = null;       // spark running along the head wire (models with that wire)
        this._pivot = null;       // wrapper at the visual centre, used for idle gestures
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

        // Cheaper shading for modest phones: Lambert with the base colour only. The PBR
        // maps (normal, metal/roughness) cost a lot of fill-rate for little visible gain.
        const cheap = new Map();
        model.traverse(child => {
            if (!child.isMesh) return;
            const list = Array.isArray(child.material) ? child.material : [child.material];
            const out = list.map(m => {
                if (!m || m.isMeshLambertMaterial) return m;
                if (!cheap.has(m)) {
                    cheap.set(m, new THREE.MeshLambertMaterial({
                        name: m.name, map: m.map, color: m.color, side: m.side,
                        transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest,
                    }));
                    m.dispose();
                }
                return cheap.get(m);
            });
            child.material = Array.isArray(child.material) ? out : out[0];
        });

        // Silver metallic faces on the head; the mouth (teeth!) keeps its own plain material
        const headMesh = model.getObjectByName('Head'), mouthMesh = model.getObjectByName('Mouth');
        if (headMesh?.isMesh && !headMesh.material.userData.silver) {
            if (mouthMesh?.isMesh && mouthMesh.material === headMesh.material) {
                mouthMesh.material = headMesh.material.clone();
            }
            makeSilver(headMesh.material);
        }

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

        this._mouth = model.getObjectByName('Mouth') ?? null;
        this._lids  = model.getObjectByName('Lids') ?? null;
        if (this._mouth) {
            this._mouthBase = {
                position: this._mouth.position.clone(),
                rotation: this._mouth.rotation.clone(),
                scale:    this._mouth.scale.clone(),
            };
        }
        if (this._lids) this._lids.visible = false;
        this._open = 0;
        this._time = 0;
        this._nextBlink = 2.5;
        this._blinkLeft = 0;
        this._blinksQueued = 0;

        this._idle.reset();
        this._beatCount = 0;
        if (this._mouth) {         // the robot rig also has the wire on top of its head
            this._spark = new WireSpark();
            model.add(this._spark.object);
        }
        this._pivot = new THREE.Group();
        this._pivot.add(model);
        this._model = model;
        parentGroup.add(this._pivot);
    }

    update(reactive, delta) {
        if (!this._model || !this._theme) return;
        this._animateMouth(reactive, delta);
        this._animateBlink(delta);
        this._animateIdle(reactive, delta);
        this._spark?.update(delta);
        if (this._theme.modelEmissive === false) return; // matte: no reactive glow
        const intensity = 0.3 + reactive.bassEnergy * 1.5 + reactive.highsEnergy * 1.0;
        for (const mesh of this._meshes) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach(m => {
                if (m && 'emissiveIntensity' in m) m.emissiveIntensity = intensity;
            });
        }
    }

    // Mouth: opens/closes while there is voice (subtitle cue active), calm otherwise
    _animateMouth(reactive, delta) {
        const m = this._mouth;
        if (!m || !this._mouthBase) return;
        this._time += delta;
        let target = 0;
        if (reactive.speaking) {
            const syl    = Math.abs(Math.sin(this._time * 14.6)) * (0.6 + 0.4 * Math.sin(this._time * 4.2));
            const phrase = Math.sin(this._time * 7.8) > -0.35 ? 1 : 0.1;
            target = Math.min(1, 0.1 + 0.6 * syl * phrase + 0.8 * reactive.midsEnergy);
        }
        this._open += (target - this._open) * (1 - Math.pow(0.42, delta * 60));
        const o = this._open, b = this._mouthBase;
        m.scale.set(b.scale.x * (1 - 0.08 * o), b.scale.y * (1 + 0.65 * o), b.scale.z);
        m.position.set(b.position.x, b.position.y - 0.04 * o, b.position.z + 0.04 * o);
        m.rotation.set(b.rotation.x + 0.3 * o, b.rotation.y, b.rotation.z);
    }

    /** Beat times (seconds) found by analysing the audio offline; the headbang follows them. */
    setBeatGrid(beats) {
        this._grid = beats?.length ? beats : null;
        this._gridIdx = 0;
        this._lastT = 0;
    }

    // Headbang on the song's own beat grid (steady, always on the beat) instead of the live detector
    _followGrid(t) {
        const g = this._grid;
        if (!g || t == null) return;
        if (t < this._lastT - 0.3) {            // jumped back: find our place again
            let lo = 0, hi = g.length;
            while (lo < hi) { const mid = (lo + hi) >> 1; if (g[mid] - GRID_LEAD < t) lo = mid + 1; else hi = mid; }
            this._gridIdx = lo;
        }
        this._lastT = t;
        while (this._gridIdx < g.length && g[this._gridIdx] - GRID_LEAD <= t) {
            const late = t - g[this._gridIdx];  // skip beats we missed (lag, jump forward)
            if (late < 0.25 && !this._speaking && this._pivot) this._bang = 1;
            this._gridIdx++;
        }
    }

    // Idle gestures (nod, tilt, hop…) while facing the camera and untouched
    _animateIdle(reactive, delta) {
        if (!this._pivot) return;
        this._speaking = !!reactive.speaking;
        this._followGrid(reactive.time);

        // Headbang: snap forward on the beat, rise back slowly
        this._bang *= Math.pow(0.9, delta * 60);
        this._bangShown += (this._bang - this._bangShown) * (1 - Math.pow(0.3, delta * 60));
        const bang = this._bangShown;

        const p = this._idle.update(!!reactive.idle, delta);
        this._pivot.rotation.set((p?.rx ?? 0) + HEADBANG_PITCH * bang, p?.ry ?? 0, p?.rz ?? 0);
        this._pivot.position.set(p?.px ?? 0, (p?.py ?? 0) - 0.05 * bang, p?.pz ?? 0);
        this._pivot.scale.set(p?.sx ?? 1, p?.sy ?? 1, p?.sz ?? 1);
    }

    // Blink: black discs over the eyes for a split second, at random intervals
    _animateBlink(delta) {
        if (!this._lids) return;
        if (this._blinkLeft > 0) {
            this._blinkLeft -= delta;
            if (this._blinkLeft <= 0) {
                this._lids.visible = false;
                if (this._blinksQueued > 0) {   // double blink
                    this._blinksQueued--;
                    this._nextBlink = 0.12;
                } else {
                    this._nextBlink = 2.5 + Math.random() * 3.5;
                }
            }
            return;
        }
        this._nextBlink -= delta;
        if (this._nextBlink <= 0) {
            this._lids.visible = true;
            this._blinkLeft = 0.14;
            if (Math.random() < 0.2) this._blinksQueued = 1;
        }
    }

    onBeat() {
        // Headbang on every Nth beat (theme.headbangEvery, default 1); the count keeps going
        // while someone sings so the rhythm stays steady
        if (!this._grid) {   // no beat grid for this song: use the live detector
            this._beatCount++;
            const every = this._theme?.headbangEvery ?? 1;
            if (!this._speaking && this._pivot && this._beatCount % every === 0) this._bang = 1;
        }
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
        // The gltf scene is shared through the asset cache: put the rig back as found
        if (this._mouth && this._mouthBase) {
            this._mouth.position.copy(this._mouthBase.position);
            this._mouth.rotation.copy(this._mouthBase.rotation);
            this._mouth.scale.copy(this._mouthBase.scale);
        }
        if (this._lids) this._lids.visible = false;
        this._spark?.dispose(); this._spark = null;
        this._mouth = null; this._mouthBase = null; this._lids = null;
        this._model?.parent?.remove(this._model);
        this._pivot?.parent?.remove(this._pivot);
        this._pivot = null;
        this._model  = null;
        this._meshes = [];
    }
}
