import {CONFIG} from '../config';
// Cosmetic identity only. Never consumes the biological RNG.
export function identity(id:string){let h=2166136261;for(const c of `${CONFIG.colony.seed}:${id}`){h=Math.imul(h^c.charCodeAt(0),16777619);}h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;return h>>>0;}
export const COAT_BUCKETS=10000;
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
// Each legendary occupies 1/10,000 buckets. Four solid fantasy coats share 12%.
export function coatAtBucket(roll:number){
 const n=((Math.floor(roll)%COAT_BUCKETS)+COAT_BUCKETS)%COAT_BUCKETS;
 return coats[n<3?n:n<1203?3+Math.floor((n-3)/300):n<2600?7:n<4200?8:n<6200?9:n<8200?10:11];
}
export function coatFor(id:string){const hash=identity(id);return {...coatAtBucket(hash%COAT_BUCKETS),key:(hash>>>16)%8};}
