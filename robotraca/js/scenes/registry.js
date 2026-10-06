import { TunnelScene }      from './tunnel.js';
import { SpaceScene }       from './space.js';
import { CityScene }        from './city.js';
import { DoomScene }        from './doom.js';
import { ApocalypseScene }  from './apocalypse.js';
import { JungleScene }      from './jungle.js';
import { OutrunScene }      from './outrun.js';
import { NeonScene }        from './neon.js';
import { MegacityScene }    from './megacity.js';
import { SynthGridScene }   from './synthgrid.js';
import { MatrixScene }      from './matrix.js';
import { ClubScene } from './club.js';
import { CubesScene } from './cubes.js';
import { RingsScene } from './rings.js';
import { CrtWallScene } from './crtwall.js';
import { CircuitScene } from './circuit.js';
import { WarpScene } from './warp.js';
import { VaporwaveScene } from './vaporwave.js';

const REGISTRY = {
    tunnel:     TunnelScene,
    space:      SpaceScene,
    city:       CityScene,
    doom:       DoomScene,
    apocalypse: ApocalypseScene,
    jungle:     JungleScene,
    outrun:     OutrunScene,
    neon:       NeonScene,
    megacity:   MegacityScene,
    synthgrid:  SynthGridScene,
    matrix:     MatrixScene,
    club: ClubScene,
    cubes: CubesScene,
    rings: RingsScene,
    crtwall: CrtWallScene,
    circuit: CircuitScene,
    warp: WarpScene,
    vaporwave: VaporwaveScene,
};

export function createScene(name) {
    const Cls = REGISTRY[name];
    if (!Cls) {
        console.warn(`Unknown scene "${name}", falling back to space.`);
        return new SpaceScene();
    }
    return new Cls();
}

export function pickSceneName(names) {
    const valid = names.filter(n => n in REGISTRY);
    if (valid.length === 0) return 'space';
    return valid[Math.floor(Math.random() * valid.length)];
}
