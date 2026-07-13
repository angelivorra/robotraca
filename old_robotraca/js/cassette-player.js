// Configuración de canciones
const songs = [
    {
        path: 'audio/track1.mp3',
        name: 'Sartenazos desde Plutón'
    },
    {
        path: 'audio/track2.mp3',
        name: 'Gobierno de la IA'
    }
];

// Variables del reproductor
let currentSongIndex = 0;
let isPlaying = false;

// Elementos del DOM
const audio = document.getElementById('audio-player');
const playBtn = document.getElementById('play-btn');
const stopBtn = document.getElementById('stop-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const playIcon = document.querySelector('.play-icon');
const pauseIcon = document.querySelector('.pause-icon');
const playText = document.getElementById('play-text');
const songNameElement = document.querySelector('.song-name');
const reelLeft = document.querySelector('.reel-left');
const reelRight = document.querySelector('.reel-right');

// Inicializar reproductor
function init() {
    loadSong(currentSongIndex);
    setupEventListeners();
    checkAutoplay();
}

// Verificar parámetros GET para autoplay
function checkAutoplay() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('autoplay') || urlParams.has('play')) {
        // Intentar reproducir automáticamente
        setTimeout(() => {
            play();
        }, 500);
    }
}

// Configurar event listeners
function setupEventListeners() {
    playBtn.addEventListener('click', togglePlay);
    stopBtn.addEventListener('click', stop);
    prevBtn.addEventListener('click', previousSong);
    nextBtn.addEventListener('click', nextSong);
    
    // Eventos del audio
    audio.addEventListener('ended', nextSong);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
}

// Cargar canción
function loadSong(index) {
    if (index < 0 || index >= songs.length) {
        return;
    }
    
    const song = songs[index];
    audio.src = song.path;
    updateSongDisplay(song.name);
    currentSongIndex = index;
}

// Actualizar display de la canción
function updateSongDisplay(songName) {
    songNameElement.textContent = songName;
}

// Reproducir/Pausar
function togglePlay() {
    if (isPlaying) {
        pause();
    } else {
        play();
    }
}

// Reproducir
function play() {
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
        playPromise.then(() => {
            isPlaying = true;
            updatePlayButton(true);
            startReelAnimation();
        }).catch(error => {
            console.error('Error al reproducir:', error);
            // Si falla el autoplay, el usuario debe interactuar
            isPlaying = false;
            updatePlayButton(false);
        });
    }
}

// Pausar
function pause() {
    audio.pause();
    isPlaying = false;
    updatePlayButton(false);
    stopReelAnimation();
}

// Detener
function stop() {
    audio.pause();
    audio.currentTime = 0;
    isPlaying = false;
    updatePlayButton(false);
    stopReelAnimation();
}

// Canción anterior
function previousSong() {
    currentSongIndex--;
    if (currentSongIndex < 0) {
        currentSongIndex = songs.length - 1;
    }
    loadSong(currentSongIndex);
    if (isPlaying) {
        play();
    }
}

// Siguiente canción
function nextSong() {
    currentSongIndex++;
    if (currentSongIndex >= songs.length) {
        currentSongIndex = 0;
    }
    loadSong(currentSongIndex);
    if (isPlaying) {
        play();
    }
}

// Actualizar botón de play
function updatePlayButton(playing) {
    if (playing) {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
        playText.textContent = 'Pause';
    } else {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
        playText.textContent = 'Play';
    }
}

// Iniciar animación de carretes
function startReelAnimation() {
    reelLeft.classList.add('spinning');
    reelRight.classList.add('spinning');
}

// Detener animación de carretes
function stopReelAnimation() {
    reelLeft.classList.remove('spinning');
    reelRight.classList.remove('spinning');
}

// Eventos del audio
function onPlay() {
    isPlaying = true;
    updatePlayButton(true);
    startReelAnimation();
}

function onPause() {
    isPlaying = false;
    updatePlayButton(false);
    stopReelAnimation();
}

function onError(e) {
    console.error('Error en el audio:', e);
    alert('Error al cargar la canción. Por favor, verifica que el archivo existe.');
    stop();
}

// Prevenir zoom en iOS
document.addEventListener('gesturestart', function (e) {
    e.preventDefault();
});

// Prevenir scroll mientras se usa el reproductor
document.body.addEventListener('touchmove', function(e) {
    if (e.target.closest('.player-container')) {
        e.preventDefault();
    }
}, { passive: false });

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
