# Reproductor Cassette Mobile

Reproductor de cassette completamente responsive diseñado para móviles con gráficos SVG.

## Características

✅ **Solo móvil**: Interfaz optimizada exclusivamente para dispositivos móviles
✅ **Gráficos SVG**: Todos los elementos visuales son SVG para máxima calidad
✅ **Totalmente responsive**: Se adapta a cualquier tamaño de pantalla móvil
✅ **Carretes animados**: Los carretes giran cuando se reproduce música
✅ **Nombre de canción**: Muestra el nombre de la canción actual en el cassette
✅ **Controles completos**: Play/Pause, Stop, Anterior, Siguiente
✅ **Autoplay con parámetro GET**: Solo se reproduce automáticamente con `?autoplay`

## Archivos

- `player-mobile.html` - Página principal del reproductor
- `css/cassette-player.css` - Estilos del reproductor
- `js/cassette-player.js` - Lógica del reproductor

## Configuración de Canciones

Las canciones se definen en `js/cassette-player.js`:

```javascript
const songs = [
    {
        path: 'audio/track1.mp3',
        name: 'Sartenazos desde Plutón'
    },
    {
        path: 'audio/track2.mp3',
        name: 'Gobierno de la IA'
    }
];
```

### Agregar más canciones

Simplemente añade más objetos al array:

```javascript
const songs = [
    {
        path: 'audio/track1.mp3',
        name: 'Nombre de la canción 1'
    },
    {
        path: 'audio/track2.mp3',
        name: 'Nombre de la canción 2'
    },
    {
        path: 'audio/track3.mp3',
        name: 'Nombre de la canción 3'
    }
];
```

## Uso

### Acceso normal
```
https://tu-dominio.com/player-mobile.html
```
El usuario debe hacer clic en Play para iniciar.

### Con autoplay (para QR)
```
https://tu-dominio.com/player-mobile.html?autoplay
```
o
```
https://tu-dominio.com/player-mobile.html?play
```
La música se reproducirá automáticamente al cargar.

## Componentes del Cassette

### 1. Fondo del cassette
- SVG con el cuerpo principal del cassette
- Color oscuro (#1a1a1a - #2a2a2a)
- Ventanas circulares para los carretes

### 2. Carretes
- SVG independientes que rotan
- Animación activada durante la reproducción
- Dientes del carrete visibles

### 3. Frente del cassette
- SVG con la etiqueta superior
- Muestra el nombre de la canción actual
- Detalles decorativos (tornillos)

## Características Responsive

- **Portrait**: Diseño vertical con cassette arriba y controles abajo
- **Landscape**: Diseño horizontal con cassette a la izquierda y controles a la derecha
- **Pantallas pequeñas**: Ajusta automáticamente el tamaño de botones y textos
- **Safe areas**: Respeta las áreas seguras en dispositivos con notch

## Controles

- **Play/Pause**: Inicia o pausa la reproducción
- **Stop**: Detiene y reinicia la canción
- **Anterior**: Va a la canción anterior (circular)
- **Siguiente**: Va a la siguiente canción (circular)

## Compatibilidad

- iOS Safari 12+
- Chrome Mobile 80+
- Firefox Mobile 80+
- Samsung Internet 12+

## Notas

- Los carretes solo giran cuando hay reproducción activa
- El nombre de la canción se actualiza automáticamente al cambiar
- El autoplay puede fallar en algunos navegadores por políticas de seguridad
- Todos los gráficos son escalables sin pérdida de calidad (SVG)
