// Google Cast Receiver para Robotraca

// Variables globales
let currentSongName = 'Esperando canción...';
let visualizerBars = [];
let isPlaying = false;
let debugPanel;

// Guardar referencias originales ANTES de cualquier otra cosa
const originalLog = console.log;
const originalError = console.error;

// Sistema de logging visual mejorado
function debugLog(message, type = 'info') {
    // Usar la función original para evitar recursión
    originalLog(message);
    
    if (!debugPanel) {
        debugPanel = document.getElementById('debugPanel');
    }
    
    if (debugPanel) {
        const time = new Date().toLocaleTimeString();
        const color = type === 'error' ? '#f00' : type === 'success' ? '#0f0' : '#0ff';
        const entry = document.createElement('div');
        entry.style.color = color;
        entry.style.marginBottom = '5px';
        entry.textContent = `[${time}] ${message}`;
        debugPanel.appendChild(entry);
        debugPanel.scrollTop = debugPanel.scrollHeight;
        
        // Limitar a 20 líneas
        while (debugPanel.children.length > 20) {
            debugPanel.removeChild(debugPanel.firstChild);
        }
    }
}

// Capturar todos los console.log/error
console.log = function(...args) {
    originalLog.apply(console, args);
    debugLog(args.join(' '), 'info');
};

console.error = function(...args) {
    originalError.apply(console, args);
    debugLog('ERROR: ' + args.join(' '), 'error');
};

// Esperar a que el DOM esté listo antes de loguear
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        debugLog('✓ Receiver script v12 - audio debug enhanced', 'success');
    });
} else {
    debugLog('✓ Receiver script v12 - audio debug enhanced', 'success');
}

// Inicializar visualizador
function initVisualizer() {
    const barsContainer = document.getElementById('visualizerBars');
    const numBars = 32;
    
    for (let i = 0; i < numBars; i++) {
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.animationDelay = `${i * 0.05}s`;
        barsContainer.appendChild(bar);
        visualizerBars.push(bar);
    }
    
    animateVisualizer();
}

// Animar visualizador
function animateVisualizer() {
    visualizerBars.forEach((bar, index) => {
        if (isPlaying) {
            const baseHeight = Math.sin(Date.now() / 500 + index * 0.5) * 30 + 40;
            const randomness = Math.random() * 30;
            const height = Math.max(20, baseHeight + randomness);
            bar.style.height = `${height}%`;
        } else {
            // Cuando no está reproduciendo, barras bajas y estáticas
            bar.style.height = '20px';
        }
    });
    
    requestAnimationFrame(animateVisualizer);
}

// Controlar animación de ojos
function updateEyesAnimation() {
    const leftEye = document.querySelector('.left-eye .eye-img');
    const rightEye = document.querySelector('.right-eye .eye-img');
    
    if (leftEye && rightEye) {
        if (isPlaying) {
            leftEye.classList.add('spinning');
            rightEye.classList.add('spinning');
        } else {
            leftEye.classList.remove('spinning');
            rightEye.classList.remove('spinning');
        }
    }
}

// Actualizar nombre de canción
function updateSongName(name) {
    currentSongName = name || 'Canción sin título';
    const songNameEl = document.getElementById('songName');
    if (songNameEl) {
        songNameEl.textContent = currentSongName;
    }
}

// Inicializar Cast Receiver
function initializeCastReceiver() {
    debugLog('Inicializando receiver...', 'info');
    
    if (!cast || !cast.framework) {
        debugLog('Cast SDK no cargado', 'error');
        return;
    }
    
    debugLog('SDK cargado OK', 'success');
    
    try {
        const context = cast.framework.CastReceiverContext.getInstance();
        const playerManager = context.getPlayerManager();
        
        debugLog('Context y PlayerManager OK', 'success');
        
        // Obtener referencia al elemento de audio
        const playerElement = document.getElementById('player');
        if (playerElement) {
            debugLog('Elemento <audio> encontrado', 'success');
            
            // Asegurar que el volumen está al máximo
            playerElement.volume = 1.0;
            playerElement.muted = false;
            debugLog('Volume: ' + playerElement.volume + ', Muted: ' + playerElement.muted, 'info');
            
            // Listeners del elemento HTML5 para diagnóstico
            playerElement.addEventListener('loadedmetadata', () => {
                debugLog('Audio metadata loaded', 'success');
            });
            
            playerElement.addEventListener('canplay', () => {
                debugLog('Audio can play - duration: ' + Math.round(playerElement.duration) + 's', 'success');
            });
            
            playerElement.addEventListener('volumechange', () => {
                debugLog('Volume changed: ' + playerElement.volume + ', muted: ' + playerElement.muted, 'info');
            });
            
            playerElement.addEventListener('playing', () => {
                debugLog('HTML5 Audio PLAYING - currentTime: ' + Math.round(playerElement.currentTime), 'success');
            });
        } else {
            debugLog('ERROR: No se encuentra elemento <audio>', 'error');
        }
        
        // Interceptar mensajes LOAD
        playerManager.setMessageInterceptor(
            cast.framework.messages.MessageType.LOAD,
            (loadRequestData) => {
                debugLog('LOAD interceptado: ' + (loadRequestData.media?.metadata?.title || 'sin título'), 'success');
                if (loadRequestData.media && loadRequestData.media.metadata && loadRequestData.media.metadata.title) {
                    updateSongName(loadRequestData.media.metadata.title);
                }
                return loadRequestData;
            }
        );
        
        // Event listeners para PLAYING y PAUSE
        playerManager.addEventListener(
            cast.framework.events.EventType.PLAYING,
            (event) => {
                debugLog('▶ PLAYING', 'success');
                isPlaying = true;
                updateEyesAnimation();
            }
        );
        
        playerManager.addEventListener(
            cast.framework.events.EventType.PAUSE,
            (event) => {
                debugLog('⏸ PAUSE', 'info');
                isPlaying = false;
                updateEyesAnimation();
            }
        );
        
        // Listener para cuando termina de cargar
        playerManager.addEventListener(
            cast.framework.events.EventType.PLAYER_LOAD_COMPLETE,
            (event) => {
                debugLog('✓ Media cargada completamente', 'success');
            }
        );
        
        // Listener para errores
        playerManager.addEventListener(
            cast.framework.events.EventType.ERROR,
            (event) => {
                debugLog('❌ ERROR: ' + (event.detailedErrorCode || 'unknown'), 'error');
            }
        );
        
        debugLog('Listeners configurados', 'success');
        
        // Opciones e inicio
        const options = new cast.framework.CastReceiverOptions();
        options.disableIdleTimeout = false;
        
        debugLog('Iniciando receiver...', 'info');
        context.start(options);
        debugLog('✓ RECEIVER INICIADO OK!', 'success');
        
        // Verificar y reportar volumen del sistema
        setTimeout(() => {
            const playerElement = document.getElementById('player');
            if (playerElement) {
                debugLog('Check audio: volume=' + playerElement.volume + 
                        ', muted=' + playerElement.muted + 
                        ', paused=' + playerElement.paused + 
                        ', src=' + (playerElement.src ? 'YES' : 'NO'), 'info');
            }
        }, 1000);
        
        // Después de 2 segundos, volver a mostrar "Esperando canción..."
        setTimeout(() => {
            updateSongName(currentSongName);
        }, 2000);
        
    } catch (error) {
        debugLog('ERROR: ' + error.message);
    }
}

// Inicializar todo
window.addEventListener('load', () => {
    debugLog('Window loaded - iniciando...', 'info');
    initVisualizer();
    debugLog('Visualizer initialized', 'success');
    initializeCastReceiver();
});

// También agregar un log inmediato para verificar
setTimeout(() => {
    const panel = document.getElementById('debugPanel');
    if (panel && panel.children.length === 0) {
        panel.innerHTML = '<div style="color: #f00;">ERROR: No se están ejecutando los logs. Verifica la consola del navegador.</div>';
    }
}, 1000);
