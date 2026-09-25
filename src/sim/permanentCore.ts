import type {Rat,World} from '../types.js';

/** Explicit operator-selected residents. No replacement identities or expiry. */
export const isCoreResident=(w:World,r:Rat)=>w.permanentCore?.ratIds.includes(r.id)??false;

/** Individual care only: market resources and other residents remain unchanged. */
export function assistPermanentCore(w:World){
 for(const id of w.permanentCore?.ratIds??[]){
  const r=w.rats[id];if(!r||r.deadAt!==null)continue;
  r.energy=Math.max(.9,r.energy);r.heat=Math.max(.8,r.heat);r.injury=0;
  r.hormones.cort=Math.min(.2,r.hormones.cort);
  if(r.wellbeing){
   r.wellbeing.hydration=Math.max(.9,r.wellbeing.hydration);
   r.wellbeing.lastWater=w.simDay;
   r.wellbeing.acute=Math.min(.2,r.wellbeing.acute);
   r.wellbeing.chronic=Math.min(.2,r.wellbeing.chronic);
   r.wellbeing.isolationDays=0;r.wellbeing.isolationDistress=0;
  }
 }
}
