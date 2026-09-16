import assert from 'node:assert/strict';
import {crowding} from '../src/sim/crowding';
assert.equal(crowding(0,.9).stress,0);
assert(Math.abs(crowding(40,.2).stress-.2)<1e-12);
let last=0;for(let n=0;n<=160;n++){const c=crowding(n,.2);assert(c.stress>=last-1e-12&&c.stress<=1);last=c.stress;}
assert(crowding(80,0).stress>=.95);assert(crowding(100,.2).occupancy>1);
assert(crowding(40,.2).stress<crowding(80,.2).stress);
console.log('PASS: empty colony, onset, monotonic stress, critical load, overflow, recovery');
