# Robotraca - AI Coding Instructions

## Project Overview

Robotraca is a **retro-style multimedia player** for a children's music project. It consists of two main components:

1. **`video_player/`** - 8-bit SNES-style video player with "Press Start 2P" pixel font aesthetic
2. **`robotraca/`** - Cassette-style player with Chromecast casting capabilities and a custom Cast Receiver

Both are **static HTML/CSS/JS** projects served via Python's http.server or GitHub Pages.

## Architecture

```
robotraca/                    # Cassette player + Chromecast sender
├── js/chromecast.js         # Cast API integration (sender side)
├── js/cassette-player.js    # Main player logic
├── cast-receiver/           # Custom Cast Receiver app (runs on TV)
│   └── js/receiver.js       # Cast SDK receiver with visualizer

video_player/                 # Standalone 8-bit style player
├── js/player.js             # Song selection & video playback
└── css/styles.css           # Retro SNES styling
```

### Key Patterns

- **Song configuration**: Songs are defined in JS arrays with `{id, title, video, image, duration}` structure at the top of player files
- **Screen navigation**: Uses CSS class `.hidden` toggling between screens (`.main-screen` ↔ `.player-screen`)
- **State management**: Simple global variables (`isPlaying`, `currentSongIndex`, `isCasting`)

## Development Workflow

### Local Server

Use VS Code tasks or run manually:
```bash
python -m http.server 8080 --directory .
```
Then access:
- `http://localhost:8080/video_player/` - 8-bit player
- `http://localhost:8080/robotraca/` - Cassette player

### Chromecast Testing

Chromecast requires HTTPS. For local testing:
1. Use ngrok: `ngrok http 8080`
2. Update receiver URL in Google Cast Developer Console
3. The Custom Receiver App ID is `FBEBF31F` (see [chromecast.js#L62](robotraca/js/chromecast.js#L62))

## Code Conventions

### JavaScript

- **Spanish comments** throughout the codebase
- **Section headers** using `// ========== SECTION NAME ==========` pattern
- **Mobile debug logging** via `mobileLog.info()/.error()/.success()` for Chromecast debugging
- **DOM element caching** at file top with `document.getElementById()` references

### CSS

- **CSS variables** in `:root` for theming (see [styles.css#L9-L21](video_player/css/styles.css#L9-L21))
- **Mobile-first** with `env(safe-area-inset-*)` for notch handling
- **Retro effects**: Use `image-rendering: pixelated`, box-shadow pixel borders, text-shadow for glow

### File Naming

- Media assets use descriptive Spanish names: `abduccion.mp4`, `energia.mp4`
- Robot graphics: `cabeza.png`, `ojo_derecho.png`, `ojo_izquierdo.png`

## Integration Points

### Google Cast SDK

- **Sender** (browser): Loads `//www.gstatic.com/cv/js/sender/v1/cast_sender.js`
- **Receiver** (TV): Uses `cast.framework.CastReceiverContext` with custom `mediaElement`
- **Message flow**: `LOAD` requests carry metadata with song title for TV display

### Media Handling

- Videos are MP4 in `videos/` folders
- Background images match video names in `img/` folders
- Fullscreen uses progressive enhancement: `requestFullscreen` → `webkitRequestFullscreen` → `webkitEnterFullscreen` (iOS)

## Common Tasks

| Task | How |
|------|-----|
| Add new song | Edit `SONGS` array in `player.js`, add MP4 to `videos/`, add PNG to `img/` |
| Change colors | Modify CSS variables in `:root` |
| Debug Chromecast | Check `#mobileDebug` panel or receiver's `#debugPanel` |
| Test receiver visually | Open `cast-receiver/index.html` directly (no actual cast needed) |
