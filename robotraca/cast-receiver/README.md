# Custom Receiver - Visualización Chromecast para Robotraca

Esta carpeta contiene la aplicación Custom Receiver que se mostrará en la TV cuando hagas cast desde el reproductor.

## Estructura

```
cast-receiver/
├── index.html          # Página principal del receiver (visualización TV)
├── css/
│   └── styles.css      # Estilos para la visualización
├── js/
│   └── receiver.js     # Lógica del Cast Receiver
└── README.md           # Este archivo
```

## Pasos para configurar

### 1. Crear la visualización (próximo paso)
Vamos a crear una interfaz personalizada que se mostrará en la TV con:
- Logo/nombre de Robotraca
- Nombre de la canción actual
- Visualizador de audio animado
- Efectos visuales

### 2. Registrar en Google Cast Developer Console
Para usar un Custom Receiver, necesitas:

1. Ir a: https://cast.google.com/publish/
2. Iniciar sesión con tu cuenta de Google
3. Click en "Add New Application"
4. Seleccionar "Custom Receiver"
5. Configurar:
   - **Name**: Robotraca Player
   - **Receiver Application URL**: `http://TU_DOMINIO/cast-receiver/index.html`
   - **Category**: Music/Audio
6. Guardar y copiar el **Application ID** (ejemplo: `12345ABC`)

### 3. Actualizar el código
En `/js/chromecast.js`, reemplazar:
```javascript
const CUSTOM_RECEIVER_APP_ID = 'TU_APP_ID_AQUI';
```

### 4. Publicar el receiver
El archivo `index.html` debe ser accesible públicamente vía HTTPS. Opciones:
- Subir a GitHub Pages
- Usar un servidor propio con SSL
- Usar servicios como Netlify, Vercel, etc.

## Desarrollo local

Para probar localmente necesitas:
1. Servir con HTTPS (Chromecast requiere SSL)
2. Usar ngrok o similar para hacer tu localhost accesible
3. O configurar un certificado SSL autofirmado

## Próximo paso

Vamos a crear la visualización personalizada en esta carpeta.
