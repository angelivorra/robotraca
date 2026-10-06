import { GOATCOUNTER_CODE } from './config.js';

// Contador privado de reproducciones (GoatCounter). Una reproducción cuenta
// cuando la canción lleva MIN_LISTEN_MS sonando en acumulado; solo se cuenta
// una vez por apertura de canción. Sin código configurado, o en localhost,
// no envía nada.
const MIN_LISTEN_MS = 10_000;

const enabled = !!GOATCOUNTER_CODE
    && !['localhost', '127.0.0.1', ''].includes(location.hostname);

export class PlayCounter {
    constructor(songId, title) {
        this._id       = songId;
        this._title    = title;
        this._listened = 0;     // ms acumulados
        this._since    = 0;     // instante en que empezó el tramo actual
        this._timer    = null;
        this._counted  = false;
    }

    start() {
        if (this._counted || this._timer) return;
        this._since = performance.now();
        this._timer = setTimeout(() => this._count(), MIN_LISTEN_MS - this._listened);
    }

    pause() {
        if (!this._timer) return;
        clearTimeout(this._timer);
        this._timer = null;
        this._listened += performance.now() - this._since;
    }

    _count() {
        this._timer   = null;
        this._counted = true;
        if (!enabled) return;
        const q = new URLSearchParams({
            p: `/play/${this._id}`,
            t: `Play: ${this._title}`,
            e: 'true',
        });
        // Pixel API de GoatCounter: una petición de imagen, sin cookies.
        new Image().src = `https://${GOATCOUNTER_CODE}.goatcounter.com/count?${q}`;
    }
}
