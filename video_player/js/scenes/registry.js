import { TunnelScene } from './tunnel.js';
import { SpaceScene }  from './space.js';
import { CityScene }   from './city.js';

const REGISTRY = {
    tunnel: TunnelScene,
    space:  SpaceScene,
    city:   CityScene,
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
