import {CONFIG} from '../config.js';
// Cosmetic identity only. Never consumes the biological RNG.
export function identity(id:string){let h=2166136261;for(const c of `${CONFIG.colony.seed}:${id}`){h=Math.imul(h^c.charCodeAt(0),16777619);}h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;return h>>>0;}
export const COAT_BUCKETS=10000;
// Operator-created special identity, outside the natural birth lottery.
export const DIAMOND_COAT=10000;
export const diamondCoat={name:'Diamond aurora',rarity:'Legendary',color:'#773cc9',belly:'#d6faff',accent:'#42e8d2',pattern:'lightning'} as const;
export const coats=[
 {name:'Solar gold',rarity:'Legendary',color:'#d8a92f',belly:'#fff0a1',pattern:'solid'},
 {name:'Sunfire freckles',rarity:'Legendary',color:'#f4cb39',belly:'#f4e5ad',accent:'#d53242',pattern:'dots'},
 {name:'Electric storm',rarity:'Legendary',color:'#2461b7',belly:'#b6d4eb',accent:'#80ef66',pattern:'lightning'},
 {name:'Jade',rarity:'Rare',color:'#58a878',belly:'#c1dfb8',pattern:'solid'},
 {name:'Azure',rarity:'Rare',color:'#538fc4',belly:'#c4dcf1',pattern:'solid'},
 {name:'Orchid',rarity:'Rare',color:'#9c71bf',belly:'#e0c5ec',pattern:'solid'},
 {name:'Rose',rarity:'Rare',color:'#d585a5',belly:'#f1d6df',pattern:'solid'},
 {name:'Hooded ivory',rarity:'Uncommon',color:'#3c3533',belly:'#e5ddcc',pattern:'hooded'},
 {name:'Cocoa pied',rarity:'Uncommon',color:'#68503e',belly:'#e2d3b9',pattern:'patches'},
 {name:'Silver',rarity:'Common',color:'#909594',belly:'#d9d9cf',pattern:'solid'},
 {name:'Warm agouti',rarity:'Common',color:'#756451',belly:'#cbb997',pattern:'solid'},
 {name:'Sable',rarity:'Common',color:'#423e39',belly:'#a0927d',pattern:'solid'},
] as const;
// Each legendary occupies 2/10,000 buckets (0.06% combined). Existing legendary buckets stay unchanged.
// Extra buckets come from Sable; the four solid fantasy coats still share 12%.
export function coatAtBucket(roll:number){
 if(roll===DIAMOND_COAT)return diamondCoat;
 const n=((Math.floor(roll)%COAT_BUCKETS)+COAT_BUCKETS)%COAT_BUCKETS;
 if(n>=9997)return coats[n-9997];
 return coats[n<3?n:n<1203?3+Math.floor((n-3)/300):n<2600?7:n<4200?8:n<6200?9:n<8200?10:11];
}
export function coatFor(id:string,bucket?:number){const hash=identity(id);return {...coatAtBucket(bucket??hash%COAT_BUCKETS),key:(hash>>>16)%8};}

export function birthCoat(world:import('../types.js').World,id:string){
 const base=identity(id)%COAT_BUCKETS,boost=world.legendaryBoost;
 if(!boost||boost.claimedBy||world.simDay>=boost.untilSimDay)return base;
 const roll=identity('legendary-trial:'+id)%COAT_BUCKETS;
 const bucket=roll<500?identity('legendary-color:'+id)%3:base;
 if(coatAtBucket(bucket).rarity==='Legendary')boost.claimedBy=id;
 return bucket;
}
