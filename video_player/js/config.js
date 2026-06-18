export const SONGS = [
    {
        id:       'abduccion',
        title:    'ESTO ES UNA ABDUCCION',
        duration: '1:18',
        audio:     'songs/abduccion/audio.mp3',
        subtitles: 'songs/abduccion/subtitles.srt',
        coverArt:  'img/abduccion.png',
        background: null,

        scenes:  ['tunnel'],
        objects: ['songs/abduccion/model.glb'],

        theme: {
            bgColor:        '#050010',
            primaryColor:   '#e94560',
            secondaryColor: '#16c79a',
            modelBaseScale: 1.0,
            cameraDistance: 5,
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

        scenes:  ['tunnel', 'city', 'space'],
        objects: ['songs/energia/model.glb', 'icosahedron'],

        theme: {
            bgColor:        '#000a1a',
            primaryColor:   '#ff8c00',
            secondaryColor: '#ffe000',
            modelBaseScale: 1.0,
            cameraDistance: 5,
        }
    },
    {
        id:       'tontos',
        title:    'QUE TONTOS SON',
        duration: '1:37',
        audio:     'songs/tontos/audio.mp3',
        subtitles: 'songs/tontos/subtitles.srt',
        coverArt:  'img/tontos.png',
        background: null,

        scenes:  ['city', 'space', 'tunnel'],
        objects: ['songs/tontos/model.glb', 'torus-knot'],

        theme: {
            bgColor:        '#001a05',
            primaryColor:   '#ffd700',
            secondaryColor: '#9b59b6',
            modelBaseScale: 1.0,
            cameraDistance: 5,
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

        scenes:  ['city', 'tunnel'],
        objects: ['songs/sarten/model.glb', 'icosahedron', 'torus-knot'],

        theme: {
            bgColor:        '#1a0500',
            primaryColor:   '#ff4500',
            secondaryColor: '#00d4ff',
            modelBaseScale: 1.0,
            cameraDistance: 5,
        }
    }
];
