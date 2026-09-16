import type {Rat,World} from '../types';
import {physique} from './physique';
/** Simulation units per 100ms tick. Cosmetic seed does not consume biological RNG. */
export function movementSpeed(r:Rat,w:World){
 const energy=Math.max(.4,Math.min(1,r.energy/.55));
 const injury=1-Math.min(.65,Math.max(0,r.injury??0)*.7);
 const maturity=r.stage==='weanling'?.8:1;
 const pace=2.6*(.95+(physique(r.id)-.88)/.24*.1);
 return pace*energy*injury*maturity*(r.pregnant?.85:1)*(1+Math.min(.5,w.env.forage*.35+w.env.panic*.5));
}
