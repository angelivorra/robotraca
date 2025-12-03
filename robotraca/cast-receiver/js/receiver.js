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
        debugLog('Receiver script loaded', 'success');
    });
} else {
    debugLog('Receiver script loaded', 'success');
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
        const baseHeight = isPlaying ? 
            Math.sin(Date.now() / 500 + index * 0.5) * 30 + 40 : 
            20 + Math.random() * 30;
        const randomness = Math.random() * (isPlaying ? 30 : 10);
        const height = Math.max(20, baseHeight + randomness);
        bar.style.height = `${height}%`;
    });
    
    requestAnimationFrame(animateVisualizer);
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
        
        // Event listener para cambios de estado
        playerManager.addEventListener(
            cast.framework.events.EventType.PLAYER_STATE_CHANGED, 
            (event) => {
                debugLog('Estado del player: ' + event.playerState, 'info');
                isPlaying = (event.playerState === cast.framework.messages.PlayerState.PLAYING);
            }
        );
        
        debugLog('Listeners configurados', 'success');
        
        // Opciones e inicio
        const options = new cast.framework.CastReceiverOptions();
        options.disableIdleTimeout = false;
        
        debugLog('Iniciando receiver...', 'info');
        context.start(options);
        debugLog('✓ RECEIVER INICIADO OK!', 'success');
        
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
