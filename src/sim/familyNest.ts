import type {Rat} from '../types.js';
export const CENTRAL_NEST={x:800,y:520,r:70,zone:0};
export const familyNest=(r:Rat)=>r.maternalNest??CENTRAL_NEST;
