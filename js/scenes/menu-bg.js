import * as THREE from 'three';

const STAR_COUNT_FAR   = 2500;
const STAR_COUNT_NEAR  = 1200;
const STAR_COUNT_MICRO = 600;   // tiny white stars for depth

function makeStars(count, minR, maxR, color, size, opacity) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const r     = minR + Math.random() * (maxR - minR);
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(2 * Math.random() - 1);
        positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
        color,
        size,
        sizeAttenuation: true,
        transparent: true,
        opacity,
        depthWrite: false,
    });
    return new THREE.Points(geo, mat);
}

export class MenuBgScene {
    get useBloom() { return false; }

    constructor() {
        this._group  = null;
        this._stars1 = null;
        this._stars2 = null;
        this._micro  = null;
        this._wire   = null;
        this._wire2  = null;
    }

    init(threeScene, theme) {
        threeScene.background = new THREE.Color(theme.bgColor);

        this._group = new THREE.Group();

        // Far red stars — large and bright
        this._stars1 = makeStars(STAR_COUNT_FAR,  18, 35, theme.primaryColor,   0.09, 0.85);
        // Mid teal stars — medium
        this._stars2 = makeStars(STAR_COUNT_NEAR,  7, 16, theme.secondaryColor, 0.07, 0.7);
        // Micro white stars scattered everywhere for density
        this._micro  = makeStars(STAR_COUNT_MICRO, 4, 22, '#ffffff',            0.04, 0.5);

        // Main icosahedron — more visible, color accent
        const wireGeo = new THREE.IcosahedronGeometry(3.5, 1);
        const wireMat = new THREE.MeshBasicMaterial({
            color: theme.secondaryColor,
            wireframe: true,
            transparent: true,
            opacity: 0.45,
            depthWrite: false,
        });
        this._wire = new THREE.Mesh(wireGeo, wireMat);
        this._wire.position.z = -1;

        // Second larger icosahedron in primary color, slower rotation
        const wire2Geo = new THREE.IcosahedronGeometry(5.5, 1);
        const wire2Mat = new THREE.MeshBasicMaterial({
            color: theme.primaryColor,
            wireframe: true,
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
        });
        this._wire2 = new THREE.Mesh(wire2Geo, wire2Mat);
        this._wire2.position.z = -3;

        this._group.add(this._stars1, this._stars2, this._micro, this._wire, this._wire2);
        threeScene.add(this._group);
    }

    update(_reactive, delta) {
        if (!this._group) return;
        this._stars1.rotation.y += 0.025 * delta;
        this._stars1.rotation.x += 0.008 * delta;
        this._stars2.rotation.y -= 0.020 * delta;
        this._stars2.rotation.x += 0.006 * delta;
        this._micro.rotation.y  += 0.010 * delta;
        this._micro.rotation.z  -= 0.004 * delta;
        this._wire.rotation.y   += 0.020 * delta;
        this._wire.rotation.z   += 0.009 * delta;
        this._wire2.rotation.y  -= 0.008 * delta;
        this._wire2.rotation.x  += 0.005 * delta;
    }

    onBeat()      {}
    onTap()       {}
    onSwipe(_dir) {}

    dispose() {
        if (!this._group) return;
        [this._stars1, this._stars2, this._micro].forEach(pts => {
            pts.geometry.dispose();
            pts.material.dispose();
        });
        this._wire.geometry.dispose();
        this._wire.material.dispose();
        this._wire2.geometry.dispose();
        this._wire2.material.dispose();
        this._group.clear();
        this._group = null;
    }
}
