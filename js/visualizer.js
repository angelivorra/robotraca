import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';

import { createScene, pickSceneName }       from './scenes/registry.js';
import { createObject, pickObjectSpec }     from './objects/registry.js';
import { TapBurstEffect, RingPulseEffect }  from './effects.js';
import { TouchInput }                       from './touch-input.js';

export class Visualizer {
    constructor(canvas) {
        this.canvas   = canvas;

        // Callbacks set by player.js
        this.onSubtitleUpdate   = null; // (cue: string|null) => void
        this.onBeat             = null; // () => void  — triggers CSS flash
        this.onNavigationSwipe  = null; // (dir: 'left'|'right') => void

        // Internals
        this._renderer  = null;
        this._threeScene = null;
        this._camera    = null;
        this._composer  = null;

        this._currentScene  = null;
        this._currentObject = null;
        this._sceneList     = [];
        this._sceneIndex    = 0;
        this._modelGroup    = null;

        this._effects   = null;
        this._touchInput = null;

        this._audioEngine    = null;
        this._subtitleEngine = null;
        this._computeReactive = null;

        this._theme       = null;
        this._cameraBaseZ = 5;
        this._beatPush    = 0;
        this._gyroTarget  = { x: 0, y: 0 };
        this._gyroActual  = { x: 0, y: 0 };
        this._dragVelocity = { x: 0, y: 0 };
        this._isDragging   = false;
        this._isPressing   = false;

        this._raycaster = new THREE.Raycaster();
        this._tapPlane  = new THREE.Plane(new THREE.Vector3(0, 0, 1), -1.5);

        this._running    = false;
        this._lastTime   = 0;
        this._onResize   = null;
    }

    // ── Init ─────────────────────────────────────────────────────────────────

    init(songConfig, assets, audioEngine, subtitleEngine, computeReactiveData) {
        this._theme           = songConfig.theme;
        this._audioEngine     = audioEngine;
        this._subtitleEngine  = subtitleEngine;
        this._computeReactive = computeReactiveData;
        this._cameraBaseZ     = songConfig.theme.cameraDistance;

        // Renderer
        this._renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this._renderer.setSize(window.innerWidth, window.innerHeight);
        this._renderer.toneMapping         = THREE.ACESFilmicToneMapping;
        this._renderer.toneMappingExposure = 1.2;

        // Scene + camera
        this._threeScene = new THREE.Scene();
        this._camera = new THREE.PerspectiveCamera(
            60, window.innerWidth / window.innerHeight, 0.1, 100
        );
        this._camera.position.set(0, 0, this._cameraBaseZ);

        // Model group (holds the central object)
        this._modelGroup = new THREE.Group();
        const mp = songConfig.theme.modelPosition;
        if (mp) this._modelGroup.position.set(mp[0] ?? 0, mp[1] ?? 0, mp[2] ?? 0);
        this._threeScene.add(this._modelGroup);

        // Shared lights (always present, scene can add its own)
        this._threeScene.add(new THREE.AmbientLight(0xffffff, 0.8));

        // Two colored point lights from the sides
        const l1 = new THREE.PointLight(new THREE.Color(songConfig.theme.primaryColor),   3, 15);
        l1.position.set(-3, 3, 3);
        this._threeScene.add(l1);
        const l2 = new THREE.PointLight(new THREE.Color(songConfig.theme.secondaryColor), 2, 15);
        l2.position.set(3, -2, 4);
        this._threeScene.add(l2);

        // Neutral fill light from the front so the model is always readable
        const lFill = new THREE.DirectionalLight(0xffffff, 1.0);
        lFill.position.set(0, 1, 6);
        this._threeScene.add(lFill);

        this._light1    = l1;
        this._light2    = l2;
        this._fillLight = lFill;

        // Pick & init scene
        this._sceneList  = songConfig.scenes?.length ? songConfig.scenes : ['space'];
        this._sceneIndex = Math.floor(Math.random() * this._sceneList.length);
        this._initScene(this._sceneList[this._sceneIndex]);

        // Pick & init object
        const spec = pickObjectSpec(songConfig.objects || ['icosahedron'], assets.gltfs || {});
        this._currentObject = createObject(spec, assets.gltfs || {});
        this._currentObject.init(this._modelGroup, this._theme);

        // Effects
        this._effects = {
            burst: new TapBurstEffect(this._threeScene, songConfig.theme.primaryColor),
            pulse: new RingPulseEffect(this._threeScene, songConfig.theme.primaryColor),
        };

        // Bloom (if scene requests it)
        this._buildComposer();

        // Touch input
        this._touchInput = new TouchInput(this.canvas);
        this._bindTouchCallbacks();

        // Resize
        this._onResize = () => this._handleResize();
        window.addEventListener('resize', this._onResize);

        // One static frame so model is visible before play
        this._renderFrame();
    }

    _initScene(name) {
        if (this._currentScene) {
            this._currentScene.dispose();
            this._currentScene = null;
        }
        this._currentScene = createScene(name);
        this._currentScene.init(this._threeScene, this._theme);
    }

    _buildComposer() {
        // Dispose old composer if any
        if (this._composer) {
            this._composer.dispose?.();
            this._composer = null;
        }

        if (!this._currentScene?.useBloom) return;

        const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
        this._composer = new EffectComposer(this._renderer);
        this._composer.addPass(new RenderPass(this._threeScene, this._camera));
        this._composer.addPass(new UnrealBloomPass(size, 1.5, 0.4, 0.6));
        this._composer.addPass(new OutputPass());
        // When using composer, disable built-in toneMapping on renderer
        this._renderer.toneMapping = THREE.NoToneMapping;
    }

    // ── Touch callbacks ───────────────────────────────────────────────────────

    _bindTouchCallbacks() {
        const ti = this._touchInput;

        ti.onPressStart = (screenX, screenY) => {
            this._isPressing = true;
            // Sparks fire immediately on touch-down at the exact press position
            const pos = this._screenTo3D(screenX, screenY);
            this._effects.burst.trigger(this._theme.primaryColor, pos);
            this._effects.pulse.trigger(this._theme.primaryColor, pos);
        };
        ti.onPressEnd = () => { this._isPressing = false; };

        ti.onTap = () => {
            // Object and scene reactions fire on release (confirmed tap, not drag)
            this._currentObject?.onTap();
            this._currentScene?.onTap?.();
            this.onBeat?.();
        };

        ti.onDrag = (dx, dy) => {
            this._isDragging = true;
            this._dragVelocity.x = dy * 0.012;
            this._dragVelocity.y = dx * 0.012;
            this._modelGroup.rotation.x += dy * 0.012;
            this._modelGroup.rotation.y += dx * 0.012;
        };

        ti.onSwipe = () => { /* swipe disabled */ };

        ti.onGyro = (x, y) => {
            this._gyroTarget.x = x;
            this._gyroTarget.y = y;
        };
    }

    // ── Coordinate conversion ─────────────────────────────────────────────────

    _screenTo3D(screenX, screenY) {
        const ndc = new THREE.Vector2(
            (screenX / window.innerWidth)  *  2 - 1,
            (screenY / window.innerHeight) * -2 + 1
        );
        this._raycaster.setFromCamera(ndc, this._camera);
        const target = new THREE.Vector3();
        this._raycaster.ray.intersectPlane(this._tapPlane, target);
        return target;
    }

    // ── Playback ──────────────────────────────────────────────────────────────

    /** Renders a single frame without starting the loop (call after init, before play). */
    renderStatic() {
        this._renderFrame();
    }

    start() {
        this._running  = true;
        this._lastTime = performance.now();
        this._renderer.setAnimationLoop(ts => this._tick(ts));
    }

    stop() {
        this._running = false;
        this._renderer?.setAnimationLoop(null);
    }

    // ── Render loop ───────────────────────────────────────────────────────────

    _tick(ts) {
        if (!this._running) return;
        const delta = Math.min((ts - this._lastTime) / 1000, 0.1); // seconds, capped
        this._lastTime = ts;

        // Audio analysis
        this._audioEngine.getFrequencyData();
        const beatData = this._audioEngine.getBeatData();
        const reactive = this._computeReactive(beatData);

        // Beat callbacks
        if (beatData.isBeat) {
            this._currentScene?.onBeat?.();
            this._currentObject?.onBeat?.();
            this._beatPush = 0.35;
            this.onBeat?.();
        }

        // Lights react to music ONLY while the screen is pressed — calm otherwise
        if (this._isPressing) {
            this._light1.intensity    = 2.0 + reactive.bassEnergy * 5;
            const c2 = new THREE.Color(this._theme.secondaryColor);
            c2.lerp(new THREE.Color(this._theme.primaryColor), reactive.midsEnergy * 0.6);
            this._light2.color.copy(c2);
            this._light2.intensity    = 1.5 + reactive.midsEnergy * 4;
            this._fillLight.intensity = 0.8 + reactive.highsEnergy * 2;
        } else {
            this._light1.intensity    = 2.0;
            this._light2.color.set(this._theme.secondaryColor);
            this._light2.intensity    = 1.5;
            this._fillLight.intensity = 0.8;
        }

        // Scene update
        this._currentScene?.update(reactive, delta);

        // Object update
        this._currentObject?.update(reactive, delta);

        // Model group: auto-rotate (damped when drag just happened)
        if (!this._isDragging) {
            this._dragVelocity.x *= 0.92;
            this._dragVelocity.y *= 0.92;
            this._modelGroup.rotation.x += this._dragVelocity.x;
            this._modelGroup.rotation.y += this._dragVelocity.y + 0.005;
        }
        this._isDragging = false;

        // Model scale: bass
        const s = this._theme.modelBaseScale + reactive.bassEnergy * 0.4;
        this._modelGroup.scale.setScalar(s);

        // Camera beat push
        if (this._beatPush > 0.005) {
            this._beatPush *= 0.85;
        } else {
            this._beatPush = 0;
        }

        // Camera gyro parallax (smoothed)
        this._gyroActual.x += (this._gyroTarget.x - this._gyroActual.x) * 0.05;
        this._gyroActual.y += (this._gyroTarget.y - this._gyroActual.y) * 0.05;
        this._camera.position.x = this._gyroActual.x * 0.4;
        this._camera.position.y = this._gyroActual.y * 0.3;
        this._camera.position.z = this._cameraBaseZ + this._beatPush;
        this._camera.lookAt(0, 0, 0);

        // Effects
        this._effects.burst.update(delta);
        this._effects.pulse.update(delta);

        // Subtitles
        if (this._subtitleEngine && this.onSubtitleUpdate) {
            const t   = this._audioEngine.getCurrentTime();
            const cue = this._subtitleEngine.getCueAt(t);
            this.onSubtitleUpdate(cue);
        }

        this._renderFrame();
    }

    _renderFrame() {
        if (this._composer) {
            this._composer.render();
        } else {
            this._renderer.render(this._threeScene, this._camera);
        }
    }

    // ── Resize ────────────────────────────────────────────────────────────────

    _handleResize() {
        if (!this._camera || !this._renderer) return;
        const w = window.innerWidth, h = window.innerHeight;
        this._camera.aspect = w / h;
        this._camera.updateProjectionMatrix();
        this._renderer.setSize(w, h);
        if (this._composer) {
            this._composer.setSize(w, h);
        }
    }

    // ── Dispose ───────────────────────────────────────────────────────────────

    dispose() {
        this.stop();
        window.removeEventListener('resize', this._onResize);

        this._touchInput?.dispose();
        this._currentScene?.dispose();
        this._currentObject?.dispose();
        this._effects?.burst.dispose();
        this._effects?.pulse.dispose();

        this._threeScene?.traverse(child => {
            if (child.isMesh) {
                child.geometry?.dispose();
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(m => m?.dispose());
            }
        });

        this._renderer?.dispose();
        this._renderer   = null;
        this._threeScene = null;
        this._camera     = null;
        this._composer   = null;
        this._modelGroup = null;
        this._currentScene   = null;
        this._currentObject  = null;
        this._touchInput     = null;
    }
}

function _isMobile() {
    return navigator.maxTouchPoints > 0 || window.innerWidth < 768;
}
