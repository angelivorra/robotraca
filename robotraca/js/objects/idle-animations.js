// Idle animations: small gestures the model does now and then while it faces the
// camera and nobody is touching it.
//
// To add one, add an entry to IDLE_ANIMATIONS. `pose(p)` gets progress p in 0..1 and
// returns any of these offsets (omitted ones stay at rest):
//   rx, ry, rz   rotation in radians (rx > 0 = nod forward, rz > 0 = tilt left)
//   px, py, pz   position offset in model units
//   sx, sy, sz   scale multiplier (default 1)

const env = p => Math.sin(Math.PI * p);   // 0 → 1 → 0, to ease in and out

export const IDLE_ANIMATIONS = {
    // Two nods
    nod: {
        duration: 1.2,
        pose: p => ({ rx: 0.2 * Math.sin(4 * Math.PI * p) * env(p) }),
    },
    // Tilts the head to one side and comes back
    tilt: {
        duration: 1.4,
        pose: p => ({ rz: 0.18 * env(p) }),
    },
    // Small hop with a slight stretch
    hop: {
        duration: 0.7,
        pose: p => ({ py: 0.18 * env(p), sy: 1 + 0.05 * env(p), sx: 1 - 0.025 * env(p) }),
    },
};

export class IdleAnimator {
    /**
     * @param {object} [opts]
     * @param {string[]} [opts.only]      names to use (default: all)
     * @param {[number, number]} [opts.wait] seconds between gestures [min, max]
     */
    constructor({ only = null, wait = [3, 7] } = {}) {
        this._names  = only ?? Object.keys(IDLE_ANIMATIONS);
        this._wait   = wait;
        this.reset();
    }

    reset() {
        this._current = null;   // { name, t }
        this._last    = null;
        this._timer   = this._rand();
        this._weight  = 0;      // fades the pose out when idle ends (e.g. user touches)
    }

    _rand() { return this._wait[0] + Math.random() * (this._wait[1] - this._wait[0]); }

    /** Returns the pose offset for this frame (or null when at rest). */
    update(idle, delta) {
        this._weight += ((idle ? 1 : 0) - this._weight) * (1 - Math.exp(-8 * delta));

        if (idle) {
            if (!this._current) {
                this._timer -= delta;
                if (this._timer <= 0) {
                    const pool = this._names.filter(n => n !== this._last);
                    const name = (pool.length ? pool : this._names)[Math.floor(Math.random() * (pool.length || this._names.length))];
                    this._current = { name, t: 0 };
                    this._last = name;
                }
            }
        } else if (this._weight < 0.01) {
            this._current = null;
            this._timer = this._rand();
        }

        if (!this._current) return null;
        const anim = IDLE_ANIMATIONS[this._current.name];
        this._current.t += delta;
        const p = this._current.t / anim.duration;
        if (p >= 1) {
            this._current = null;
            this._timer = this._rand();
            return null;
        }
        const pose = anim.pose(p);
        const w = this._weight;
        return {
            rx: (pose.rx ?? 0) * w, ry: (pose.ry ?? 0) * w, rz: (pose.rz ?? 0) * w,
            px: (pose.px ?? 0) * w, py: (pose.py ?? 0) * w, pz: (pose.pz ?? 0) * w,
            sx: 1 + ((pose.sx ?? 1) - 1) * w, sy: 1 + ((pose.sy ?? 1) - 1) * w, sz: 1 + ((pose.sz ?? 1) - 1) * w,
        };
    }
}
