import * as THREE from 'three';

// Cyberspace data field: wireframe cubes and pyramids (plus a few additive solids)
// drifting toward the camera and recycling at the back, thin link lines between
// nearby nodes, a faint scrolling grid floor and floating particles.
// All procedural, no external assets. The centre (model zone) is kept clear.
const NODE_COUNT  = 132;
const SOLID_COUNT = 16;
const LINK_COUNT  = 44;
const PART_COUNT  = 220;
const FAR_Z       = -62;
const NEAR_Z      = 3.2;
const CLEAR_R     = 2.4;       // radius around the z axis kept empty
const FLOOR_Y     = -4.2;
const GRID_STEP   = 2;
const GRID_LEN    = 70;

const PALETTE = ['#27f5ff', '#ff2a9d', '#8a4dff', '#ffe14a'];

export class CubesScene {
    get useBloom() { return false; }

    constructor() {
        this._group = null;
        this._nodes = [];
        this._lineMats = [];
        this._solidMat = null;
        this._links = null;
        this._linkPairs = [];
        this._parts = null;
        this._floorX = null;
        this._floorMat = null;
        this._disposables = [];
        this._beatFlash = 0;
        this._speedBoost = 0;
        this._time = 0;
        this._gridOffset = 0;
        this._flashColor = new THREE.Color();
        this._tmp = new THREE.Color();
        this._white = new THREE.Color('#ffffff');
        this._rng = _rng(1337);
    }

    init(threeScene, theme) {
        this._group = new THREE.Group();
        threeScene.add(this._group);

        threeScene.background = new THREE.Color(theme.bgColor || '#050010');
        threeScene.fog = new THREE.FogExp2(new THREE.Color('#06001a'), 0.021);

        this._palette = PALETTE.map(c => new THREE.Color(c));
        // Theme colours replace the first two accents so the scene follows the song.
        if (theme.secondaryColor) this._palette[0].set(theme.secondaryColor);
        if (theme.primaryColor)   this._palette[1].set(theme.primaryColor);

        this._buildNodes();
        this._buildLinks();
        this._buildFloor();
        this._buildParticles();
    }

    // Random position outside the clear cylinder, spread proportional to depth.
    _place(n, z) {
        const r = this._rng;
        const dist = 5 - z;
        const hx = Math.max(7, dist * 0.85);
        const hy = Math.max(4, dist * 0.5);
        let x, y, tries = 0;
        do {
            x = (r() * 2 - 1) * hx;
            y = (r() * 2 - 1) * hy;
            y = Math.max(y, FLOOR_Y + 0.8);
            tries++;
        } while (x * x + y * y < CLEAR_R * CLEAR_R && tries < 12);
        if (x * x + y * y < CLEAR_R * CLEAR_R) { x = (x < 0 ? -1 : 1) * (CLEAR_R + r() * 2); }
        n.obj.position.set(x, y, z);
    }

    _buildNodes() {
        const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
        const pyrGeo  = new THREE.ConeGeometry(0.75, 1.2, 4);
        const cubeEdges = new THREE.EdgesGeometry(cubeGeo);
        const pyrEdges  = new THREE.EdgesGeometry(pyrGeo);
        this._disposables.push(cubeGeo, pyrGeo, cubeEdges, pyrEdges);

        // One shared material per palette colour.
        this._lineMats = this._palette.map(c => {
            const m = new THREE.LineBasicMaterial({ color: c.clone(), transparent: true, opacity: 0.9, toneMapped: false });
            this._disposables.push(m);
            return m;
        });
        this._solidMat = new THREE.MeshBasicMaterial({
            color: this._palette[2].clone(), transparent: true, opacity: 0.12,
            blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        });
        this._disposables.push(this._solidMat);

        const r = this._rng;
        for (let i = 0; i < NODE_COUNT + SOLID_COUNT; i++) {
            const solid = i >= NODE_COUNT;
            let obj;
            const ci = i % 4 === 3 && r() < 0.5 ? 3 : Math.floor(r() * 3);
            if (solid) {
                obj = new THREE.Mesh(r() < 0.7 ? cubeGeo : pyrGeo, this._solidMat);
            } else {
                obj = new THREE.LineSegments(r() < 0.65 ? cubeEdges : pyrEdges, this._lineMats[ci]);
            }
            const n = {
                obj, solid, ci,
                size: solid ? 0.45 + r() * 0.7 : 0.5 + r() * 1.0,
                spin: new THREE.Vector3((r() - 0.5), (r() - 0.5), (r() - 0.5)).multiplyScalar(0.7),
                phase: r() * Math.PI * 2,
            };
            // Spread initial depth evenly so there are no gaps.
            this._place(n, FAR_Z + (i / (NODE_COUNT + SOLID_COUNT)) * (NEAR_Z - FAR_Z));
            obj.rotation.set(r() * 6, r() * 6, r() * 6);
            obj.scale.setScalar(n.size);
            this._group.add(obj);
            this._nodes.push(n);
        }
    }

    _buildLinks() {
        const pos = new Float32Array(LINK_COUNT * 6);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.LineBasicMaterial({
            color: this._palette[0].clone(), transparent: true, opacity: 0.4, toneMapped: false,
        });
        this._links = new THREE.LineSegments(geo, mat);
        this._links.frustumCulled = false;
        this._group.add(this._links);
        this._disposables.push(geo, mat);

        const wire = this._nodes.filter(n => !n.solid);
        for (let i = 0; i < LINK_COUNT; i++) {
            const a = wire[Math.floor(this._rng() * wire.length)];
            this._linkPairs.push({ a, b: this._nearPartner(a, wire) });
        }
    }

    _nearPartner(a, wire) {
        let best = null, bd = Infinity;
        for (let k = 0; k < 24; k++) {
            const c = wire[Math.floor(this._rng() * wire.length)];
            if (c === a) continue;
            const d = c.obj.position.distanceToSquared(a.obj.position);
            if (d < bd) { bd = d; best = c; }
        }
        return best || a;
    }

    _buildFloor() {
        // Lines along z (fixed) and lines along x (scrolled and wrapped).
        const xs = [];
        for (let x = -36; x <= 36; x += GRID_STEP) xs.push(x, 0, 6, x, 0, 6 - GRID_LEN);
        const zs = [];
        for (let z = 6 + GRID_STEP; z > 6 - GRID_LEN - GRID_STEP; z -= GRID_STEP) zs.push(-36, 0, z, 36, 0, z);

        this._floorMat = new THREE.LineBasicMaterial({
            color: this._palette[2].clone(), transparent: true, opacity: 0.28, toneMapped: false,
        });
        const g1 = new THREE.BufferGeometry();
        g1.setAttribute('position', new THREE.Float32BufferAttribute(xs, 3));
        const g2 = new THREE.BufferGeometry();
        g2.setAttribute('position', new THREE.Float32BufferAttribute(zs, 3));
        const a = new THREE.LineSegments(g1, this._floorMat);
        this._floorX = new THREE.LineSegments(g2, this._floorMat);
        a.position.y = this._floorX.position.y = FLOOR_Y;
        a.frustumCulled = this._floorX.frustumCulled = false;
        this._group.add(a, this._floorX);
        this._disposables.push(g1, g2, this._floorMat);
    }

    _buildParticles() {
        const pos = new Float32Array(PART_COUNT * 3);
        const r = this._rng;
        for (let i = 0; i < PART_COUNT; i++) {
            const z = FAR_Z + r() * (NEAR_Z + 1 - FAR_Z);
            pos[i * 3]     = (r() * 2 - 1) * Math.max(6, (5 - z) * 0.8);
            pos[i * 3 + 1] = FLOOR_Y + r() * 11;
            pos[i * 3 + 2] = z;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
            color: '#bfe9ff', size: 0.07, sizeAttenuation: true,
            transparent: true, opacity: 0.8, toneMapped: false,
        });
        this._parts = new THREE.Points(geo, mat);
        this._parts.frustumCulled = false;
        this._group.add(this._parts);
        this._disposables.push(geo, mat);
    }

    update(reactive, delta) {
        if (!this._group) return;
        this._time += delta;
        this._beatFlash  *= Math.pow(0.84, delta * 60);
        this._speedBoost *= Math.pow(0.95, delta * 60);

        const bass = reactive.bassEnergy, highs = reactive.highsEnergy;
        const speed = (3.2 + bass * 3 + this._speedBoost * 8) * delta;
        const spinMul = 0.6 + highs * 3.5;
        const flash = this._beatFlash;

        // Colour flash: line materials lerp toward white on the beat.
        for (let i = 0; i < this._lineMats.length; i++) {
            this._lineMats[i].color.copy(this._palette[i]).lerp(this._white, Math.min(1, flash * 0.7));
            this._lineMats[i].opacity = 0.75 + bass * 0.25;
        }
        // Solids shift hue between violet and magenta on the beat.
        this._solidMat.color.copy(this._palette[2]).lerp(this._palette[1], Math.min(1, flash));
        this._solidMat.opacity = 0.08 + bass * 0.08 + flash * 0.1;

        for (const n of this._nodes) {
            const o = n.obj;
            o.position.z += speed;
            if (o.position.z > NEAR_Z) this._place(n, FAR_Z + (o.position.z - NEAR_Z));
            o.rotation.x += n.spin.x * spinMul * delta;
            o.rotation.y += n.spin.y * spinMul * delta;
            o.rotation.z += n.spin.z * spinMul * delta;
            const pulse = 1 + bass * 0.35 * (0.7 + 0.3 * Math.sin(this._time * 3 + n.phase)) + flash * 0.2;
            o.scale.setScalar(n.size * pulse);
        }

        // Links follow their nodes; re-pair when an endpoint recycles away.
        const wire = this._linkWire || (this._linkWire = this._nodes.filter(n => !n.solid));
        const p = this._links.geometry.attributes.position;
        for (let i = 0; i < this._linkPairs.length; i++) {
            const L = this._linkPairs[i];
            if (L.a.obj.position.distanceToSquared(L.b.obj.position) > 90) L.b = this._nearPartner(L.a, wire);
            const A = L.a.obj.position, B = L.b.obj.position;
            p.setXYZ(i * 2, A.x, A.y, A.z);
            p.setXYZ(i * 2 + 1, B.x, B.y, B.z);
        }
        p.needsUpdate = true;
        this._links.material.opacity = 0.3 + bass * 0.25 + flash * 0.3;
        this._links.material.color.copy(this._palette[0]).lerp(this._palette[3], Math.min(1, flash));

        // Floor scroll.
        this._gridOffset = (this._gridOffset + speed) % GRID_STEP;
        this._floorX.position.z = this._gridOffset;
        this._floorMat.opacity = 0.22 + bass * 0.2 + flash * 0.15;

        // Particles drift toward the camera and wrap.
        const pp = this._parts.geometry.attributes.position;
        for (let i = 0; i < PART_COUNT; i++) {
            let z = pp.getZ(i) + speed * 1.3;
            if (z > NEAR_Z + 1) {
                z = FAR_Z;
                pp.setX(i, (this._rng() * 2 - 1) * 20);
            }
            pp.setZ(i, z);
            pp.setY(i, pp.getY(i) + Math.sin(this._time + i) * 0.1 * delta);
        }
        pp.needsUpdate = true;
        this._parts.material.opacity = 0.55 + highs * 0.45;
    }

    onBeat() { this._beatFlash = 1.0; }
    onTap()  { this._beatFlash = 1.5; }
    onSwipe(dir) {
        if (dir === 'up')   this._speedBoost += 0.8;
        if (dir === 'down') this._speedBoost = Math.max(0, this._speedBoost - 0.3);
    }

    dispose() {
        for (const d of this._disposables) d.dispose();
        this._group?.parent?.remove(this._group);
        this._group = null;
        this._nodes = [];
        this._lineMats = [];
        this._linkPairs = [];
        this._linkWire = null;
        this._disposables = [];
        this._links = this._parts = this._floorX = this._floorMat = this._solidMat = null;
    }
}

function _rng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
