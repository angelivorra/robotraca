// Chromecast functionality
let castSession = null;
let isCasting = false;
let castContext = null;

// Configuración de Chromecast
window['__onGCastApiAvailable'] = function(isAvailable) {
    if (isAvailable) {
        initializeCastApi();
    }
};

function initializeCastApi() {
    castContext = cast.framework.CastContext.getInstance();
    
    // TODO: Reemplazar con tu Application ID de Google Cast Developer Console
    // Por ahora usa el default, pero cambiarás esto cuando registres tu app
    // const CUSTOM_RECEIVER_APP_ID = chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID;
    const CUSTOM_RECEIVER_APP_ID = 'FBEBF31F'; // Descomenta cuando tengas tu ID
    
    // Configurar opciones
    castContext.setOptions({
        receiverApplicationId: CUSTOM_RECEIVER_APP_ID,
        autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
    });
    
    // Mostrar el botón de cast y agregar listener
    const castBtn = document.getElementById('castBtn');
    if (castBtn) {
        castBtn.classList.remove('hidden');
        
        // Agregar click listener manual por si el SDK no responde
        castBtn.addEventListener('click', function(e) {
            console.log('Cast button clicked');
            e.preventDefault();
            e.stopPropagation();
            
            // Intentar abrir diálogo de Cast
            if (castContext) {
                try {
                    castContext.requestSession();
                    console.log('Requesting cast session...');
                } catch (error) {
                    console.error('Error requesting cast session:', error);
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
    
    console.log('Chromecast inicializado correctamente');
}

function onSessionStateChanged(event) {
    switch (event.sessionState) {
        case cast.framework.SessionState.SESSION_STARTED:
            castSession = castContext.getCurrentSession();
            isCasting = true;
            onCastConnected();
            break;
        case cast.framework.SessionState.SESSION_ENDED:
            castSession = null;
            isCasting = false;
            onCastDisconnected();
            break;
    }
}

function onCastStateChanged(event) {
    console.log('Cast state changed:', event.castState);
}

function onCastConnected() {
    console.log('Conectado a Chromecast');
    console.log('Application ID en uso:', castContext.getSessionContext()?.applicationId);
    console.log('¿Es Default Receiver?', castContext.getSessionContext()?.applicationId === chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID);
    
    // Crear visualización personalizada para TV
    loadCastVisualizer();
    
    // Si hay música reproduciéndose, enviarla al Chromecast
    if (isPlaying && currentSongIndex >= 0) {
        castCurrentSong();
    } else {
        console.warn('No hay canción reproduciéndose. Carga una canción primero.');
    }
}

function onCastDisconnected() {
    console.log('Desconectado de Chromecast');
}

function castCurrentSong() {
    if (!castSession || currentSongIndex < 0 || currentSongIndex >= songs.length) {
        console.warn('No se puede enviar canción:', { 
            hasSesion: !!castSession, 
            songIndex: currentSongIndex, 
            totalSongs: songs.length 
        });
        return;
    }
    
    const song = songs[currentSongIndex];
    const audioUrl = getAbsoluteUrl(song.path);
    console.log('Enviando audio al Chromecast:', audioUrl);
    
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
            console.log('Media cargada en Chromecast con datos personalizados');
        },
        function(errorCode) {
            console.error('Error al cargar media:', errorCode);
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
        originalPlay();
        if (isCasting) {
            castCurrentSong();
        }
    };
    
    window.pause = function() {
        originalPause();
        if (isCasting && castSession) {
            const mediaSession = castSession.getMediaSession();
            if (mediaSession) {
                mediaSession.pause(new chrome.cast.media.PauseRequest());
            }
        }
    };
    
    window.stop = function() {
        originalStop();
        if (isCasting && castSession) {
            castSession.endSession(true);
        }
    };
    
    window.nextSong = function() {
        originalNextSong();
        if (isCasting && isPlaying) {
            setTimeout(() => castCurrentSong(), 100);
        }
    };
    
    window.previousSong = function() {
        originalPreviousSong();
        if (isCasting && isPlaying) {
            setTimeout(() => castCurrentSong(), 100);
        }
    };
}

// Inicializar integración cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupCastIntegration);
} else {
    setupCastIntegration();
}
