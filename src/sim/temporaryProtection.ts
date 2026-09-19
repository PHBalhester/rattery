import type {World} from '../types.js';
/** Explicit temporary operator assistance, not a change to alert thresholds. */
export function assistColony(w:World){
 w.env.food=Math.max(.95,w.env.food);w.env.water=Math.max(.95,w.env.water??0);
 w.env.warmth=.65;w.env.stress=Math.min(.1,w.env.stress);w.env.panic=0;
 for(const r of Object.values(w.rats))if(r.deadAt===null){
  r.energy=Math.max(.9,r.energy);r.heat=Math.max(.8,r.heat);r.injury=0;
  r.hormones.cort=Math.min(.2,r.hormones.cort);
  if(r.wellbeing){r.wellbeing.hydration=Math.max(.9,r.wellbeing.hydration);r.wellbeing.acute=Math.min(.2,r.wellbeing.acute);r.wellbeing.chronic=Math.min(.2,r.wellbeing.chronic);r.wellbeing.isolationDays=0;r.wellbeing.isolationDistress=0;}
 }
}
