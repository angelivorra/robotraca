# ROBOTRACA — Guía del proyecto

## ¿Qué es esto?

Robotraca es un reproductor musical con videoclips 3D para canciones de un grupo de música. El proyecto activo es **`video_player/`** — los demás directorios (`robotraca/`, `reciever/`) son versiones antiguas que ya no se usan.

## Cómo ejecutarlo

No hay build step. Servidor HTTP estático apuntando a `video_player/`:

```bash
cd video_player && python -m http.server 8080
# Abrir http://localhost:8080
```

## Arquitectura de video_player

```
video_player/
├── index.html              Punto de entrada, meta tags PWA
├── manifest.json           Configuración "Add to Home Screen" (iOS/Android)
├── css/styles.css          Estilos — tema retro pixel art
├── js/
│   ├── config.js           ← CONFIGURACIÓN DE CANCIONES + VERSION
│   ├── player.js           Lógica de UI, selección de canción, reproducción
│   ├── audio-engine.js     Web Audio API: AudioContext, beat detection, iOS fixes
│   ├── audio-reactive.js   Smoothing exponencial de bassEnergy/midsEnergy/highsEnergy
│   ├── visualizer.js       Three.js: renderer, cámara, loop de render, bloom, touch
│   ├── loader.js           Carga paralela de assets (audio, GLB, subtítulos)
│   ├── subtitles.js        Parser y engine de subtítulos SRT/VTT
│   ├── touch-input.js      Tap, drag, swipe, gyro (iOS + Android + desktop)
│   ├── effects.js          TapBurstEffect, RingPulseEffect
│   ├── scenes/             Escenas de fondo (una por canción)
│   │   ├── registry.js     Mapa nombre → clase
│   │   ├── city.js         Ciudad cyberpunk con LEDs reactivos al beat
│   │   ├── outrun.js       Carretera estilo Outrun con coches y curvas
│   │   ├── jungle.js       Selva tropical
│   │   ├── apocalypse.js   Paisaje apocalíptico
│   │   ├── tunnel.js       Túnel neón
│   │   ├── spaceship.js    Interior de nave espacial
│   │   └── space.js        Espacio con partículas
│   └── objects/            Objetos 3D centrales (el modelo que "baila")
│       ├── registry.js     Dispatcher: ruta .glb → GltfObject, nombre → procedural
│       ├── gltf-object.js  Carga y anima modelos GLTF/GLB
│       ├── torus-knot.js   Procedural: nudo toroidal
│       └── icosahedron.js  Procedural: icosaedro wireframe (fallback)
├── songs/                  Assets de cada canción (audio, modelo, subtítulos)
└── img/                    Portadas para la lista de canciones
```

## Añadir una canción nueva

1. Crea `songs/<id>/` con:
   - `audio.mp3` — pista de audio (obligatorio)
   - `model.glb` — modelo 3D GLTF Binary (obligatorio; si falta, usa icosaedro)
   - `subtitles.srt` — letras sincronizadas (opcional)

2. Añade una portada en `img/<id>.png`

3. Añade una entrada en `js/config.js`:

```js
{
    id:       'mi-cancion',
    title:    'TITULO EN MAYUSCULAS',
    duration: '3:30',
    audio:     'songs/mi-cancion/audio.mp3',
    subtitles: 'songs/mi-cancion/subtitles.srt',  // null si no hay
    coverArt:  'img/mi-cancion.png',
    background: null,

    scenes:  ['city'],          // escena de fondo
    objects: ['songs/mi-cancion/model.glb'],

    theme: {
        bgColor:        '#050010',
        primaryColor:   '#e94560',
        secondaryColor: '#16c79a',
        modelBaseScale: 1.0,
        cameraDistance: 5,
        modelEmissive:  false,
        modelPosition:  [0, 1.3, 0],
    }
}
```

## Añadir una escena nueva

Crea `js/scenes/mi-escena.js` con esta interfaz:

```js
export class MiEscena {
    get useBloom() { return false; }   // siempre false — bloom desactivado en todos los dispositivos

    constructor() { /* inicializar estado */ }

    init(threeScene, theme) {
        // Construir geometría y añadirla a threeScene
        // theme tiene: bgColor, primaryColor, secondaryColor, etc.
    }

    update(reactive, delta) {
        // Llamado cada frame. reactive tiene:
        //   reactive.bassEnergy   0-1 suavizado
        //   reactive.midsEnergy   0-1 suavizado
        //   reactive.highsEnergy  0-1 suavizado
        //   reactive.isBeat       boolean (raw, sin suavizar)
    }

    onBeat()       { /* flash en beat */ }
    onTap()        { /* efecto al tocar pantalla */ }
    onSwipe(dir)   { /* dir = 'left'|'right'|'up'|'down' */ }

    dispose() {
        // Eliminar geometría de la escena, liberar GPU
    }
}
```

Registra la escena en `js/scenes/registry.js` y úsala en `config.js`.

## Detalles técnicos clave

### Stack
- **Three.js r167** vía CDN con import maps — sin npm, sin build step
- **ES modules** nativos del navegador
- **MeshBasicMaterial** para aspecto flat SNES; **MeshStandardMaterial + emissive** para elementos reactivos/brillantes

### Cámara
La cámara está siempre en `(0, 0, cameraDistance)` mirando a `(0, 0, 0)`. Las escenas **no pueden mover la cámara** — solo añaden geometría al scene.

### Beat detection
Algoritmo van den Berg en `audio-engine.js`: compara energía instantánea de bajos (bins 3-10, ~43-215 Hz) contra la media histórica del último segundo. Cooldown de 200ms entre beats. `isBeat` llega a `onBeat()` en visualizer, que llama a `scene.onBeat()` y `object.onBeat()`.

### Audio reactivo
`bassEnergy`, `midsEnergy`, `highsEnergy` están suavizados con alpha=0.15 (exponential smoothing) en `audio-reactive.js`. Usar estos valores para animaciones continuas; usar `_beatFlash` (decae con `Math.pow(0.82, delta*60)`) para pulsos de beat.

### Curvas en Outrun
La escena Outrun curva la carretera sin mover la cámara: cada segmento recibe un offset X proporcional a su profundidad. `t = (NEAR_Z - seg.z) / (NEAR_Z - FAR_Z)` donde t=0 es cerca (sin offset) y t=1 es el horizonte (offset máximo = curveDrift). Mismo cálculo para árboles y coches.

### Versión
`VERSION` en `js/config.js`. Incrementar antes de cada despliegue para confirmar qué código está activo (visible en el footer).

## Problemas iOS conocidos y sus fixes

| Problema | Causa | Fix aplicado |
|---|---|---|
| Sin audio | `AudioContext` creado tras un `await` (fuera del gesto) | `audioEngine.init()` se llama síncronamente antes del primer `await` en `selectSong()` |
| Audio silenciado por el switch físico | Web Audio usa canal ringer, no canal media | `_unlockMediaChannel()` reproduce un `<audio>` HTML silencioso en loop dentro del gesto de play |
| Audio se corta al volver de background | iOS suspende `AudioContext` al backgroundear | Listener `visibilitychange` llama `audioEngine.resume()` al volver |

## PWA / pantalla completa

- `manifest.json` con `"display": "standalone"` → al añadir a pantalla de inicio en iOS/Android, abre sin barra de URL
- Botón `⛶` flotante en esquina superior derecha → usa Fullscreen API (iOS 16.4+, Android, Desktop); se oculta si el API no está disponible
- `apple-mobile-web-app-capable` + `viewport-fit=cover` para eliminar barras en Safari

## Archivos de configuración de canciones actuales

| ID | Escena | Notas |
|---|---|---|
| `abduccion` | `city` | LEDs reactivos al beat |
| `energia` | `jungle` | |
| `tontos` | `apocalypse` | |
| `sarten` | `outrun` | Carretera con curvas y coches |
