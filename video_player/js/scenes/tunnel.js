import * as THREE from 'three';

const RING_COUNT   = 24;
const RING_SPACING = 4;
const RING_RADIUS  = 3.5;
const RING_TUBE    = 0.04;
const TOTAL_LENGTH = RING_COUNT * RING_SPACING;
const WRAP_Z       = 8; // rings past this Z get wrapped to the back

export class TunnelScene {
    get useBloom() { return this._useBloom; }

    constructor() {
        this._group      = null;
        this._rings      = [];
        this._wallMesh   = null;
        this._theme      = null;
        this._speedBoost = 0;
        this._beatFlash  = 0;
        this._useBloom   = !_isMobile();
    }

    init(threeScene, theme) {
        this._theme = theme;
        this._group = new THREE.Group();
        threeScene.add(this._group);

        // Dark background + exponential fog for depth
        threeScene.background = new THREE.Color(theme.bgColor);
        threeScene.fog = new THREE.FogExp2(new THREE.Color(theme.bgColor), 0.03);

        // ── Rings ──────────────────────────────────────────────────
        const ringGeo = new THREE.TorusGeometry(RING_RADIUS, RING_TUBE, 8, 64);
        const primary   = new THREE.Color(theme.primaryColor);
        const secondary = new THREE.Color(theme.secondaryColor);

        for (let i = 0; i < RING_COUNT; i++) {
            const color = (i % 2 === 0) ? primary : secondary;
            const mat = new THREE.MeshStandardMaterial({
                color:            color,
                emissive:         color,
                emissiveIntensity: 0.8,
                roughness:        0.1,
                metalness:        0.9,
                toneMapped:       true,
            });
            const ring = new THREE.Mesh(ringGeo, mat);
            ring.position.z = -i * RING_SPACING;
            this._group.add(ring);
            this._rings.push(ring);
        }

        // ── Wireframe cylinder wall (static, no interaction) ──────
        const wallGeo = new THREE.CylinderGeometry(
            RING_RADIUS, RING_RADIUS, TOTAL_LENGTH + RING_SPACING * 4, 8, 1, true
        );
        const wallMat = new THREE.MeshBasicMaterial({
            color:       new THREE.Color(theme.secondaryColor),
            wireframe:   true,
            transparent: true,
            opacity:     0.1,
        });
        this._wallMesh = new THREE.Mesh(wallGeo, wallMat);
        this._wallMesh.rotation.x = Math.PI / 2;
        this._wallMesh.position.z = -TOTAL_LENGTH / 2;
        this._group.add(this._wallMesh);
    }

    update(reactive /*, delta */) {
        if (!this._rings.length) return;

        // Speed: base + bass-driven + swipe boost
        this._speedBoost *= 0.96;
        const speed = 0.06 + reactive.bassEnergy * 0.25 + this._speedBoost;

        // Beat flash: brief emissive spike
        this._beatFlash *= 0.88;

        const baseEmissive = 0.4 + reactive.bassEnergy * 2.0 + this._beatFlash;

        for (const ring of this._rings) {
            ring.position.z += speed;
            if (ring.position.z > WRAP_Z) {
                ring.position.z -= TOTAL_LENGTH;
            }
            ring.material.emissiveIntensity = baseEmissive;
        }

        // Wall color shifts with mids
        if (this._wallMesh) {
            const c = new THREE.Color(this._theme.secondaryColor);
            c.lerp(new THREE.Color(this._theme.primaryColor), reactive.midsEnergy * 0.5);
            this._wallMesh.material.color.copy(c);
        }
    }

    onSwipe(dir) {
        if (dir === 'left')  this._speedBoost += 0.35;
        if (dir === 'right') this._speedBoost  = Math.max(0, this._speedBoost - 0.15);
    }

    onTap() {
        this._beatFlash = 3.0;
    }

    // Called by Visualizer when a beat fires
    onBeat() {
        this._beatFlash = 4.0;
    }

    dispose() {
        this._rings.forEach(r => r.material.dispose());
        this._rings[0]?.geometry.dispose(); // shared geometry
        this._wallMesh?.geometry.dispose();
        this._wallMesh?.material.dispose();
        this._group?.parent?.remove(this._group);
        this._group    = null;
        this._rings    = [];
        this._wallMesh = null;
    }
}

function _isMobile() {
    return navigator.maxTouchPoints > 0 || window.innerWidth < 768;
}
