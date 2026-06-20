import * as THREE from 'three';
import { MenuBgScene } from './scenes/menu-bg.js';

const MENU_THEME = {
    bgColor:        '#050010',
    primaryColor:   '#e94560',
    secondaryColor: '#16c79a',
};

export class MenuVisualizer {
    constructor(canvas) {
        this._canvas    = canvas;
        this._renderer  = null;
        this._scene     = null;
        this._camera    = null;
        this._bgScene   = null;
        this._lastTime  = 0;
        this._onResize  = this._handleResize.bind(this);
    }

    init() {
        this._renderer = new THREE.WebGLRenderer({
            canvas:    this._canvas,
            antialias: false,
            alpha:     false,
        });
        this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this._renderer.setSize(window.innerWidth, window.innerHeight);

        this._scene  = new THREE.Scene();
        this._camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 60);
        this._camera.position.z = 5;

        this._bgScene = new MenuBgScene();
        this._bgScene.init(this._scene, MENU_THEME);

        window.addEventListener('resize', this._onResize);
    }

    start() {
        this._lastTime = performance.now();
        this._renderer.setAnimationLoop(ts => this._tick(ts));
    }

    stop() {
        this._renderer.setAnimationLoop(null);
    }

    _tick(ts) {
        const delta   = Math.min((ts - this._lastTime) / 1000, 0.1);
        this._lastTime = ts;
        this._bgScene.update(null, delta);
        this._renderer.render(this._scene, this._camera);
    }

    _handleResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this._camera.aspect = w / h;
        this._camera.updateProjectionMatrix();
        this._renderer.setSize(w, h);
    }

    dispose() {
        this.stop();
        window.removeEventListener('resize', this._onResize);
        this._bgScene?.dispose();
        this._renderer?.dispose();
        this._renderer = null;
        this._scene    = null;
        this._camera   = null;
        this._bgScene  = null;
    }
}
