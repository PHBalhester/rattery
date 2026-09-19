import assert from 'node:assert/strict';
import {createWorld} from '../src/sim/colony';
import {snakeStep,snakeEligible,SNAKE_DEN} from '../src/sim/snake';
import {applyCare,careState} from '../src/sim/care';
const w=createWorld(),base=Object.values(w.rats)[0];w.rats={};
for(let i=0;i<70;i++){const r=structuredClone(base);r.id='snake-test-'+i;r.sex=i%2?'F':'M';r.stage='adult';r.deadAt=null;r.pregnant=null;r.nursing=[];r.socialAction=undefined;r.retrieving=null;r.x=SNAKE_DEN.x+30;r.y=SNAKE_DEN.y;w.rats[r.id]=r;}
w.snake={nextAttack:0};const r=Object.values(w.rats)[0];r.minted=true;assert(!snakeEligible(w,r));r.minted=false;r.nursing=['baby'];assert(!snakeEligible(w,r));r.nursing=[];
w.care=careState();w.care.owners[r.id]='0x'+'1'.repeat(40);assert(!snakeEligible(w,r));
w.careProtection={until:999999,active:true};snakeStep(w,.01,()=>0);assert(!w.snake.capture);w.careProtection.active=false;
const event={sequence:1,ratId:r.id,wallet:'0x'+'2'.repeat(40),action:'snake' as const,timestamp:1000,amount:500000};applyCare(w,w.care,event);assert.equal(w.care.burned,500000);assert.throws(()=>applyCare(w,w.care,event));
snakeStep(w,.01,()=>0);assert(w.snake.capture);assert.notEqual(w.snake.capture.ratId,r.id);const victim=w.snake.capture.ratId;
const replay=structuredClone(w);w.simDay+=.11;replay.simDay+=.11;snakeStep(w,.01,()=>0);snakeStep(replay,.01,()=>0);assert.deepEqual(w,replay);assert.equal(w.memorial![victim].deathCause,'predation');assert.equal(Object.values(w.rats).filter(r=>r.deadAt===null).length,69);
w.rats=Object.fromEntries(Object.entries(w.rats).filter(([,r])=>r.deadAt===null).slice(0,60));assert(!snakeEligible(w,Object.values(w.rats)[1]));
console.log('PASS snake: minted/parent/assistance/population protection, burn, replay rejection, capture, memorial, deterministic replay');
