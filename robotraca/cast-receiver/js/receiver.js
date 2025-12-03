// Google Cast Receiver para Robotraca
console.log('Receiver script loaded');

// Variables globales
let currentSongName = 'Esperando canción...';
let visualizerBars = [];
let isPlaying = false;

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
    console.log('Initializing Cast Receiver...');
    
    if (!cast || !cast.framework) {
        console.error('Cast SDK not loaded!');
        return;
    }
    
    const context = cast.framework.CastReceiverContext.getInstance();
    const playerManager = context.getPlayerManager();
    
    // Event listeners
    playerManager.addEventListener(cast.framework.events.EventType.LOAD, (event) => {
        console.log('Media loaded:', event.media);
        if (event.media && event.media.metadata && event.media.metadata.title) {
            updateSongName(event.media.metadata.title);
        }
    });
    
    playerManager.addEventListener(cast.framework.events.EventType.PLAYER_STATE_CHANGED, (event) => {
        console.log('Player state:', event.playerState);
        isPlaying = (event.playerState === cast.framework.messages.PlayerState.PLAYING);
    });
    
    // Opciones e inicio
    const options = new cast.framework.CastReceiverOptions();
    options.disableIdleTimeout = false;
    
    context.start(options);
    console.log('Cast Receiver started!');
}

// Inicializar todo
window.addEventListener('load', () => {
    initVisualizer();
    initializeCastReceiver();
});
