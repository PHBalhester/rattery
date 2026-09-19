import assert from 'node:assert/strict';
import {createWorld} from '../src/sim/colony';
import {birthCoat,coatAtBucket,identity,COAT_BUCKETS} from '../src/sim/ratIdentity';
const w=createWorld();w.legendaryBoost={untilSimDay:10};
let winner='';for(let i=0;i<10000;i++){const id='trial'+i,b=birthCoat(w,id);if(coatAtBucket(b).rarity==='Legendary'){winner=id;break;}}
assert(winner);assert.equal(w.legendaryBoost.claimedBy,winner);
for(let i=0;i<100;i++)assert.equal(birthCoat(w,'later'+i),identity('later'+i)%COAT_BUCKETS);
w.legendaryBoost={untilSimDay:w.simDay};assert.equal(birthCoat(w,'expired'),identity('expired')%COAT_BUCKETS);
let legends=0;for(let i=0;i<10000;i++){w.legendaryBoost={untilSimDay:10};if(coatAtBucket(birthCoat(w,'sample'+i)).rarity==='Legendary')legends++;}
assert(legends>400&&legends<600);console.log('PASS first-winner stop, expiration, normal fallback, sample boosted rate',legends/100+'%');

assert.equal(coatAtBucket(10000).name,'Diamond aurora');
assert.equal(Array.from({length:10000},(_,i)=>coatAtBucket(i)).filter(c=>c.rarity==='Legendary').length,6);
console.log('PASS special diamond identity does not change natural legendary odds');
