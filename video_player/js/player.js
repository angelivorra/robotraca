import { SONGS, VERSION }                 from './config.js';
import { AudioEngine }                   from './audio-engine.js';
import { Visualizer }                    from './visualizer.js';
import { SubtitleEngine }                from './subtitles.js';
import { loadSongAssets, evictSongAssets } from './loader.js';
import { computeReactiveData, resetSmoothing } from './audio-reactive.js';

// ── DOM references ──────────────────────────────────────────────────────────
const mainScreen      = document.getElementById('mainScreen');
const playerScreen    = document.getElementById('playerScreen');
const songListEl      = document.getElementById('songList');
const threeCanvas     = document.getElementById('threeCanvas');
const subtitleDisplay = document.getElementById('subtitleDisplay');
const loadingOverlay  = document.getElementById('loadingOverlay');
const loadingBar      = document.getElementById('loadingBar');
const beatFlash       = document.getElementById('beatFlash');
const btnBack         = document.getElementById('btnBack');
const btnPlay         = document.getElementById('btnPlay');
const btnPrev         = document.getElementById('btnPrev');
const btnNext         = document.getElementById('btnNext');
const playIcon        = document.getElementById('playIcon');

// ── State ───────────────────────────────────────────────────────────────────
let currentIndex = -1;
let isPlaying    = false;
let audioEngine  = null;
let visualizer   = null;
let subtitleEng  = null;

// ── Boot ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('versionTag').textContent = `v${VERSION}`;
    generateSongList();
    initEventListeners();
});

function generateSongList() {
    songListEl.innerHTML = '';
    SONGS.forEach((song, i) => {
        const btn = document.createElement('button');
        btn.className = 'song-item';
        btn.dataset.index = i;
        btn.setAttribute('role', 'listitem');
        btn.innerHTML = `
            <span class="song-number">${String(i + 1).padStart(2, '0')}</span>
            <span class="song-title">${song.title}</span>
            <span class="song-arrow">▶</span>
        `;
        btn.addEventListener('click', () => selectSong(i));
        songListEl.appendChild(btn);
    });
}

function initEventListeners() {
    btnBack.addEventListener('click', goBack);
    btnPlay.addEventListener('click', togglePlay);
    btnPrev.addEventListener('click', prevSong);
    btnNext.addEventListener('click', nextSong);

    document.addEventListener('keydown', handleKeyboard);

    // Prevent double-tap zoom (canvas touch events are handled by TouchInput)
    document.addEventListener('touchend', e => {
        const now = Date.now();
        if (now - (window.lastTouchEnd || 0) < 300) e.preventDefault();
        window.lastTouchEnd = now;
    }, { passive: false });
}

// ── Song selection & loading ─────────────────────────────────────────────────

async function selectSong(index) {
    _teardown();

    currentIndex = index;
    const song   = SONGS[index];

    // iOS Safari requires AudioContext to be created synchronously within the
    // user gesture — before any await. Creating it after an await loses the
    // gesture context and Safari silently refuses to produce audio.
    audioEngine = new AudioEngine();
    audioEngine.init();

    // Switch to player screen with loading overlay
    mainScreen.classList.add('hidden');
    playerScreen.classList.remove('hidden');
    playerScreen.classList.remove('playing');
    loadingOverlay.style.display = 'flex';
    loadingBar.style.width = '0%';
    loadingBar.style.transition = 'none';
    subtitleDisplay.textContent = '';
    _setPlayIcon(false);

    // Preload all assets in parallel
    let assets;
    try {
        assets = await loadSongAssets(song, progress => {
            loadingBar.style.transition = 'width 0.2s ease';
            loadingBar.style.width = `${Math.round(progress * 100)}%`;
        });
    } catch (err) {
        console.error('Asset load error:', err);
        loadingOverlay.innerHTML = '<p class="loading-text">ERROR CARGANDO</p>';
        return;
    }

    if (!assets.audioBuffer) {
        loadingOverlay.innerHTML = '<p class="loading-text">AUDIO NO ENCONTRADO</p>';
        return;
    }

    // Decode audio (requires AudioContext, not a gesture)
    await audioEngine.loadBuffer(assets.audioBuffer);

    // Init subtitles
    subtitleEng = new SubtitleEngine();
    if (assets.subtitleText) subtitleEng.parse(assets.subtitleText);

    // Init Three.js scene (static, not animating yet)
    resetSmoothing();
    visualizer = new Visualizer(threeCanvas);
    visualizer.init(song, assets, audioEngine, subtitleEng, computeReactiveData);

    visualizer.onSubtitleUpdate = cue => {
        subtitleDisplay.textContent = cue || '';
    };
    visualizer.onBeat = () => {
        beatFlash.classList.add('active');
        requestAnimationFrame(() => beatFlash.classList.remove('active'));
    };
    visualizer.onNavigationSwipe = dir => {
        if (dir === 'left') {
            currentIndex < SONGS.length - 1 ? nextSong() : goBack();
        } else {
            currentIndex > 0 ? prevSong() : goBack();
        }
    };

    // Render one static frame so the model is visible before play
    visualizer.renderStatic();

    // Hide loading
    loadingOverlay.style.display = 'none';
    _setPlayIcon(false);
}

// ── Playback ─────────────────────────────────────────────────────────────────

async function togglePlay() {
    if (!audioEngine) return;
    isPlaying ? pause() : await play();
}

async function play() {
    if (!audioEngine || !audioEngine.buffer) return;

    // iOS: resume suspended AudioContext (requires user gesture — we're in a click handler)
    await audioEngine.resume();

    const offset = audioEngine.pauseTime || 0;
    const source = audioEngine.play(offset);

    source.onended = () => {
        // Only auto-advance if audio engine itself ended (not a manual pause/stop)
        if (!audioEngine || !audioEngine.isPlaying) return;
        _handleEnded();
    };

    visualizer.start();
    isPlaying = true;
    _setPlayIcon(true);
    playerScreen.classList.add('playing');
}

function pause() {
    if (!audioEngine) return;
    audioEngine.pause();   // sets audioEngine.isPlaying = false before source.stop()
    isPlaying = false;
    visualizer.stop();
    _setPlayIcon(false);
    playerScreen.classList.remove('playing');
}

function _handleEnded() {
    isPlaying = false;
    visualizer?.stop();
    _setPlayIcon(false);
    playerScreen.classList.remove('playing');
    goBack();
}

function _teardown() {
    // Capture before currentIndex is changed by the caller
    const evictId = currentIndex >= 0 ? SONGS[currentIndex]?.id : null;

    if (isPlaying) {
        isPlaying = false;
        audioEngine?.stop();
        visualizer?.stop();
    }
    // Dispose runtime objects first (detaches GLTF model from Three.js scene,
    // disposes scene geometry, closes AudioContext)
    audioEngine?.dispose();
    visualizer?.dispose();
    audioEngine = null;
    visualizer  = null;
    subtitleEng = null;
    playerScreen.classList.remove('playing');

    // Now safe to free GPU resources and the cached raw audio bytes
    if (evictId) evictSongAssets(evictId);
}

// ── Navigation ───────────────────────────────────────────────────────────────

function goBack() {
    _teardown();
    subtitleDisplay.textContent = '';
    _setPlayIcon(false);
    playerScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    currentIndex = -1;
}

function prevSong() {
    if (currentIndex <= 0) return;
    const wasPlaying = isPlaying;
    selectSong(currentIndex - 1).then(() => { if (wasPlaying) play(); });
}

function nextSong() {
    if (currentIndex >= SONGS.length - 1) return;
    const wasPlaying = isPlaying;
    selectSong(currentIndex + 1).then(() => { if (wasPlaying) play(); });
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function _setPlayIcon(playing) {
    playIcon.textContent = playing ? '❚❚' : '▶';
}

// ── Keyboard ─────────────────────────────────────────────────────────────────

function handleKeyboard(e) {
    if (playerScreen.classList.contains('hidden')) return;
    switch (e.key) {
        case ' ':
        case 'Enter':
            e.preventDefault();
            togglePlay();
            break;
        case 'Escape':
            goBack();
            break;
        case 'ArrowLeft':
            prevSong();
            break;
        case 'ArrowRight':
            nextSong();
            break;
    }
}
