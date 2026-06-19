/**
 * Unified touch + mouse + gyroscope input for a canvas element.
 *
 * Callbacks (set externally):
 *   onPressStart()           - finger/mouse went down
 *   onPressEnd()             - finger/mouse released
 *   onTap(x, y)              - canvas pixel coords
 *   onDrag(dx, dy)           - delta pixels per move event
 *   onSwipe(dir)             - 'left' | 'right' | 'up' | 'down'
 *   onGyro(normX, normY)     - [-1..1] device tilt
 */
export class TouchInput {
    constructor(element) {
        this.element      = element;
        this.onPressStart = null;
        this.onPressEnd   = null;
        this.onTap        = null;
        this.onDrag       = null;
        this.onSwipe      = null;
        this.onGyro       = null;

        this._touches      = {};
        this._touchCount   = 0;   // active fingers on screen
        this._mouseDown    = false;
        this._mousePos     = { x: 0, y: 0 };

        this._bindTouch();
        this._bindMouse();
        this._gyroBound = false;
        element.addEventListener('click', () => this._requestGyro(), { once: true });
    }

    // ── Touch ────────────────────────────────────────────────────────────────

    _bindTouch() {
        const el = this.element;
        el.addEventListener('touchstart', e => this._touchStart(e), { passive: false });
        el.addEventListener('touchmove',  e => this._touchMove(e),  { passive: false });
        el.addEventListener('touchend',   e => this._touchEnd(e),   { passive: true  });
        el.addEventListener('touchcancel',e => this._touchEnd(e),   { passive: true  });
    }

    _touchStart(e) {
        e.preventDefault();
        const wasZero = this._touchCount === 0;
        for (const t of e.changedTouches) {
            this._touches[t.identifier] = {
                startX: t.clientX, startY: t.clientY,
                lastX:  t.clientX, lastY:  t.clientY,
                time:   Date.now(),
                moved:  false,
            };
            this._touchCount++;
        }
        if (wasZero) {
            const first = e.changedTouches[0];
            this.onPressStart?.(first.clientX, first.clientY);
        }
    }

    _touchMove(e) {
        e.preventDefault();
        for (const t of e.changedTouches) {
            const rec = this._touches[t.identifier];
            if (!rec) continue;
            const dx = t.clientX - rec.lastX;
            const dy = t.clientY - rec.lastY;
            rec.lastX = t.clientX;
            rec.lastY = t.clientY;
            const totalDist = Math.hypot(t.clientX - rec.startX, t.clientY - rec.startY);
            if (totalDist > 5) rec.moved = true;
            if (rec.moved) this.onDrag?.(dx, dy);
        }
    }

    _touchEnd(e) {
        for (const t of e.changedTouches) {
            const rec = this._touches[t.identifier];
            if (!rec) continue;
            delete this._touches[t.identifier];
            this._touchCount = Math.max(0, this._touchCount - 1);

            const dx   = t.clientX - rec.startX;
            const dy   = t.clientY - rec.startY;
            const dist = Math.hypot(dx, dy);
            const dt   = Date.now() - rec.time;

            if (dist < 12 && dt < 400) {
                this.onTap?.(t.clientX, t.clientY);
            } else if (dist > 55 && dt < 450) {
                this.onSwipe?.(_swipeDir(dx, dy));
            }
        }
        if (this._touchCount === 0) this.onPressEnd?.();
    }

    // ── Mouse (desktop) ───────────────────────────────────────────────────────

    _bindMouse() {
        const el = this.element;
        el.addEventListener('mousedown', e => {
            this._mouseDown  = true;
            this._mousePos   = { x: e.clientX, y: e.clientY };
            this._mouseMoved = false;
            this._mouseStart = { x: e.clientX, y: e.clientY, time: Date.now() };
            this.onPressStart?.(e.clientX, e.clientY);
        });
        el.addEventListener('mousemove', e => {
            if (!this._mouseDown) return;
            const dx = e.clientX - this._mousePos.x;
            const dy = e.clientY - this._mousePos.y;
            this._mousePos  = { x: e.clientX, y: e.clientY };
            const totalDist = Math.hypot(e.clientX - this._mouseStart.x, e.clientY - this._mouseStart.y);
            if (totalDist > 5) {
                this._mouseMoved = true;
                this.onDrag?.(dx, dy);
            }
        });
        el.addEventListener('mouseup', e => {
            if (!this._mouseDown) return;
            this._mouseDown = false;
            const dx   = e.clientX - this._mouseStart.x;
            const dy   = e.clientY - this._mouseStart.y;
            const dist = Math.hypot(dx, dy);
            const dt   = Date.now() - this._mouseStart.time;
            if (!this._mouseMoved || dist < 12) {
                this.onTap?.(e.clientX, e.clientY);
            } else if (dist > 55 && dt < 450) {
                this.onSwipe?.(_swipeDir(dx, dy));
            }
            this.onPressEnd?.();
        });
        el.addEventListener('mouseleave', () => {
            if (this._mouseDown) {
                this._mouseDown = false;
                this.onPressEnd?.();
            }
        });
    }

    // ── Gyroscope ────────────────────────────────────────────────────────────

    _requestGyro() {
        if (this._gyroBound) return;
        if (typeof DeviceOrientationEvent === 'undefined') return;

        const start = () => {
            window.addEventListener('deviceorientation', e => {
                const x = Math.max(-1, Math.min(1, (e.gamma || 0) / 45));
                const y = Math.max(-1, Math.min(1, ((e.beta  || 0) - 45) / 45));
                this.onGyro?.(x, y);
            });
            this._gyroBound = true;
        };

        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(state => { if (state === 'granted') start(); })
                .catch(() => {});
        } else {
            start();
        }
    }

    dispose() {
        this.onPressStart = null;
        this.onPressEnd   = null;
        this.onTap        = null;
        this.onDrag       = null;
        this.onSwipe      = null;
        this.onGyro       = null;
    }
}

function _swipeDir(dx, dy) {
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
}
