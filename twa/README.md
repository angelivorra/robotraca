# ROBOTRACA — App Android (TWA) para Google Play

Esto empaqueta la web (PWA) como una app Android nativa usando **TWA (Trusted Web Activity)** vía **Bubblewrap**. La app es una cáscara que carga en vivo `https://angelivorra.github.io/robotraca/robotraca/` — **no hay que resubir la app cuando cambias la web**, solo cuando cambias algo nativo (icono, package, versión, targetSdk).

## Datos clave

| Dato | Valor |
|---|---|
| Package name (applicationId) | `io.github.angelivorra.robotraca` **(permanente)** |
| URL de lanzamiento | `https://angelivorra.github.io/robotraca/robotraca/` |
| Keystore (upload key) | `twa/robotraca-upload.keystore` (alias `robotraca`) |
| Password del keystore | ver `twa/KEYSTORE-INFO.txt` — **guárdala en un gestor de contraseñas** |
| SHA-256 upload key | `CF:7E:01:72:05:18:19:D8:AD:A0:61:88:5B:15:32:FF:E4:57:02:7A:CE:C9:6F:C2:FE:84:2B:78:21:08:12:13` |

## Reconstruir el .aab

Bubblewrap está instalado en el scratchpad de la sesión; para un entorno permanente:

```bash
npm install -g @bubblewrap/cli
cd twa
bubblewrap build   # genera app-release-bundle.aab (y app-release-signed.apk)
```

Las passwords se piden por consola o se pasan por entorno:
`BUBBLEWRAP_KEYSTORE_PASSWORD` y `BUBBLEWRAP_KEY_PASSWORD`.

Para subir versión nueva, incrementa `appVersionCode` (y `appVersionName`) en
`twa-manifest.json`, luego `bubblewrap update && bubblewrap build`.

## Subida a Google Play (primera vez)

1. **Play Console** → crea la app → sube `app-release-bundle.aab` a un track
   (empieza por *Internal testing*).
2. Al subir, Google activa **Play App Signing**: re-firma la app con su propia
   clave. En **Configuración → Integridad de la app → App signing** copia el
   **SHA-256 del "App signing key certificate"**.
3. Añade ESE SHA-256 al `assetlinks.json` (junto al del upload key) y vuelve a
   desplegar el repo `angelivorra.github.io`. Sin este paso la app mostrará la
   barra de URL del navegador. Ver `../site-root/.well-known/assetlinks.json`.
4. Verifica: `https://angelivorra.github.io/.well-known/assetlinks.json` debe
   responder 200 con el JSON.

## ⚠️ Digital Asset Links — doble huella

El `assetlinks.json` debe contener **dos** fingerprints:
- el del **upload key** (ya incluido) → para APKs que firmes tú localmente
- el del **Play app signing key** (lo obtienes tras el paso 2) → para la app
  que Google distribuye a los usuarios

Formato: añade el segundo string al array `sha256_cert_fingerprints`.
