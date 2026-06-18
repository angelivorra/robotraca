import * as THREE from 'three';

export class SpaceScene {
    useBloom = false;

    constructor() {
        this._group    = null;
        this._points   = null;
        this._theme    = null;
    }

    init(threeScene, theme) {
        this._theme = theme;
        this._group = new THREE.Group();
        threeScene.add(this._group);

        threeScene.background = new THREE.Color(theme.bgColor);
        threeScene.fog = null;

        // 1 500 floating particles in a sphere of radius 15
        const count = 1500;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const r     = 5 + Math.random() * 10;
            const theta = Math.random() * Math.PI * 2;
            const phi   = Math.acos(2 * Math.random() - 1);
            positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const mat = new THREE.PointsMaterial({
            color:           new THREE.Color(theme.primaryColor),
            size:            0.06,
            transparent:     true,
            opacity:         0.7,
            sizeAttenuation: true,
        });

        this._points = new THREE.Points(geo, mat);
        this._group.add(this._points);
    }

    update(reactive /*, delta */) {
        if (!this._points) return;
        this._points.rotation.y += 0.0003 + reactive.bassEnergy * 0.002;
        this._points.rotation.x += 0.0001 + reactive.midsEnergy * 0.001;
        this._points.material.opacity = 0.4 + reactive.highsEnergy * 0.6;

        // Tint the color slightly toward secondary on mids
        const c1 = new THREE.Color(this._theme.primaryColor);
        const c2 = new THREE.Color(this._theme.secondaryColor);
        c1.lerp(c2, reactive.midsEnergy * 0.4);
        this._points.material.color.copy(c1);
    }

    onSwipe(/* dir */) {}
    onTap()             {}

    dispose() {
        this._points?.geometry.dispose();
        this._points?.material.dispose();
        this._group?.parent?.remove(this._group);
        this._group  = null;
        this._points = null;
    }
}
