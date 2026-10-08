import * as THREE from 'three';

// Electric spark that now and then runs along the wire on top of the head, from one ear to
// the other (random direction). The wire is part of the head mesh, so its centre line is
// stored here as [x, y] points in the model's own coordinates (z is constant).
// Add the instance to the glTF scene root so it follows the model's transform.

const WIRE_XY = [[-0.933,0.393],[-0.97,0.52],[-0.845,0.65],[-0.76,0.661],[-0.621,0.672],[-0.518,0.686],[-0.417,0.711],[-0.274,0.746],[-0.169,0.778],[-0.053,0.795],[0.052,0.791],[0.169,0.766],[0.307,0.742],[0.399,0.735],[0.505,0.737],[0.626,0.744],[0.759,0.745],[0.836,0.72],[0.95,0.52],[0.978,0.318]];
const WIRE_Z  = -0.03 + 0.1;      // slightly in front of the wire so it is not hidden by the coil

const TRAIL     = 14;             // particles in the spark (head + trail)
const DURATION  = 0.38;           // seconds to cross
const GAP       = [10, 20];       // seconds between sparks

export class WireSpark {
    constructor() {
        this._curve = new THREE.CatmullRomCurve3(
            WIRE_XY.map(([x, y]) => new THREE.Vector3(x, y, WIRE_Z)), false, 'catmullrom', 0.3);
        this._timer   = this._nextGap();
        this._t       = -1;       // -1 = idle, else seconds since start
        this._reverse = false;

        const mk = (size, color) => {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
            geo.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
            const mat = new THREE.PointsMaterial({
                size, vertexColors: true, transparent: true, sizeAttenuation: true,
                blending: THREE.AdditiveBlending, depthWrite: false,
            });
            mat.userData.color = new THREE.Color(color);
            const pts = new THREE.Points(geo, mat);
            pts.renderOrder = 996; pts.visible = false; pts.frustumCulled = false;
            return pts;
        };
        this._glow = mk(0.22, 0x5ab8ff);
        this._core = mk(0.07, 0xffffff);

        // Flash at the ear where the spark starts and where it arrives
        const fg = new THREE.BufferGeometry();
        fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
        this._flashMat = new THREE.PointsMaterial({
            size: 0.4, color: 0x9fd8ff, transparent: true, opacity: 0, sizeAttenuation: true,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        this._flash = new THREE.Points(fg, this._flashMat);
        this._flash.renderOrder = 995; this._flash.visible = false; this._flash.frustumCulled = false;

        this.object = new THREE.Group();
        this.object.add(this._glow, this._core, this._flash);
    }

    _nextGap() { return GAP[0] + Math.random() * (GAP[1] - GAP[0]); }

    update(delta) {
        if (this._t < 0) {
            this._timer -= delta;
            if (this._timer > 0) return;
            this._t = 0;
            this._reverse = Math.random() < 0.5;
            this._glow.visible = this._core.visible = this._flash.visible = true;
            const f = this._flash.geometry.attributes.position.array;
            const a = this._curve.getPoint(0), b = this._curve.getPoint(1);
            f.set([a.x, a.y, a.z, b.x, b.y, b.z]);
            this._flash.geometry.attributes.position.needsUpdate = true;
        }

        this._t += delta;
        const head = this._t / DURATION;                       // 0 → 1 along the wire
        const end  = 1 + TRAIL * 0.03;                         // let the trail leave the wire
        if (head > end) {
            this._t = -1;
            this._timer = this._nextGap();
            this._glow.visible = this._core.visible = this._flash.visible = false;
            return;
        }

        const pg = this._glow.geometry.attributes.position.array, cg = this._glow.geometry.attributes.color.array;
        const pc = this._core.geometry.attributes.position.array, cc = this._core.geometry.attributes.color.array;
        const gc = this._glow.material.userData.color, wc = this._core.material.userData.color;
        const v = new THREE.Vector3();
        for (let i = 0; i < TRAIL; i++) {
            let u = head - i * 0.03;
            const fade = u < 0 || u > 1 ? 0 : 1 - i / TRAIL;
            u = Math.min(Math.max(u, 0), 1);
            this._curve.getPoint(this._reverse ? 1 - u : u, v);
            // Electric zigzag around the wire
            const j = 0.035 * fade;
            const x = v.x + (Math.random() - 0.5) * j, y = v.y + (Math.random() - 0.5) * j * 1.6, z = v.z + (Math.random() - 0.5) * j;
            pg[i*3] = pc[i*3] = x; pg[i*3+1] = pc[i*3+1] = y; pg[i*3+2] = pc[i*3+2] = z;
            const flick = fade * (0.7 + Math.random() * 0.3);
            cg[i*3] = gc.r * flick; cg[i*3+1] = gc.g * flick; cg[i*3+2] = gc.b * flick;
            cc[i*3] = wc.r * flick; cc[i*3+1] = wc.g * flick; cc[i*3+2] = wc.b * flick;
        }
        this._glow.geometry.attributes.position.needsUpdate = this._core.geometry.attributes.position.needsUpdate = true;
        this._glow.geometry.attributes.color.needsUpdate = this._core.geometry.attributes.color.needsUpdate = true;

        // Ear flashes: a quick pulse at the start and another on arrival
        const pulse = (t0) => Math.max(0, 1 - Math.abs(head - t0) / 0.18);
        this._flashMat.opacity = Math.min(1, Math.max(pulse(0.0), pulse(1.0)) * (0.6 + Math.random() * 0.4));
    }

    dispose() {
        for (const p of [this._glow, this._core, this._flash]) { p.geometry.dispose(); p.material.dispose(); }
        this.object.parent?.remove(this.object);
    }
}
