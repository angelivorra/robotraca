/**
 * ROBOTRACA Video Player
 * Retro Sci-Fi Video Player
 */

// ========================================
// CONFIGURATION - Edita estos datos
// ========================================

const SONGS = [
    {
        id: 1,
        title: "ESTO ES UNA ABDUCCION",
        video: "videos/abduccion.mp4",
        duration: "1:18"
    },
    {
        id: 2,
        title: "ME QUEDO SIN ENERGIA",
        video: "videos/energia.mp4",
        duration: "1:44"
    },
    {
        id: 3,
        title: "QUE TONTOS SON",
        video: "videos/tontos.mp4",
        duration: "1:37"
    },
    {
        id: 4,
        title: "SARTENAZOS DE PLUTON",
        video: "videos/sarten.mp4",
        duration: "2:04"
    }
];

// ========================================
// STATE
// ========================================

let currentSong = null;
let isPlaying = false;

// DOM Elements
const mainMenu = document.getElementById('mainMenu');
const playerView = document.getElementById('playerView');
const videoPlayer = document.getElementById('videoPlayer');
const videoOverlay = document.getElementById('videoOverlay');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const currentTrackName = document.getElementById('currentTrackName');
const songGrid = document.getElementById('songGrid');

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    generateSongCards();
    initializePlayer();
});

function generateSongCards() {
    songGrid.innerHTML = '';
    SONGS.forEach((song, index) => {
        const card = document.createElement('button');
        card.className = 'song-card';
        card.dataset.song = song.id;
        card.onclick = () => selectSong(song.id);
        card.innerHTML = `
            <div class="song-number">${String(index + 1).padStart(2, '0')}</div>
            <div class="song-info">
                <div class="song-title">${song.title}</div>
                <div class="song-duration">${song.duration}</div>
            </div>
            <div class="song-indicator"></div>
        `;
        songGrid.appendChild(card);
    });
}

function initializePlayer() {
    // Video events
    videoPlayer.addEventListener('timeupdate', updateProgress);
    videoPlayer.addEventListener('loadedmetadata', updateDuration);
    videoPlayer.addEventListener('play', () => setPlayState(true));
    videoPlayer.addEventListener('pause', () => setPlayState(false));
    videoPlayer.addEventListener('ended', handleEnded);
    
    // Progress bar click
    progressBar.addEventListener('click', seekTo);
    
    // Video overlay click
    videoOverlay.addEventListener('click', togglePlay);
}

// ========================================
// SONG SELECTION
// ========================================

function selectSong(songId) {
    currentSong = SONGS.find(s => s.id === songId);
    if (!currentSong) return;
    
    // Update UI
    currentTrackName.textContent = currentSong.title;
    
    // Load video
    videoPlayer.src = currentSong.video;
    videoPlayer.load();
    
    // Show player view
    mainMenu.classList.add('hidden');
    playerView.classList.remove('hidden');
    
    // Reset state
    isPlaying = false;
    updatePlayButton();
    videoOverlay.classList.remove('hidden');
}

function goBack() {
    // Pause and reset
    videoPlayer.pause();
    videoPlayer.currentTime = 0;
    isPlaying = false;
    
    // Show menu
    playerView.classList.add('hidden');
    mainMenu.classList.remove('hidden');
}

// ========================================
// PLAYBACK CONTROLS
// ========================================

function togglePlay() {
    if (isPlaying) {
        videoPlayer.pause();
        exitFullscreen();
    } else {
        videoPlayer.play();
        videoOverlay.classList.add('hidden');
        enterFullscreen();
    }
}

function setPlayState(playing) {
    isPlaying = playing;
    updatePlayButton();
    
    if (playing) {
        videoOverlay.classList.add('hidden');
    }
}

function updatePlayButton() {
    playIcon.textContent = isPlaying ? '⏸' : '▶';
}

// ========================================
// FULLSCREEN
// ========================================

function enterFullscreen() {
    const videoFrame = document.querySelector('.video-frame');
    
    if (videoPlayer.requestFullscreen) {
        videoPlayer.requestFullscreen();
    } else if (videoPlayer.webkitRequestFullscreen) {
        // Safari
        videoPlayer.webkitRequestFullscreen();
    } else if (videoPlayer.webkitEnterFullscreen) {
        // iOS Safari
        videoPlayer.webkitEnterFullscreen();
    } else if (videoPlayer.msRequestFullscreen) {
        videoPlayer.msRequestFullscreen();
    }
}

function exitFullscreen() {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

// Manejar cuando se sale de fullscreen manualmente
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

function handleFullscreenChange() {
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    
    // Si se sale de fullscreen mientras reproduce, pausar
    if (!isFullscreen && isPlaying) {
        // Opcional: descomentar para pausar al salir de fullscreen
        // videoPlayer.pause();
    }
}

function prevSong() {
    if (!currentSong) return;
    const wasFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    const currentIndex = SONGS.findIndex(s => s.id === currentSong.id);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : SONGS.length - 1;
    selectSong(SONGS[prevIndex].id);
    
    // Reproducir automáticamente y mantener fullscreen
    videoPlayer.play();
    if (wasFullscreen) {
        setTimeout(() => enterFullscreen(), 100);
    }
}

function nextSong() {
    if (!currentSong) return;
    const wasFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    const currentIndex = SONGS.findIndex(s => s.id === currentSong.id);
    const nextIndex = currentIndex < SONGS.length - 1 ? currentIndex + 1 : 0;
    selectSong(SONGS[nextIndex].id);
    
    // Reproducir automáticamente y mantener fullscreen
    videoPlayer.play();
    if (wasFullscreen) {
        setTimeout(() => enterFullscreen(), 100);
    }
}

function handleEnded() {
    // Auto-avanzar a la siguiente canción (mantiene fullscreen)
    nextSong();
}

// ========================================
// PROGRESS & TIME
// ========================================

function updateProgress() {
    if (videoPlayer.duration) {
        const progress = (videoPlayer.currentTime / videoPlayer.duration) * 100;
        progressFill.style.width = `${progress}%`;
        currentTimeEl.textContent = formatTime(videoPlayer.currentTime);
    }
}

function updateDuration() {
    durationEl.textContent = formatTime(videoPlayer.duration);
}

function seekTo(event) {
    const rect = progressBar.getBoundingClientRect();
    const pos = (event.clientX - rect.left) / rect.width;
    videoPlayer.currentTime = pos * videoPlayer.duration;
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ========================================
// UTILITIES
// ========================================

// Prevent zoom on double tap
document.addEventListener('touchend', (event) => {
    const now = Date.now();
    if (now - (window.lastTouchEnd || 0) < 300) {
        event.preventDefault();
    }
    window.lastTouchEnd = now;
}, { passive: false });

// Handle visibility change (pause when tab hidden)
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isPlaying && !isCastConnected) {
        // Optionally pause when tab is hidden
        // videoPlayer.pause();
    }
});
