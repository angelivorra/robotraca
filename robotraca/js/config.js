export const VERSION = '1.9';

// Código de tu cuenta de GoatCounter (el "xxx" de xxx.goatcounter.com) para el
// contador privado de reproducciones. Vacío = contador desactivado.
export const GOATCOUNTER_CODE = 'robotraca';

// Fondos disponibles: cada vez que se abre una canción se elige uno al azar.
const BACKGROUNDS = [
    'city', 'outrun', 'jungle', 'apocalypse', 'tunnel', 'space',
    'neon', 'megacity', 'synthgrid', 'matrix', 'vaporwave',
    'warp', 'circuit', 'crtwall', 'rings', 'cubes', 'club', 'doom',
];

export const SONGS = [
    {
        id:       'abduccion',
        title:    'ABDUCCION',
        duration: '1:18',
        audio:     'songs/abduccion/audio.mp3',
        subtitles: 'songs/abduccion/subtitles.srt',
        coverArt:  'img/abduccion.png',
        background: null,

        scenes:  BACKGROUNDS,
        objects: ['songs/abduccion/model.glb'],

        theme: {
            bgColor:        '#050010',
            primaryColor:   '#e94560',
            secondaryColor: '#16c79a',
            modelBaseScale: 1,
            cameraDistance: 5,
            modelEmissive:  false,
            modelPosition:  [0, 1.3, 0],
        }
    },
    {
        id:       'energia',
        title:    'ME QUEDO SIN ENERGIA',
        duration: '1:44',
        audio:     'songs/energia/audio.mp3',
        subtitles: 'songs/energia/subtitles.srt',
        coverArt:  'img/energia.png',
        background: null,

        scenes:  BACKGROUNDS,
        objects: ['songs/energia/model.glb'],

        theme: {
            bgColor:        '#000a1a',
            primaryColor:   '#ff8c00',
            secondaryColor: '#ffe000',
            modelBaseScale: 1.0,
            cameraDistance: 5,
            modelEmissive:  false,
            modelPosition:  [0, 1.6, 0],            
        }
    },
    {
        id:       'tontos',
        title:    'TONTOS',
        duration: '1:37',
        audio:     'songs/tontos/audio.mp3',
        subtitles: 'songs/tontos/subtitles.srt',
        coverArt:  'img/tontos.png',
        background: null,

        scenes:  BACKGROUNDS,
        objects: ['songs/tontos/model.glb'],

        theme: {
            bgColor:        '#001a05',
            primaryColor:   '#ffd700',
            secondaryColor: '#9b59b6',
            modelBaseScale: 1.0,
            cameraDistance: 5,
            modelPosition:  [0, 1.6, 0],
            modelEmissive:  false,
        }
    },
    {
        id:       'sarten',
        title:    'SARTENAZOS DE PLUTON',
        duration: '2:04',
        audio:     'songs/sarten/audio.mp3',
        subtitles: 'songs/sarten/subtitles.srt',
        coverArt:  'img/sarten.png',
        background: null,

        scenes:  BACKGROUNDS,
        objects: ['songs/sarten/model.glb'],

        theme: {
            bgColor:        '#1a0500',
            primaryColor:   '#ff4500',
            secondaryColor: '#00d4ff',
            modelBaseScale: 1.3,
            cameraDistance: 5,
            modelEmissive:  false,
            modelPosition:  [0, 1.6, 0],
        }
    },
    {
        id:       'atodoquesi',
        title:    'ATODOQUESI',
        duration: '1:08',
        audio:     'songs/atodoquesi/audio.mp3?v=2',
        subtitles: 'songs/atodoquesi/subtitles.srt',
        coverArt:  null,
        background: null,

        scenes:  BACKGROUNDS,
        objects: ['songs/abduccion/model.glb'],

        theme: {
            bgColor:        '#0a0500',
            primaryColor:   '#ffcc00',
            secondaryColor: '#ff4500',
            modelBaseScale: 1.0,
            cameraDistance: 5,
            modelEmissive:  false,
            modelPosition:  [0, 1.3, 0],
        }
    }
];
