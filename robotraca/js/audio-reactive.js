// Module-level smoothing state (one active song at a time)
const body   = { bass: 0, mids: 0, highs: 0 };
const attack = { bass: 0, mids: 0, highs: 0 };
const spec   = new Float32Array(16);

// Body stays slow so scenes keep a calm glow. Attack is fast so lights and
// the hit overlay can catch the transient the analyser just let through.
const ALPHA_BODY   = 0.15;
const ALPHA_ATTACK = 0.55;
const ALPHA_SPEC   = 0.5;

function _follow(state, beatData, alpha) {
    state.bass  = state.bass  * (1 - alpha) + beatData.bass  * alpha;
    state.mids  = state.mids  * (1 - alpha) + beatData.mids  * alpha;
    state.highs = state.highs * (1 - alpha) + beatData.highs * alpha;
}

function _followSpectrum(src) {
    if (!src) return;
    const n = Math.min(spec.length, src.length);
    for (let i = 0; i < n; i++) {
        spec[i] = spec[i] * (1 - ALPHA_SPEC) + src[i] * ALPHA_SPEC;
    }
}

export function computeReactiveData(beatData) {
    _follow(body, beatData, ALPHA_BODY);
    _follow(attack, beatData, ALPHA_ATTACK);
    _followSpectrum(beatData.spectrum);

    return {
        bassEnergy:  body.bass,
        midsEnergy:  body.mids,
        highsEnergy: body.highs,
        bassAttack:  attack.bass,
        midsAttack:  attack.mids,
        highsAttack: attack.highs,
        spectrum:    spec,
        waveform:    beatData.waveform || null,
        isBeat:      beatData.isBeat,
        isKick:      !!beatData.isKick,
        isSnare:     !!beatData.isSnare,
    };
}

export function resetSmoothing() {
    body.bass = body.mids = body.highs = 0;
    attack.bass = attack.mids = attack.highs = 0;
    spec.fill(0);
}

// Pixel offset for the shared red/cyan split. Quiet stays at 0 so the
// full-screen filter can be switched off. Kept small so it never smears the picture.
export function cyberSplitPx(highs, kickFlash = 0, snareFlash = 0) {
    const px = (highs || 0) * 3 + (kickFlash || 0) * 1.2 + (snareFlash || 0) * 1.5;
    if (px < 0.35) return 0;
    return Math.min(7, px);
}
