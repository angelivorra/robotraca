// Google Cast Receiver para Robotraca

// Variables globales
let currentSongName = 'Esperando canción...';
let visualizerBars = [];
let isPlaying = false;
let debugPanel;

// Sistema de logging visual mejorado
function debugLog(message, type = 'info') {
    console.log(message);
    
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
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
    originalLog.apply(console, args);
    debugLog(args.join(' '), 'info');
};

console.error = function(...args) {
    originalError.apply(console, args);
    debugLog('ERROR: ' + args.join(' '), 'error');
};

debugLog('Receiver script loaded', 'success');

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
        
        debugLog('Context y PlayerManager OK');
        
        // Event listeners
        playerManager.addEventListener(cast.framework.events.EventType.LOAD, (event) => {
            debugLog('Media cargada: ' + (event.media?.metadata?.title || 'sin título'));
            if (event.media && event.media.metadata && event.media.metadata.title) {
                updateSongName(event.media.metadata.title);
            }
        });
        
        playerManager.addEventListener(cast.framework.events.EventType.PLAYER_STATE_CHANGED, (event) => {
            debugLog('Estado: ' + event.playerState);
            isPlaying = (event.playerState === cast.framework.messages.PlayerState.PLAYING);
        });
        
        debugLog('Listeners configurados');
        
        // Opciones e inicio
        const options = new cast.framework.CastReceiverOptions();
        options.disableIdleTimeout = false;
        
        debugLog('Iniciando receiver...');
        context.start(options);
        debugLog('RECEIVER INICIADO OK!');
        
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
    initVisualizer();
    initializeCastReceiver();
});
