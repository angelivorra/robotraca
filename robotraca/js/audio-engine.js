// Van den Berg onset: a spike versus the recent average, with a cooldown.
// Mutates `history` and returns the advanced index and last-hit time.
export const SPECTRUM_BARS = 16;

// Log-spaced bands from ~40 Hz up to just under Nyquist, as [start, end) bins.
export function spectrumRanges(binCount, sampleRate, fftSize) {
    const nyquist = sampleRate / 2;
    const minHz = 40;
    const maxHz = Math.min(14000, nyquist * 0.9);
    const ranges = [];
    for (let i = 0; i < SPECTRUM_BARS; i++) {
        const f0 = minHz * Math.pow(maxHz / minHz, i / SPECTRUM_BARS);
        const f1 = minHz * Math.pow(maxHz / minHz, (i + 1) / SPECTRUM_BARS);
        let b0 = Math.floor(f0 * fftSize / sampleRate);
        let b1 = Math.ceil(f1 * fftSize / sampleRate);
        b0 = Math.max(1, Math.min(binCount - 1, b0));
        b1 = Math.max(b0 + 1, Math.min(binCount, b1));
        ranges.push([b0, b1]);
    }
    return ranges;
}

export function fillSpectrum(freq, ranges, out) {
    for (let i = 0; i < ranges.length; i++) {
        const b0 = ranges[i][0];
        const b1 = ranges[i][1];
        let sum = 0;
        for (let b = b0; b < b1; b++) sum += freq[b];
        out[i] = sum / ((b1 - b0) * 255);
    }
    return out;
}

export function detectOnset(instant, history, index, lastTime, now, cooldown) {
    history[index] = instant;
    index = (index + 1) % history.length;

    let avg = 0;
    for (let i = 0; i < history.length; i++) avg += history[i];
    avg /= history.length;

    let variance = 0;
    for (let i = 0; i < history.length; i++) {
        const d = history[i] - avg;
        variance += d * d;
    }
    variance /= history.length;

    const threshold = (-0.0000025714 * variance) + 1.5142857;
    const cooled = lastTime === 0 || (now - lastTime) > cooldown;
    const hit = avg > 0 && instant > threshold * avg && cooled;
    if (hit) lastTime = now;
    return { hit, index, lastTime };
}

export class AudioEngine {
    constructor() {
        this.context    = null;
        this.analyser   = null;
        this.source     = null;
        this.buffer     = null;
        this.frequencyData = null;
        this.startTime  = 0;
        this.pauseTime  = 0;
        this.isPlaying  = false;

        // Onset buffers (~1 second at 60fps). Kick = bass, snare = mids.
        this.energyHistory = new Float32Array(43);
        this.energyIndex   = 0;
        this.lastBeatTime  = 0;
        this.BEAT_COOLDOWN = 200; // ms between kicks
        this.snareHistory  = new Float32Array(43);
        this.snareIndex    = 0;
        this.lastSnareTime = 0;
        this.SNARE_COOLDOWN = 160;

        this.spectrum  = new Float32Array(SPECTRUM_BARS);
        this.waveform  = new Uint8Array(64);
        this._ranges   = null;
        this._timeData = null;

        this._silentEl  = null;   // keeps Web Audio on the media channel (iOS silent-switch fix)
    }

    // Must be called synchronously within a user gesture (iOS requirement).
    init() {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize               = 2048;
        // Low enough that a kick/snare transient survives into getBeatData.
        // The slow body envelope is rebuilt afterwards in audio-reactive.js.
        this.analyser.smoothingTimeConstant = 0.45;
        this.analyser.minDecibels           = -90;
        this.analyser.maxDecibels           = -10;
        this.analyser.connect(this.context.destination);
        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.unlock();
    }

    // Synchronous, gesture-safe unlock: resume the context, play a one-sample
    // silent buffer through it and start the media-channel element.
    unlock() {
        if (!this.context) return;
        try {
            if (this.context.state !== 'running') this.context.resume().catch(() => {});
            const src = this.context.createBufferSource();
            src.buffer = this.context.createBuffer(1, 1, 22050);
            src.connect(this.context.destination);
            src.start(0);
        } catch (_) {}
        this._unlockMediaChannel();
    }

    async loadBuffer(arrayBuffer) {
        // slice(0) prevents the ArrayBuffer from being detached/transferred
        this.buffer = await this.context.decodeAudioData(arrayBuffer.slice(0));
    }

    async resume() {
        if (this.context && this.context.state !== 'running' && this.context.state !== 'closed') {
            await this.context.resume();
        }
    }

    // iOS routes Web Audio through the ringer/ambient channel, so the hardware
    // silent switch mutes it even at full volume. Playing a looping silent
    // HTMLAudioElement within the same user gesture moves Web Audio onto the
    // media channel where it behaves like any other audio app.
    _unlockMediaChannel() {
        if (this._silentEl) return;
        const a = document.createElement('audio');
        a.setAttribute('x-webkit-airplay', 'deny');
        a.loop   = true;
        a.volume = 0;
        a.setAttribute('playsinline', '');
        // Silent WAV, 0.1 s at 8 kHz mono 8-bit (a 0-sample file is rejected by iOS)
        const n = 800, wav = new Uint8Array(44 + n), dv = new DataView(wav.buffer);
        const str = (o, t) => { for (let i = 0; i < t.length; i++) wav[o + i] = t.charCodeAt(i); };
        str(0, 'RIFF'); dv.setUint32(4, 36 + n, true); str(8, 'WAVEfmt ');
        dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
        dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true);
        dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
        str(36, 'data'); dv.setUint32(40, n, true); wav.fill(128, 44);
        a.src = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
        a.play().catch(() => {});
        this._silentEl = a;
    }

    play(offset = 0) {
        this._unlockMediaChannel();
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }
        this.source = this.context.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(this.analyser);
        this.source.start(0, offset);
        this.startTime = this.context.currentTime - offset;
        this.isPlaying = true;
        return this.source;
    }

    pause() {
        if (!this.isPlaying || !this.source) return this.pauseTime;
        this.pauseTime = this.getCurrentTime();
        this.isPlaying = false; // set BEFORE stop so onended check is safe
        this.source.stop();
        this.source = null;
        return this.pauseTime;
    }

    stop() {
        this.isPlaying = false;
        if (this.source) {
            try { this.source.stop(); } catch (_) {}
            this.source = null;
        }
        this.pauseTime = 0;
        this.startTime = 0;
    }

    getCurrentTime() {
        if (this.isPlaying && this.context) {
            return this.context.currentTime - this.startTime;
        }
        return this.pauseTime;
    }

    getDuration() {
        return this.buffer ? this.buffer.duration : 0;
    }

    // Must be called once per frame before getBeatData()
    getFrequencyData() {
        this.analyser.getByteFrequencyData(this.frequencyData);
        return this.frequencyData;
    }

    getBeatData() {
        const freq = this.frequencyData;

        const now = performance.now();

        // Kick: bins 3–10 (≈43–215 Hz)
        let bassSum = 0;
        for (let i = 3; i <= 10; i++) bassSum += freq[i] * freq[i];
        const kick = detectOnset(
            bassSum / 8, this.energyHistory, this.energyIndex,
            this.lastBeatTime, now, this.BEAT_COOLDOWN
        );
        this.energyIndex  = kick.index;
        this.lastBeatTime = kick.lastTime;

        // Snare crack: bins 41–120 (≈880–2580 Hz)
        let snareSum = 0;
        for (let i = 41; i <= 120; i++) snareSum += freq[i] * freq[i];
        const snare = detectOnset(
            snareSum / 80, this.snareHistory, this.snareIndex,
            this.lastSnareTime, now, this.SNARE_COOLDOWN
        );
        this.snareIndex    = snare.index;
        this.lastSnareTime = snare.lastTime;

        // Normalized band energies (0–1)
        let bassEnergy = 0, midsEnergy = 0, highsEnergy = 0;
        for (let i = 3;   i <= 10;  i++) bassEnergy  += freq[i];
        for (let i = 41;  i <= 120; i++) midsEnergy  += freq[i];
        for (let i = 301; i <= 600; i++) highsEnergy += freq[i];

        bassEnergy  /= (8   * 255);
        midsEnergy  /= (80  * 255);
        highsEnergy /= (300 * 255);

        // Same-frame kick wins when the sub is louder, so a clicky kick
        // is not also counted as a snare.
        const isKick  = kick.hit;
        const isSnare = snare.hit && !(isKick && bassEnergy >= midsEnergy);

        if (!this._ranges) {
            const rate = this.context?.sampleRate || 44100;
            const fft = this.analyser?.fftSize || 2048;
            this._ranges = spectrumRanges(freq.length, rate, fft);
        }
        fillSpectrum(freq, this._ranges, this.spectrum);
        if (this.analyser) {
            if (!this._timeData || this._timeData.length !== this.analyser.fftSize) {
                this._timeData = new Uint8Array(this.analyser.fftSize);
            }
            this.analyser.getByteTimeDomainData(this._timeData);
            const step = this._timeData.length / this.waveform.length;
            for (let i = 0; i < this.waveform.length; i++) {
                this.waveform[i] = this._timeData[(i * step) | 0];
            }
        }

        return {
            bass: bassEnergy, mids: midsEnergy, highs: highsEnergy,
            isBeat: isKick, isKick, isSnare,
            spectrum: this.spectrum,
            waveform: this.waveform,
        };
    }

    dispose() {
        this.stop();
        if (this._silentEl) {
            this._silentEl.pause();
            this._silentEl.src = '';
            this._silentEl = null;
        }
        if (this.context) {
            this.context.close();
            this.context = null;
        }
        this.buffer        = null;
        this.analyser      = null;
        this.frequencyData = null;
    }
}
