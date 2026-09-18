import assert from 'node:assert/strict';
import {residenceProgress,residenceTier} from '../server/residence.js';
const day=86400000;
for(const n of [7,30,90]){assert.equal(residenceTier(n*day),n);assert.notEqual(residenceTier(n*day-1),n);}
assert.equal(residenceProgress({verified_ms:day,checked_at:1000,eligible:true},61000,true),day+60000);
assert.equal(residenceProgress({verified_ms:day,checked_at:1000,eligible:true},61000,false),0);
assert.equal(residenceProgress({verified_ms:day,checked_at:1000,eligible:true},181001,true),day);
assert.equal(residenceProgress({verified_ms:day,checked_at:1000,eligible:false},61000,true),day);
assert.equal(residenceProgress({verified_ms:0,checked_at:0,eligible:false},Date.now(),true),0);
console.log('PASS residence: exact milestones, reset below threshold, no backdating, no outage credit');
