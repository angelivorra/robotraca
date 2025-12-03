// Google Cast Receiver para Robotraca
const context = cast.framework.CastReceiverContext.getInstance();
const playerManager = context.getPlayerManager();

// Variables globales
let currentSongName = 'Esperando canción...';
let visualizerBars = [];
let isPlaying = false;

// Inicializar visualizador
function initVisualizer() {
    const barsContainer = document.getElementById('visualizerBars');
    const numBars = 32;
    
    // Crear barras
    for (let i = 0; i < numBars; i++) {
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.animationDelay = `${i * 0.05}s`;
        barsContainer.appendChild(bar);
        visualizerBars.push(bar);
    }
    
    // Animar barras
    animateVisualizer();
}

// Animar visualizador
function animateVisualizer() {
    if (!isPlaying) {
        // Animación suave cuando no hay audio
        visualizerBars.forEach((bar, index) => {
            const height = 20 + Math.random() * 30;
            bar.style.height = `${height}%`;
        });
    } else {
        // Animación más intensa durante reproducción
        visualizerBars.forEach((bar, index) => {
            const baseHeight = Math.sin(Date.now() / 500 + index * 0.5) * 30 + 40;
            const randomness = Math.random() * 30;
            const height = Math.max(20, baseHeight + randomness);
            bar.style.height = `${height}%`;
        });
    }
    
    requestAnimationFrame(animateVisualizer);
}

// Actualizar nombre de canción
function updateSongName(name) {
    currentSongName = name || 'Canción sin título';
    const songNameEl = document.getElementById('songName');
    if (songNameEl) {
        songNameEl.textContent = currentSongName;
        // Animar cambio
        songNameEl.style.animation = 'none';
        setTimeout(() => {
            songNameEl.style.animation = 'fadeIn 1s ease-in-out';
        }, 10);
    }
}

// Event listeners del Cast Receiver
playerManager.addEventListener(
    cast.framework.events.EventType.MEDIA_STATUS,
    (event) => {
        console.log('Media status:', event);
    }
);

// Cuando se carga un nuevo medio
playerManager.addEventListener(
    cast.framework.events.EventType.LOAD,
    (event) => {
        console.log('Media loaded:', event);
        
        const media = event.media;
        if (media && media.metadata) {
            updateSongName(media.metadata.title);
        }
        
        // Extraer customData si está disponible
        if (media && media.customData) {
            console.log('Custom data:', media.customData);
            if (media.customData.songName) {
                updateSongName(media.customData.songName);
            }
        }
        
        return event;
    }
);

// Cuando cambia el estado de reproducción
playerManager.addEventListener(
    cast.framework.events.EventType.PLAYER_STATE_CHANGED,
    (event) => {
        console.log('Player state changed:', event);
        
        switch (event.state) {
            case 'PLAYING':
                isPlaying = true;
                console.log('Reproduciendo:', currentSongName);
                break;
            case 'PAUSED':
                isPlaying = false;
                console.log('Pausado');
                break;
            case 'IDLE':
                isPlaying = false;
                console.log('Detenido');
                break;
        }
    }
);

// Interceptar metadata para obtener info de la canción
playerManager.setMessageInterceptor(
    cast.framework.messages.MessageType.LOAD,
    (loadRequestData) => {
        console.log('Load request:', loadRequestData);
        
        if (loadRequestData.media && loadRequestData.media.metadata) {
            const metadata = loadRequestData.media.metadata;
            updateSongName(metadata.title || 'Canción sin título');
        }
        
        if (loadRequestData.media && loadRequestData.media.customData) {
            const customData = loadRequestData.media.customData;
            if (customData.songName) {
                updateSongName(customData.songName);
            }
        }
        
        return loadRequestData;
    }
);

// Opciones del receiver
const options = new cast.framework.CastReceiverOptions();
options.disableIdleTimeout = false;
options.maxInactivity = 3600; // 1 hora

// Inicializar receiver
console.log('Inicializando Cast Receiver...');
context.start(options);

// Inicializar visualizador cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVisualizer);
} else {
    initVisualizer();
}

console.log('Cast Receiver iniciado correctamente');
