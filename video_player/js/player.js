/**
 * ROBOTRACA 8-BIT PLAYER
 * Super Nintendo Style Video Player
 */

// ========================================
// CONFIGURACIÓN - Edita estos datos
// ========================================

const SONGS = [
    {
        id: 1,
        title: "ESTO ES UNA ABDUCCION",
        video: "videos/abduccion.mp4",
        image: "img/abduccion.png",
        duration: "1:18"
    },
    {
        id: 2,
        title: "ME QUEDO SIN ENERGIA",
        video: "videos/energia.mp4",
        image: "img/energia.png",
        duration: "1:44"
    },
    {
        id: 3,
        title: "QUE TONTOS SON",
        video: "videos/tontos.mp4",
        image: "img/tontos.png",
        duration: "1:37"
    },
    {
        id: 4,
        title: "SARTENAZOS DE PLUTON",
        video: "videos/sarten.mp4",
        image: "img/sarten.png",
        duration: "2:04"
    }
];

// ========================================
// ESTADO
// ========================================

let currentSongIndex = -1;
let isPlaying = false;

// DOM Elements
const mainScreen = document.getElementById('mainScreen');
const playerScreen = document.getElementById('playerScreen');
const songList = document.getElementById('songList');
const playerBg = document.getElementById('playerBg');
const videoPlayer = document.getElementById('videoPlayer');

const btnBack = document.getElementById('btnBack');
const btnPlay = document.getElementById('btnPlay');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const playIcon = document.getElementById('playIcon');

// ========================================
// INICIALIZACIÓN
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    generateSongList();
    initializeEventListeners();
});

function generateSongList() {
    songList.innerHTML = '';
    
    SONGS.forEach((song, index) => {
        const item = document.createElement('button');
        item.className = 'song-item';
        item.dataset.index = index;
        item.setAttribute('role', 'listitem');
        item.innerHTML = `
            <span class="song-number">${String(index + 1).padStart(2, '0')}</span>
            <span class="song-title">${song.title}</span>
            <span class="song-arrow">▶</span>
        `;
        
        item.addEventListener('click', () => selectSong(index));
        songList.appendChild(item);
    });
}

function initializeEventListeners() {
    // Botones
    btnBack.addEventListener('click', goBack);
    btnPlay.addEventListener('click', togglePlay);
    btnPrev.addEventListener('click', prevSong);
    btnNext.addEventListener('click', nextSong);
    
    // Video events
    videoPlayer.addEventListener('play', () => updatePlayState(true));
    videoPlayer.addEventListener('pause', () => updatePlayState(false));
    videoPlayer.addEventListener('ended', handleEnded);
    
    // Keyboard controls
    document.addEventListener('keydown', handleKeyboard);
    
    // Fullscreen change
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
}

// ========================================
// NAVEGACIÓN
// ========================================

function selectSong(index) {
    currentSongIndex = index;
    const song = SONGS[index];
    
    // Cargar imagen de fondo
    playerBg.style.backgroundImage = `url('${song.image}')`;
    
    // Cargar video
    videoPlayer.src = song.video;
    videoPlayer.load();
    
    // Resetear estado
    isPlaying = false;
    updatePlayButton();
    
    // Mostrar player screen
    mainScreen.classList.add('hidden');
    playerScreen.classList.remove('hidden');
}

function goBack() {
    // Pausar y resetear
    videoPlayer.pause();
    videoPlayer.currentTime = 0;
    exitFullscreen();
    
    isPlaying = false;
    updatePlayButton();
    
    // Volver al menú
    playerScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
}

// ========================================
// CONTROLES DE REPRODUCCIÓN
// ========================================

function togglePlay() {
    if (isPlaying) {
        videoPlayer.pause();
    } else {
        videoPlayer.play();
    }
}

// Click en el video para pausar y mostrar controles
videoPlayer.addEventListener('click', (e) => {
    if (isPlaying) {
        videoPlayer.pause();
    }
});

function updatePlayState(playing) {
    isPlaying = playing;
    updatePlayButton();
    
    if (playing) {
        playerScreen.classList.add('playing');
    } else {
        playerScreen.classList.remove('playing');
    }
}

function updatePlayButton() {
    playIcon.textContent = isPlaying ? '❚❚' : '▶';
}

function prevSong() {
    if (currentSongIndex < 0) return;
    
    const wasPlaying = isPlaying;
    const wasFullscreen = isInFullscreen();
    
    const prevIndex = currentSongIndex > 0 
        ? currentSongIndex - 1 
        : SONGS.length - 1;
    
    selectSong(prevIndex);
    
    // Continuar reproduciendo si estaba reproduciendo
    if (wasPlaying) {
        videoPlayer.play();
        if (wasFullscreen) {
            setTimeout(() => enterFullscreen(), 100);
        }
    }
}

function nextSong() {
    if (currentSongIndex < 0) return;
    
    const wasPlaying = isPlaying;
    const wasFullscreen = isInFullscreen();
    
    const nextIndex = currentSongIndex < SONGS.length - 1 
        ? currentSongIndex + 1 
        : 0;
    
    selectSong(nextIndex);
    
    // Continuar reproduciendo si estaba reproduciendo
    if (wasPlaying) {
        videoPlayer.play();
        if (wasFullscreen) {
            setTimeout(() => enterFullscreen(), 100);
        }
    }
}

function handleEnded() {
    // Auto-siguiente
    nextSong();
    // Continuar reproduciendo
    videoPlayer.play();
}

// ========================================
// FULLSCREEN
// ========================================

function enterFullscreen() {
    if (videoPlayer.requestFullscreen) {
        videoPlayer.requestFullscreen();
    } else if (videoPlayer.webkitRequestFullscreen) {
        videoPlayer.webkitRequestFullscreen();
    } else if (videoPlayer.webkitEnterFullscreen) {
        // iOS Safari
        videoPlayer.webkitEnterFullscreen();
    } else if (videoPlayer.msRequestFullscreen) {
        videoPlayer.msRequestFullscreen();
    }
}

function exitFullscreen() {
    if (isInFullscreen()) {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

function isInFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function handleFullscreenChange() {
    // Opcional: pausar al salir de fullscreen
    // if (!isInFullscreen() && isPlaying) {
    //     videoPlayer.pause();
    // }
}

// ========================================
// TECLADO
// ========================================

function handleKeyboard(e) {
    // Solo si estamos en player screen
    if (playerScreen.classList.contains('hidden')) return;
    
    switch(e.key) {
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

// ========================================
// UTILITIES
// ========================================

// Prevenir zoom en doble tap
document.addEventListener('touchend', (event) => {
    const now = Date.now();
    if (now - (window.lastTouchEnd || 0) < 300) {
        event.preventDefault();
    }
    window.lastTouchEnd = now;
}, { passive: false });
