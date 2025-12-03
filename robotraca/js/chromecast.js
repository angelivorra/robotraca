// Chromecast functionality
let castSession = null;
let isCasting = false;
let castContext = null;

// Mobile Debug Logger
const mobileLog = {
    panel: null,
    init: function() {
        this.panel = document.getElementById('mobileDebug');
        if (this.panel) {
            this.panel.classList.add('active');
            this.log('Debug panel initialized', 'info');
            
            // Capturar errores globales
            window.addEventListener('error', (e) => {
                this.error('Global error: ' + e.message);
            });
            
            // Capturar rechazos de promesas
            window.addEventListener('unhandledrejection', (e) => {
                this.error('Promise rejected: ' + e.reason);
            });
        }
    },
    log: function(message, type = 'info') {
        console.log(message);
        if (!this.panel) return;
        
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        const time = new Date().toLocaleTimeString();
        entry.textContent = `[${time}] ${message}`;
        this.panel.appendChild(entry);
        this.panel.scrollTop = this.panel.scrollHeight;
        
        // Limitar a 20 entradas
        while (this.panel.children.length > 20) {
            this.panel.removeChild(this.panel.firstChild);
        }
    },
    error: function(message) { this.log(message, 'error'); },
    success: function(message) { this.log(message, 'success'); },
    info: function(message) { this.log(message, 'info'); }
};

// Configuración de Chromecast
window['__onGCastApiAvailable'] = function(isAvailable) {
    mobileLog.info('Cast API available: ' + isAvailable);
    if (isAvailable) {
        initializeCastApi();
    } else {
        mobileLog.error('Cast API not available');
    }
};

function initializeCastApi() {
    try {
        mobileLog.info('Initializing Cast API...');
        castContext = cast.framework.CastContext.getInstance();
        mobileLog.success('CastContext obtained');
        
        // TODO: Reemplazar con tu Application ID de Google Cast Developer Console
        // Por ahora usa el default para que aparezcan los dispositivos
        const CUSTOM_RECEIVER_APP_ID = chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID;
        // const CUSTOM_RECEIVER_APP_ID = 'FBEBF31F'; // Usa esto cuando registres tu receiver personalizado
        mobileLog.info('Using App ID: DEFAULT_MEDIA_RECEIVER');
        
        // Configurar opciones
        castContext.setOptions({
            receiverApplicationId: CUSTOM_RECEIVER_APP_ID,
            autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
        });
        mobileLog.success('Cast options configured');
        
        // Mostrar el botón de cast y agregar listener
        const castBtn = document.getElementById('castBtn');
        if (castBtn) {
            castBtn.classList.remove('hidden');
            mobileLog.success('Cast button found and shown');
            
            // Agregar múltiples listeners para debug
            castBtn.addEventListener('touchstart', function(e) {
                mobileLog.info('TOUCH START on cast button');
                castBtn.style.opacity = '0.7';
            });
            
            castBtn.addEventListener('touchend', function(e) {
                mobileLog.info('TOUCH END on cast button');
                castBtn.style.opacity = '1';
            });
            
            castBtn.addEventListener('click', function(e) {
                mobileLog.info('CAST BUTTON CLICKED!');
                e.preventDefault();
                e.stopPropagation();
                
                // Intentar abrir diálogo de Cast
                if (castContext) {
                    try {
                        mobileLog.info('Requesting cast session...');
                        castContext.requestSession();
                        mobileLog.success('requestSession() called');
                    } catch (error) {
                        mobileLog.error('Error: ' + error.message);
                    }
                } else {
                    mobileLog.error('castContext is null!');
                }
            });
            
            // Test inmediato
            mobileLog.info('Button bounds: ' + JSON.stringify(castBtn.getBoundingClientRect()));
            mobileLog.info('Button styles: opacity=' + window.getComputedStyle(castBtn).opacity);
        } else {
            mobileLog.error('Cast button NOT found!');
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
        
        mobileLog.success('Chromecast initialized OK');
    } catch (error) {
        mobileLog.error('Init error: ' + error.message);
    }
}

function onSessionStateChanged(event) {
    mobileLog.info('Session state changed: ' + event.sessionState);
    switch (event.sessionState) {
        case cast.framework.SessionState.SESSION_STARTED:
            castSession = castContext.getCurrentSession();
            isCasting = true;
            mobileLog.success('Cast session STARTED');
            onCastConnected();
            break;
        case cast.framework.SessionState.SESSION_ENDED:
            castSession = null;
            isCasting = false;
            mobileLog.info('Cast session ENDED');
            onCastDisconnected();
            break;
    }
}

function onCastStateChanged(event) {
    mobileLog.info('Cast state: ' + event.castState);
}

function onCastConnected() {
    mobileLog.success('Connected to Chromecast!');
    
    // Obtener información de la sesión correctamente
    try {
        const session = castContext.getCurrentSession();
        if (session) {
            const appId = session.getApplicationMetadata()?.applicationId;
            mobileLog.info('App ID in use: ' + appId);
            const isDefault = appId === chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID;
            mobileLog.info('Is Default Receiver? ' + isDefault);
            
            // Escuchar cambios en el estado del media
            session.addUpdateListener(() => {
                const mediaSession = session.getMediaSession();
                if (mediaSession) {
                    const playerState = mediaSession.playerState;
                    
                    // Sincronizar estado local con Cast
                    if (playerState === chrome.cast.media.PlayerState.PLAYING) {
                        if (!isPlaying) {
                            isPlaying = true;
                            updatePlayButton();
                        }
                    } else if (playerState === chrome.cast.media.PlayerState.PAUSED) {
                        if (isPlaying) {
                            isPlaying = false;
                            updatePlayButton();
                        }
                    }
                }
            });
        }
    } catch (e) {
        mobileLog.error('Error getting session info: ' + e.message);
    }
    
    // Pausar reproducción local cuando conectamos a Cast
    if (audio && !audio.paused) {
        mobileLog.info('Pausing local playback...');
        audio.pause();
    }
    
    // Si hay música seleccionada, enviarla al Chromecast
    if (currentSongIndex >= 0) {
        mobileLog.info('Sending current song to Chromecast...');
        castCurrentSong();
    } else {
        mobileLog.info('No song selected.');
    }
}

function onCastDisconnected() {
    mobileLog.info('Disconnected from Chromecast');
    
    // Si había una canción sonando en Cast, reanudar reproducción local
    if (isPlaying && currentSongIndex >= 0) {
        mobileLog.info('Resuming local playback...');
        // Pequeño delay para evitar problemas
        setTimeout(() => {
            if (audio) {
                audio.play().catch(e => {
                    mobileLog.error('Cannot resume: ' + e.message);
                });
            }
        }, 500);
    }
}

function castCurrentSong() {
    if (!castSession || currentSongIndex < 0 || currentSongIndex >= songs.length) {
        mobileLog.error('Cannot send song: session=' + !!castSession + ' idx=' + currentSongIndex);
        return;
    }
    
    const song = songs[currentSongIndex];
    const audioUrl = getAbsoluteUrl(song.path);
    mobileLog.info('Sending to Cast: ' + song.name);
    mobileLog.info('URL: ' + audioUrl);
    
    const mediaInfo = new chrome.cast.media.MediaInfo(
        audioUrl,
        'audio/mp3'
    );
    
    mediaInfo.metadata = new chrome.cast.media.MusicTrackMediaMetadata();
    mediaInfo.metadata.title = song.name;
    mediaInfo.metadata.artist = 'Robotraca';
    
    // Agregar imagen del álbum
    mediaInfo.metadata.images = [
        new chrome.cast.Image(getAbsoluteUrl('images/robot/cabeza.png'))
    ];
    
    // Datos personalizados para tu visualización custom
    mediaInfo.customData = {
        songName: song.name,
        songIndex: currentSongIndex,
        totalSongs: songs.length,
        visualizerUrl: getAbsoluteUrl('cast-receiver/index.html')
    };
    
    const request = new chrome.cast.media.LoadRequest(mediaInfo);
    request.autoplay = true;
    request.currentTime = audio.currentTime || 0;
    
    castSession.loadMedia(request).then(
        function() {
            mobileLog.success('Media loaded on Chromecast!');
        },
        function(errorCode) {
            mobileLog.error('Load media error: ' + errorCode);
        }
    );
}

function loadCastVisualizer() {
    if (!castSession) return;
    
    // Crear HTML personalizado para la visualización en TV
    const visualizerHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    background: linear-gradient(135deg, #000000 0%, #2e0557 100%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    font-family: 'Arial', sans-serif;
                    overflow: hidden;
                }
                
                .robot-container {
                    text-align: center;
                    animation: pulse 2s ease-in-out infinite;
                }
                
                .robot-name {
                    font-size: 120px;
                    font-weight: bold;
                    color: #fff;
                    text-shadow: 4px 4px 8px rgba(0,0,0,0.8);
                    margin-bottom: 40px;
                }
                
                .song-name {
                    font-size: 80px;
                    color: #fff;
                    text-shadow: 2px 2px 6px rgba(0,0,0,0.8);
                    margin-top: 40px;
                }
                
                .visualizer {
                    display: flex;
                    gap: 10px;
                    align-items: flex-end;
                    justify-content: center;
                    height: 200px;
                    margin: 60px 0;
                }
                
                .bar {
                    width: 30px;
                    background: linear-gradient(to top, #1976d2, #64b5f6);
                    border-radius: 15px;
                    animation: bounce 0.8s ease-in-out infinite;
                }
                
                .bar:nth-child(1) { animation-delay: 0s; }
                .bar:nth-child(2) { animation-delay: 0.1s; }
                .bar:nth-child(3) { animation-delay: 0.2s; }
                .bar:nth-child(4) { animation-delay: 0.3s; }
                .bar:nth-child(5) { animation-delay: 0.4s; }
                .bar:nth-child(6) { animation-delay: 0.3s; }
                .bar:nth-child(7) { animation-delay: 0.2s; }
                .bar:nth-child(8) { animation-delay: 0.1s; }
                
                @keyframes bounce {
                    0%, 100% { height: 50px; }
                    50% { height: 180px; }
                }
                
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
            </style>
        </head>
        <body>
            <div class="robot-container">
                <div class="robot-name">ROBOTRACA</div>
                <div class="visualizer">
                    <div class="bar"></div>
                    <div class="bar"></div>
                    <div class="bar"></div>
                    <div class="bar"></div>
                    <div class="bar"></div>
                    <div class="bar"></div>
                    <div class="bar"></div>
                    <div class="bar"></div>
                </div>
                <div class="song-name" id="songName">Pulse Play</div>
            </div>
        </body>
        </html>
    `;
    
    // Nota: La carga de HTML personalizado requiere un Custom Receiver App
    // Para desarrollo, usamos el Default Media Receiver
    console.log('Visualizador preparado para TV');
}

function getAbsoluteUrl(relativePath) {
    return new URL(relativePath, window.location.href).href;
}

// Integrar con el reproductor existente
function setupCastIntegration() {
    // Sobrescribir funciones de play/pause para sincronizar con Cast
    const originalPlay = window.play;
    const originalPause = window.pause;
    const originalStop = window.stop;
    const originalNextSong = window.nextSong;
    const originalPreviousSong = window.previousSong;
    
    window.play = function() {
        if (isCasting) {
            // Si estamos en Cast, solo controlar el Chromecast
            mobileLog.info('Play command -> Chromecast');
            castCurrentSong();
        } else {
            // Si no, reproducir localmente
            originalPlay();
        }
    };
    
    window.pause = function() {
        if (isCasting && castSession) {
            // Si estamos en Cast, pausar el Chromecast
            mobileLog.info('Pause command -> Chromecast');
            const mediaSession = castSession.getMediaSession();
            if (mediaSession) {
                mediaSession.pause(new chrome.cast.media.PauseRequest());
            }
        } else {
            // Si no, pausar localmente
            originalPause();
        }
    };
    
    window.stop = function() {
        if (isCasting && castSession) {
            // Si estamos en Cast, detener y desconectar
            mobileLog.info('Stop command -> Ending Cast session');
            castSession.endSession(true);
        } else {
            // Si no, detener localmente
            originalStop();
        }
    };
    
    window.nextSong = function() {
        originalNextSong();
        if (isCasting) {
            // Si estamos en Cast, enviar nueva canción
            mobileLog.info('Next song -> Chromecast');
            setTimeout(() => castCurrentSong(), 100);
        }
    };
    
    window.previousSong = function() {
        originalPreviousSong();
        if (isCasting) {
            // Si estamos en Cast, enviar nueva canción
            mobileLog.info('Previous song -> Chromecast');
            setTimeout(() => castCurrentSong(), 100);
        }
    };
}

// Inicializar debug panel y cast integration cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        mobileLog.init();
        setupCastIntegration();
    });
} else {
    mobileLog.init();
    setupCastIntegration();
}
