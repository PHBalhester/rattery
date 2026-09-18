export const ENCOUNTER_SECONDS=16;
const smooth=(a:number,b:number,t:number)=>(()=>{const v=Math.max(0,Math.min(1,(t-a)/(b-a)));return v*v*(3-2*v);})();
export function encounterPose(seconds:number){
 const t=Math.max(0,Math.min(ENCOUNTER_SECONDS,seconds));
 const lift=smooth(3,5,t)*(1-smooth(10,12,t));
 // Keep horizontal clearance until the head is above the partner's back.
 const close=smooth(4.5,6,t)*(1-smooth(9,10.5,t));
 const approach=smooth(0,3,t),depart=smooth(12,16,t);
 return {lift,close,x:-1.45+approach*.12+close*.66-depart*.12,
  z:.20*(1-approach)+depart*.20,y:lift*.29,pitch:lift*.42,
  frontHeight:lift*.55,rhythm:smooth(6,6.7,t)*(1-smooth(8.3,9,t))*Math.sin((t-6)*Math.PI*2*1.2),phase:t<3?'Approach':t<6?'Align & mount':t<9?'Mating':t<12?'Dismount':'Separation'};
}
