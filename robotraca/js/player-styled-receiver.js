// Configuración de canciones
const songs = [
    {
        path: 'audio/track1.mp3',
        name: 'Sartenazos desde Plutón'
    },
    {
        path: 'audio/track2.mp3',
        name: 'Gobierno de la IA'
    },
    {
        path: 'audio/tontos.mp3',
        name: 'Tontos'
    }
];

// Variables de configuración (modificables en tiempo real)
let config = {
  "eyeDistance": "44",
  "eyeVertical": "41",
  "songVertical": "9",
  "controlsVertical": "59",
  "leftEyeSize": "13",
  "rightEyeSize": "19",
  "robotNameSize": "11.5",
  "songNameSize": "4",
  "buttonSize": "6",
  "buttonWidth": "55"
};

// Variables del reproductor
let currentSongIndex = 0;
let isPlaying = false;

// Variables de Chromecast
let castSession = null;
let isCasting = false;
let castContext = null;

// Styled Receiver Application ID
const STYLED_RECEIVER_APP_ID = '183C1BCD';

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

// ========================================
// REPRODUCTOR LOCAL
// ========================================

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
    
    // Posición de información de canción (relativa a robot-head)
    songInfo.style.top = `${config.songVertical}%`;
    
    // Tamaño de textos (relativo al contenedor robot-head)
    const robotHead = document.querySelector('.robot-head');
    const headWidth = robotHead ? robotHead.offsetWidth : 600;
    const robotNameEl = document.querySelector('.robot-name');
    const songNameEl = document.querySelector('.song-name');
    if (robotNameEl) robotNameEl.style.fontSize = `${(config.robotNameSize / 100) * headWidth}px`;
    if (songNameEl) songNameEl.style.fontSize = `${(config.songNameSize / 100) * headWidth}px`;
    
    // Posición de controles (relativa a robot-head)
    controls.style.top = `${config.controlsVertical}%`;
    
    // Tamaño de botones (relativo al contenedor)
    const controlBtns = document.querySelectorAll('.control-btn');
    const buttonHeight = (config.buttonSize / 100) * headWidth;
    controlBtns.forEach(btn => {
        btn.style.minHeight = `${buttonHeight}px`;
        btn.style.padding = `${buttonHeight * 0.2}px`;
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
        songName.textContent = name || songs[currentSongIndex].name;
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
    if (isCasting && castSession) {
        // Si estamos en Cast, controlar el Chromecast
        const mediaSession = castSession.getMediaSession();
        if (mediaSession && mediaSession.playerState === chrome.cast.media.PlayerState.PAUSED) {
            // Si hay media pausada, reanudar
            mediaSession.play(new chrome.cast.media.PlayRequest(),
                () => {
                    isPlaying = true;
                    updatePlayButton(true);
                    startEyesAnimation();
                },
                (error) => console.error('Resume error:', error.code)
            );
        } else {
            // Si no hay media, cargar la canción actual
            castCurrentSong();
        }
    } else {
        // Reproducir localmente
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
}

// Pausar
function pause() {
    if (isCasting && castSession) {
        // Si estamos en Cast, pausar el Chromecast
        const mediaSession = castSession.getMediaSession();
        if (mediaSession) {
            mediaSession.pause(new chrome.cast.media.PauseRequest(),
                () => {
                    isPlaying = false;
                    updatePlayButton(false);
                    stopEyesAnimation();
                },
                (error) => console.error('Pause error:', error.code)
            );
        }
    } else {
        // Pausar localmente
        audio.pause();
        isPlaying = false;
        updatePlayButton(false);
        updateSongDisplay('');
        stopEyesAnimation();
    }
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
    
    if (isCasting) {
        updateSongDisplay();
        setTimeout(() => castCurrentSong(), 100);
    } else {
        loadSong(currentSongIndex);
        if (isPlaying) play();
    }
}

// Siguiente canción
function nextSong() {
    currentSongIndex++;
    if (currentSongIndex >= songs.length) {
        currentSongIndex = 0;
    }
    
    if (isCasting) {
        updateSongDisplay();
        setTimeout(() => castCurrentSong(), 100);
    } else {
        loadSong(currentSongIndex);
        if (isPlaying) play();
    }
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

// Recalcular posiciones cuando cambie el tamaño de la ventana
window.addEventListener('resize', () => {
    applyConfig();
});

// ========================================
// CHROMECAST - STYLED RECEIVER
// ========================================

// Configuración de Chromecast
window['__onGCastApiAvailable'] = function(isAvailable) {
    console.log('Cast API available:', isAvailable);
    if (isAvailable) {
        initializeCastApi();
    }
};

function initializeCastApi() {
    try {
        console.log('Initializing Cast API with Styled Receiver...');
        castContext = cast.framework.CastContext.getInstance();
        
        // Configurar con Styled Receiver
        castContext.setOptions({
            receiverApplicationId: STYLED_RECEIVER_APP_ID,
            autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
        });
        console.log('Cast configured with Styled Receiver ID:', STYLED_RECEIVER_APP_ID);
        
        // Mostrar botón de cast
        const castBtn = document.getElementById('castBtn');
        if (castBtn) {
            castBtn.classList.remove('hidden');
            castBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                if (castContext) {
                    try {
                        console.log('Requesting cast session...');
                        castContext.requestSession();
                    } catch (error) {
                        console.error('Error requesting session:', error);
                    }
                }
            });
        }
        
        // Escuchar cambios en el estado de la sesión
        castContext.addEventListener(
            cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
            onSessionStateChanged
        );
        
        // Escuchar cambios en el estado de cast
        castContext.addEventListener(
            cast.framework.CastContextEventType.CAST_STATE_CHANGED,
            onCastStateChanged
        );
        
        console.log('Chromecast initialized successfully');
    } catch (error) {
        console.error('Error initializing Cast:', error);
    }
}

function onSessionStateChanged(event) {
    console.log('Session state changed:', event.sessionState);
    switch (event.sessionState) {
        case cast.framework.SessionState.SESSION_STARTED:
            castSession = castContext.getCurrentSession();
            isCasting = true;
            console.log('Cast session started');
            onCastConnected();
            break;
        case cast.framework.SessionState.SESSION_ENDED:
            castSession = null;
            isCasting = false;
            console.log('Cast session ended');
            onCastDisconnected();
            break;
    }
}

function onCastStateChanged(event) {
    console.log('Cast state:', event.castState);
}

function onCastConnected() {
    console.log('Connected to Chromecast!');
    
    try {
        const session = castContext.getCurrentSession();
        if (session) {
            // Escuchar cambios en el estado del media
            session.addUpdateListener(() => {
                const mediaSession = session.getMediaSession();
                if (mediaSession) {
                    const playerState = mediaSession.playerState;
                    
                    // Sincronizar estado local con Cast
                    if (playerState === chrome.cast.media.PlayerState.PLAYING) {
                        if (!isPlaying) {
                            isPlaying = true;
                            updatePlayButton(true);
                            startEyesAnimation();
                        }
                    } else if (playerState === chrome.cast.media.PlayerState.PAUSED) {
                        if (isPlaying) {
                            isPlaying = false;
                            updatePlayButton(false);
                            stopEyesAnimation();
                        }
                    }
                }
            });
        }
    } catch (e) {
        console.error('Error getting session info:', e);
    }
    
    // Pausar reproducción local cuando conectamos a Cast
    if (audio && !audio.paused) {
        console.log('Pausing local playback...');
        audio.pause();
    }
    
    // Si hay música seleccionada, enviarla al Chromecast
    if (currentSongIndex >= 0) {
        console.log('Sending current song to Chromecast...');
        castCurrentSong();
    }
}

function onCastDisconnected() {
    console.log('Disconnected from Chromecast');
    
    // Si había una canción sonando en Cast, reanudar reproducción local
    if (isPlaying && currentSongIndex >= 0) {
        console.log('Resuming local playback...');
        setTimeout(() => {
            if (audio) {
                audio.play().catch(e => {
                    console.error('Cannot resume:', e);
                });
            }
        }, 500);
    }
}

function castCurrentSong() {
    if (!castSession || currentSongIndex < 0 || currentSongIndex >= songs.length) {
        console.error('Cannot send song: no session or invalid index');
        return;
    }
    
    const song = songs[currentSongIndex];
    const audioUrl = getAbsoluteUrl(song.path);
    console.log('Sending to Cast:', song.name);
    console.log('URL:', audioUrl);
    
    const mediaInfo = new chrome.cast.media.MediaInfo(
        audioUrl,
        'audio/mp3'
    );
    
    mediaInfo.metadata = new chrome.cast.media.MusicTrackMediaMetadata();
    mediaInfo.metadata.title = song.name;
    mediaInfo.metadata.artist = 'Robotraca';
    
    // Agregar imagen del álbum
    mediaInfo.metadata.images = [
        new chrome.cast.Image(getAbsoluteUrl('images/robotraca.png'))
    ];
    
    const request = new chrome.cast.media.LoadRequest(mediaInfo);
    request.autoplay = true;
    request.currentTime = audio.currentTime || 0;
    
    castSession.loadMedia(request).then(
        function() {
            console.log('Media loaded on Chromecast!');
            isPlaying = true;
            updatePlayButton(true);
            startEyesAnimation();
        },
        function(errorCode) {
            console.error('Load media error:', errorCode);
        }
    );
}

function getAbsoluteUrl(relativePath) {
    return new URL(relativePath, window.location.href).href;
}

// ========================================
// INICIALIZACIÓN
// ========================================

// Inicializar cuando esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
