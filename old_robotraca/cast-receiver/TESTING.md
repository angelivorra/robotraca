# Instrucciones para probar el Cast Receiver localmente

## Opción 1: Prueba Visual Directa (Sin Chromecast)

La forma más rápida de ver cómo se ve:

```bash
cd /home/angel/robotraca/robotraca/cast-receiver
python3 -m http.server 8081
```

Luego abre en tu navegador:
```
http://localhost:8081
```

Verás la interfaz completa con:
- ✅ Fondo animado estilo Tron
- ✅ Título "ROBOTRACA" con efecto neón
- ✅ Robot con ojos girando
- ✅ Visualizador retro-futurista
- ✅ Área de nombre de canción

**Limitación**: No recibirá datos reales de Cast, pero verás el diseño completo.

---

## Opción 2: Probar con Chromecast Real (Requiere HTTPS)

### Paso 1: Hacer accesible tu servidor con HTTPS

**A) Usar ngrok (Más fácil)**

1. Instala ngrok: https://ngrok.com/download
2. Ejecuta tu servidor local:
   ```bash
   cd /home/angel/robotraca/robotraca
   python3 -m http.server 8080
   ```
3. En otra terminal, inicia ngrok:
   ```bash
   ngrok http 8080
   ```
4. Copia la URL HTTPS que te da (ej: `https://abc123.ngrok.io`)

**B) Usar Serveo (Alternativa gratuita)**

```bash
ssh -R 80:localhost:8080 serveo.net
```

Te dará una URL pública HTTPS.

### Paso 2: Registrar en Google Cast Developer Console

1. Ve a: https://cast.google.com/publish/
2. Inicia sesión con tu cuenta de Google
3. Click "Add New Application"
4. Selecciona "Custom Receiver"
5. Configura:
   - **Name**: Robotraca Player
   - **Receiver Application URL**: `https://TU_URL_NGROK/cast-receiver/index.html`
   - **Category**: Music/Audio
6. Guarda y copia el **Application ID** (ej: `12345ABC`)

### Paso 3: Actualizar el código

En `/home/angel/robotraca/robotraca/js/chromecast.js`, línea 15:

```javascript
// Reemplaza esto:
const CUSTOM_RECEIVER_APP_ID = chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID;

// Por tu Application ID:
const CUSTOM_RECEIVER_APP_ID = '12345ABC'; // Tu ID aquí
```

### Paso 4: Probar

1. Abre tu app en Chrome: `http://localhost:8080`
2. Click en el botón de Cast
3. Selecciona tu dispositivo
4. ¡Debería aparecer tu visualización personalizada en la TV!

---

## Opción 3: Usar el simulador de Chrome (Para desarrollo)

1. Abre Chrome DevTools (F12)
2. Ve a la pestaña "Console"
3. Simula la recepción de datos:

```javascript
// En la consola del cast-receiver (http://localhost:8081)
updateSongName('Sartenazos desde Plutón');
isPlaying = true;
```

---

## Opción 4: GitHub Pages (Producción)

### Configurar GitHub Pages:

1. Sube todo a GitHub
2. Ve a Settings → Pages
3. Selecciona la rama main
4. Guarda

Tu receiver estará en:
```
https://TU_USUARIO.github.io/robotraca/cast-receiver/
```

### Ventajas:
- ✅ HTTPS automático (requisito de Cast)
- ✅ Gratis
- ✅ CDN global
- ✅ No requiere servidor

### Registrar en Cast Console:
Usa la URL: `https://TU_USUARIO.github.io/robotraca/cast-receiver/index.html`

---

## Verificar que todo funciona

### Checklist:

- [ ] El fondo se anima (grid moviéndose)
- [ ] "ROBOTRACA" brilla con efecto neón
- [ ] Los ojos del robot giran continuamente
- [ ] Las barras del visualizador se mueven
- [ ] El área de canción está visible en la parte inferior

### Debug común:

**Si no ves las imágenes:**
```bash
# Verifica que las imágenes estén en su lugar:
ls -la cast-receiver/images/robot/
```

**Si la fuente no carga:**
```bash
# Verifica que la fuente esté:
ls -la cast-receiver/css/fuente.ttf
```

**Si el Cast no funciona:**
- ✅ ¿Estás usando HTTPS?
- ✅ ¿El Application ID está correcto?
- ✅ ¿El Chromecast está en la misma red?

---

## Próximo paso recomendado:

**Para prueba rápida ahora mismo:**

```bash
# Terminal 1: Servidor principal
cd /home/angel/robotraca/robotraca
python3 -m http.server 8080

# Terminal 2: Servidor del receiver (para probar diseño)
cd /home/angel/robotraca/robotraca/cast-receiver
python3 -m http.server 8081
```

Abre:
- App principal: http://localhost:8080
- Visualización: http://localhost:8081

¿Quieres que subamos esto a GitHub Pages para tener el Cast funcionando con Chromecast real?
