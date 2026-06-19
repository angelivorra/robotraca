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

        // Beat detection rolling buffer (~1 second at 60fps)
        this.energyHistory = new Float32Array(43);
        this.energyIndex   = 0;
        this.lastBeatTime  = 0;
        this.BEAT_COOLDOWN = 200; // ms between beats
    }

    // Must be called synchronously within a user gesture (iOS requirement).
    init() {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize               = 2048;
        this.analyser.smoothingTimeConstant = 0.8;
        this.analyser.minDecibels           = -90;
        this.analyser.maxDecibels           = -10;
        this.analyser.connect(this.context.destination);
        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    }

    async loadBuffer(arrayBuffer) {
        // slice(0) prevents the ArrayBuffer from being detached/transferred
        this.buffer = await this.context.decodeAudioData(arrayBuffer.slice(0));
    }

    async resume() {
        if (this.context && this.context.state === 'suspended') {
            await this.context.resume();
        }
    }

    play(offset = 0) {
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

        // Bass energy: bins 3–10 (≈43–215 Hz)
        let bassSum = 0;
        for (let i = 3; i <= 10; i++) bassSum += freq[i] * freq[i];
        const instantEnergy = bassSum / 8;

        // Update rolling buffer
        this.energyHistory[this.energyIndex] = instantEnergy;
        this.energyIndex = (this.energyIndex + 1) % this.energyHistory.length;

        let avgEnergy = 0;
        for (let i = 0; i < this.energyHistory.length; i++) avgEnergy += this.energyHistory[i];
        avgEnergy /= this.energyHistory.length;

        let variance = 0;
        for (let i = 0; i < this.energyHistory.length; i++) {
            const d = this.energyHistory[i] - avgEnergy;
            variance += d * d;
        }
        variance /= this.energyHistory.length;

        // Dynamic threshold (van den Berg beat detection)
        const threshold = (-0.0000025714 * variance) + 1.5142857;
        const now = performance.now();
        const isBeat = avgEnergy > 0 &&
                       instantEnergy > threshold * avgEnergy &&
                       (now - this.lastBeatTime) > this.BEAT_COOLDOWN;

        if (isBeat) this.lastBeatTime = now;

        // Normalized band energies (0–1)
        let bassEnergy = 0, midsEnergy = 0, highsEnergy = 0;
        for (let i = 3;   i <= 10;  i++) bassEnergy  += freq[i];
        for (let i = 41;  i <= 120; i++) midsEnergy  += freq[i];
        for (let i = 301; i <= 600; i++) highsEnergy += freq[i];

        bassEnergy  /= (8   * 255);
        midsEnergy  /= (80  * 255);
        highsEnergy /= (300 * 255);

        return { bass: bassEnergy, mids: midsEnergy, highs: highsEnergy, isBeat };
    }

    dispose() {
        this.stop();
        if (this.context) {
            this.context.close();
            this.context = null;
        }
        this.buffer        = null;
        this.analyser      = null;
        this.frequencyData = null;
    }
}
