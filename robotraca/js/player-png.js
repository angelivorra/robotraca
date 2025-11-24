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

// Variables de configuración (modificables en tiempo real)
let config = {
  "eyeDistance": "44",
  "eyeVertical": "35",
  "songVertical": "9",
  "controlsVertical": "56",
  "leftEyeSize": "12",
  "rightEyeSize": "19",
  "robotNameSize": "3.5",
  "songNameSize": "3",
  "buttonSize": "20",
  "buttonWidth": "35"
};

// Variables del reproductor
let currentSongIndex = 0;
let isPlaying = false;

// Elementos del DOM
const audio = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const songName = document.getElementById('songName');
const leftEye = document.getElementById('leftEye');
const rightEye = document.getElementById('rightEye');
const eyesContainer = document.getElementById('eyesContainer');
const songInfo = document.getElementById('songInfo');
const controls = document.getElementById('controls');

// Elementos del panel de configuración
const configToggle = document.getElementById('configToggle');
const configContent = document.getElementById('configContent');
const configOutput = document.getElementById('configOutput');

// Inicializar
function init() {
    loadSong(currentSongIndex);
    setupEventListeners();
    checkDebugMode();
    setupConfigPanel();
    applyConfig();
    checkAutoplay();
}

// Configurar event listeners
function setupEventListeners() {
    playBtn.addEventListener('click', togglePlay);
    prevBtn.addEventListener('click', previousSong);
    nextBtn.addEventListener('click', nextSong);
    
    audio.addEventListener('ended', nextSong);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
}

// Configurar panel de configuración
function setupConfigPanel() {
    configToggle.addEventListener('click', () => {
        configContent.classList.toggle('hidden');
    });
    
    // Eye distance
    const eyeDistanceInput = document.getElementById('eyeDistance');
    const eyeDistanceValue = document.getElementById('eyeDistanceValue');
    eyeDistanceInput.addEventListener('input', (e) => {
        config.eyeDistance = e.target.value;
        eyeDistanceValue.textContent = e.target.value;
        applyConfig();
    });
    
    // Eye vertical
    const eyeVerticalInput = document.getElementById('eyeVertical');
    const eyeVerticalValue = document.getElementById('eyeVerticalValue');
    eyeVerticalInput.addEventListener('input', (e) => {
        config.eyeVertical = e.target.value;
        eyeVerticalValue.textContent = e.target.value;
        applyConfig();
    });
    
    // Song vertical
    const songVerticalInput = document.getElementById('songVertical');
    const songVerticalValue = document.getElementById('songVerticalValue');
    songVerticalInput.addEventListener('input', (e) => {
        config.songVertical = e.target.value;
        songVerticalValue.textContent = e.target.value;
        applyConfig();
    });
    
    // Controls vertical
    const controlsVerticalInput = document.getElementById('controlsVertical');
    const controlsVerticalValue = document.getElementById('controlsVerticalValue');
    controlsVerticalInput.addEventListener('input', (e) => {
        config.controlsVertical = e.target.value;
        controlsVerticalValue.textContent = e.target.value;
        applyConfig();
    });
    
    // Left eye size
    const leftEyeSizeInput = document.getElementById('leftEyeSize');
    const leftEyeSizeValue = document.getElementById('leftEyeSizeValue');
    leftEyeSizeInput.addEventListener('input', (e) => {
        config.leftEyeSize = e.target.value;
        leftEyeSizeValue.textContent = e.target.value;
        applyConfig();
    });
    
    // Right eye size
    const rightEyeSizeInput = document.getElementById('rightEyeSize');
    const rightEyeSizeValue = document.getElementById('rightEyeSizeValue');
    rightEyeSizeInput.addEventListener('input', (e) => {
        config.rightEyeSize = e.target.value;
        rightEyeSizeValue.textContent = e.target.value;
        applyConfig();
    });
    
    // Robot name size
    const robotNameSizeInput = document.getElementById('robotNameSize');
    const robotNameSizeValue = document.getElementById('robotNameSizeValue');
    robotNameSizeInput.addEventListener('input', (e) => {
        config.robotNameSize = e.target.value;
        robotNameSizeValue.textContent = e.target.value;
        applyConfig();
    });
    
    // Song name size
    const songNameSizeInput = document.getElementById('songNameSize');
    const songNameSizeValue = document.getElementById('songNameSizeValue');
    songNameSizeInput.addEventListener('input', (e) => {
        config.songNameSize = e.target.value;
        songNameSizeValue.textContent = e.target.value;
        applyConfig();
    });
    
    // Button size
    const buttonSizeInput = document.getElementById('buttonSize');
    const buttonSizeValue = document.getElementById('buttonSizeValue');
    buttonSizeInput.addEventListener('input', (e) => {
        config.buttonSize = e.target.value;
        buttonSizeValue.textContent = e.target.value;
        applyConfig();
    });
    
    // Button width
    const buttonWidthInput = document.getElementById('buttonWidth');
    const buttonWidthValue = document.getElementById('buttonWidthValue');
    buttonWidthInput.addEventListener('input', (e) => {
        config.buttonWidth = e.target.value;
        buttonWidthValue.textContent = e.target.value;
        applyConfig();
    });
    
    // Export config
    document.getElementById('exportConfig').addEventListener('click', exportConfig);
}

// Aplicar configuración
function applyConfig() {
    // Posición de ojos
    const centerX = 50;
    const leftX = centerX - (config.eyeDistance / 2);
    const rightX = centerX + (config.eyeDistance / 2);
    
    leftEye.style.left = `${leftX}%`;
    leftEye.style.top = `${config.eyeVertical}%`;
    leftEye.style.transform = 'translate(-50%, -50%)';
    leftEye.style.width = `${config.leftEyeSize}%`;
    
    rightEye.style.left = `${rightX}%`;
    rightEye.style.top = `${config.eyeVertical}%`;
    rightEye.style.transform = 'translate(-50%, -50%)';
    rightEye.style.width = `${config.rightEyeSize}%`;
    
    // Posición de información de canción
    songInfo.style.top = `${config.songVertical}%`;
    
    // Tamaño de textos
    const robotNameEl = document.querySelector('.robot-name');
    const songNameEl = document.querySelector('.song-name');
    if (robotNameEl) robotNameEl.style.fontSize = `${config.robotNameSize}vw`;
    if (songNameEl) songNameEl.style.fontSize = `${config.songNameSize}vw`;
    
    // Posición de controles
    controls.style.bottom = `${100 - config.controlsVertical}%`;
    
    // Tamaño de botones
    const controlBtns = document.querySelectorAll('.control-btn');
    controlBtns.forEach(btn => {
        btn.style.minHeight = `${config.buttonSize}px`;
        btn.style.padding = `${config.buttonSize * 0.2}px`;
    });
    
    // Ancho del contenedor de botones
    controls.style.width = `${config.buttonWidth}%`;
}

// Exportar configuración
function exportConfig() {
    const output = JSON.stringify(config, null, 2);
    configOutput.textContent = output;
    configOutput.style.display = 'block';
    console.log('Configuración actual:', config);
}

// Verificar modo debug
function checkDebugMode() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('debug') && urlParams.get('debug') === '1') {
        const configPanel = document.getElementById('configPanel');
        configPanel.classList.add('debug-mode');
    }
}

// Verificar autoplay (desde QR code o parámetro URL)
function checkAutoplay() {
    const urlParams = new URLSearchParams(window.location.search);
    // Autoplay si viene de QR (cualquier parámetro sin debug) o explícitamente con autoplay/play
    const hasParams = urlParams.toString().length > 0;
    const isDebugOnly = urlParams.has('debug') && urlParams.toString() === 'debug=1';
    
    if (urlParams.has('autoplay') || urlParams.has('play') || (hasParams && !isDebugOnly)) {
        setTimeout(() => play(), 500);
    }
}

// Cargar canción
function loadSong(index) {
    if (index < 0 || index >= songs.length) return;
    
    const song = songs[index];
    audio.src = song.path;
    updateSongDisplay(song.name);
    currentSongIndex = index;
}

// Actualizar display
function updateSongDisplay(name) {
    if (isPlaying) {
        songName.textContent = name;
    } else {
        songName.textContent = 'Pulse Play';
    }
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
            updateSongDisplay(songs[currentSongIndex].name);
            startEyesAnimation();
        }).catch(error => {
            console.error('Error al reproducir:', error);
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
    updateSongDisplay('');
    stopEyesAnimation();
}

// Detener
function stop() {
    audio.pause();
    audio.currentTime = 0;
    isPlaying = false;
    updatePlayButton(false);
    updateSongDisplay('');
    stopEyesAnimation();
}

// Canción anterior
function previousSong() {
    currentSongIndex--;
    if (currentSongIndex < 0) {
        currentSongIndex = songs.length - 1;
    }
    loadSong(currentSongIndex);
    if (isPlaying) play();
}

// Siguiente canción
function nextSong() {
    currentSongIndex++;
    if (currentSongIndex >= songs.length) {
        currentSongIndex = 0;
    }
    loadSong(currentSongIndex);
    if (isPlaying) play();
}

// Actualizar botón de play
function updatePlayButton(playing) {
    const playIcon = playBtn.querySelector('.play-icon');
    const pauseIcon = playBtn.querySelector('.pause-icon');
    
    if (playing) {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
    } else {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
    }
}

// Iniciar animación de ojos
function startEyesAnimation() {
    leftEye.classList.add('spinning');
    rightEye.classList.add('spinning');
}

// Detener animación de ojos
function stopEyesAnimation() {
    leftEye.classList.remove('spinning');
    rightEye.classList.remove('spinning');
}

// Eventos del audio
function onPlay() {
    isPlaying = true;
    updatePlayButton(true);
    startEyesAnimation();
}

function onPause() {
    isPlaying = false;
    updatePlayButton(false);
    stopEyesAnimation();
}

function onError(e) {
    console.error('Error en el audio:', e);
    alert('Error al cargar la canción. Verifica que el archivo existe.');
    stop();
}

// Prevenir zoom
document.addEventListener('gesturestart', function (e) {
    e.preventDefault();
});

// Inicializar cuando esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
