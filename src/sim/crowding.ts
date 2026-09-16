import {CONFIG} from '../config';
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
/** Gameplay curve, not a biological threshold. No cumulative feedback into market stress. */
export function crowding(alive:number,marketStress:number){
 const occupancy=Math.max(0,alive)/CONFIG.colony.maxAlive;
 const pressure=clamp((occupancy-.5)/.5);
 const stress=alive>0?clamp(1-(1-clamp(marketStress))*(1-.95*pressure*pressure)):0;
 return {occupancy,pressure,stress};
}
