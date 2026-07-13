# songs/

Cada canción tiene su propia carpeta con los assets del videoclip.

## Estructura por canción

```
songs/
└── <id>/
    ├── audio.mp3        OBLIGATORIO — pista de audio
    ├── model.glb        OBLIGATORIO — modelo 3D (GLTF Binary)
    ├── subtitles.vtt    Opcional    — letras sincronizadas
    └── bg.jpg           Opcional    — textura de fondo (si no, usa theme.bgColor)
```

## Añadir una nueva canción

1. Crea la carpeta `songs/<id>/` con los archivos de arriba.
2. Añade una entrada al array `SONGS` en `js/config.js`:

```js
{
    id: 'mi-cancion',
    title: 'TITULO EN MAYUSCULAS',
    duration: '3:30',
    audio:     'songs/mi-cancion/audio.mp3',
    model:     'songs/mi-cancion/model.glb',
    subtitles: 'songs/mi-cancion/subtitles.vtt',   // null si no hay
    coverArt:  'img/mi-cancion.png',               // portada en la lista
    background: null,                              // o 'songs/mi-cancion/bg.jpg'
    theme: {
        bgColor:        '#000000',  // color de fondo de la escena
        primaryColor:   '#e94560',  // luz 1 + partículas + beat flash
        secondaryColor: '#16c79a',  // luz 2
        modelBaseScale: 1.0,        // escala base del modelo
        particleCount:  800,        // partículas (200 en móvil automáticamente)
        cameraDistance: 5,          // distancia inicial de la cámara
    }
}
```

3. Añade la imagen de portada (`img/<id>.png`) para la lista de canciones.

## Formato de subtítulos (WebVTT)

Archivo `subtitles.vtt`:

```
WEBVTT

00:00.500 --> 00:02.000
PRIMERA LINEA DE LETRA

00:02.500 --> 00:05.000
SEGUNDA LINEA

00:05.200 --> 00:08.000
PUEDE SER MULTILÍNEA
CON SALTOS
```

Timestamps: `MM:SS.mmm` o `HH:MM:SS.mmm`

## Modelo 3D (GLB/GLTF)

- Formato: GLTF Binary (`.glb`) recomendado
- El modelo se auto-centra y auto-escala a 2 unidades de Three.js
- Si el archivo no existe, se usa un icosaedro de alambre como fallback
- Herramientas para crear/convertir: Blender (exportar → GLTF 2.0), Sketchfab, etc.
