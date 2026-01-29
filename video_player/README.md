# ROBOTRACA Video Player 📺

Reproductor de video retro sci-fi con soporte para Chromecast.

## Estructura de archivos

```
video_player/
├── index.html          # Página principal
├── css/
│   └── styles.css      # Estilos retro sci-fi
├── js/
│   └── player.js       # Lógica del reproductor
├── videos/             # ⬅️ Coloca tus MP4 aquí
│   ├── track1.mp4
│   ├── track2.mp4
│   ├── track3.mp4
│   └── track4.mp4
└── audio/              # (Opcional) MP3 separados
    ├── track1.mp3
    ├── track2.mp3
    ├── track3.mp3
    └── track4.mp3
```

## Configuración

### 1. Añadir tus videos

Coloca tus 4 archivos MP4 en la carpeta `videos/` con los nombres:
- `track1.mp4`
- `track2.mp4`
- `track3.mp4`
- `track4.mp4`

### 2. Personalizar títulos (Opcional)

Edita el archivo `js/player.js` y modifica el array `SONGS`:

```javascript
const SONGS = [
    {
        id: 1,
        title: "MI CANCIÓN 1",      // Cambia el título aquí
        video: "videos/track1.mp4",
        duration: "3:45"            // Duración aproximada
    },
    // ... más canciones
];
```

## GitHub Pages

### ¿Es correcto para videos de 10MB?

✅ **SÍ, es correcto.** GitHub Pages permite:
- Archivos individuales hasta **100MB**
- Repositorio total hasta **1GB**
- Tus videos de ~10MB están bien

### Límites a considerar

- Ancho de banda: 100GB/mes (soft limit)
- Si tu sitio tiene mucho tráfico, considera usar un CDN externo

### Alternativas para videos más grandes

Si en el futuro necesitas más espacio:
1. **YouTube/Vimeo** - Embeber videos
2. **Cloudinary** - CDN gratuito para media
3. **Firebase Storage** - Plan gratuito generoso

## Chromecast

El reproductor incluye soporte nativo para Google Chromecast:

1. Abre la página en **Google Chrome**
2. Asegúrate de estar en la misma red WiFi que tu Chromecast
3. Selecciona una canción
4. Pulsa el botón **"CAST TO TV"**
5. El video se reproducirá en tu TV

### Notas sobre Chromecast

- Solo funciona en **Google Chrome**
- Requiere **HTTPS** (GitHub Pages lo proporciona automáticamente)
- El Chromecast debe poder acceder a la URL del video

## URL de acceso

Una vez subido a GitHub Pages, accede en:

```
https://[tu-usuario].github.io/robotraca/video_player/
```

## Características

- 🎨 Diseño retro sci-fi con efectos de glitch
- 📱 Optimizado para móviles
- 📺 Soporte Chromecast integrado
- 🎵 Modo video y audio
- ⏩ Controles de reproducción completos
- 🔊 Barra de progreso interactiva
