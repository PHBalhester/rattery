import {CONFIG} from '../config';
/** Stable per individual, independent of biological RNG and frame rate. */
export function physique(id:string){let h=2166136261;for(const c of `${CONFIG.colony.seed}:size:${id}`)h=Math.imul(h^c.charCodeAt(0),16777619);h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);h^=h>>>16;return .88+((h>>>0)/4294967295)*.24;}
