// Module-level smoothing state (one active song at a time)
const smoothed = { bass: 0, mids: 0, highs: 0 };

// Alpha for exponential smoothing (lower = smoother/slower response)
const ALPHA = 0.15;

export function computeReactiveData(beatData) {
    smoothed.bass  = smoothed.bass  * (1 - ALPHA) + beatData.bass  * ALPHA;
    smoothed.mids  = smoothed.mids  * (1 - ALPHA) + beatData.mids  * ALPHA;
    smoothed.highs = smoothed.highs * (1 - ALPHA) + beatData.highs * ALPHA;

    return {
        bassEnergy:  smoothed.bass,
        midsEnergy:  smoothed.mids,
        highsEnergy: smoothed.highs,
        isBeat:      beatData.isBeat,
    };
}

export function resetSmoothing() {
    smoothed.bass  = 0;
    smoothed.mids  = 0;
    smoothed.highs = 0;
}
