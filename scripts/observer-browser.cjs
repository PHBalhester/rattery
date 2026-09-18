const {chromium}=require('./lib/browser-runtime.cjs');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const context=await browser.newContext();await context.addInitScript(()=>localStorage.setItem('rattery:welcome-tour:v1','done'));
 let snapshot=null,offline=false,calls=0;
 await context.route('**/api/observer',async route=>{calls++;if(offline)return route.abort();if(!snapshot)return route.fulfill({status:503,body:'{}'});return route.fulfill({contentType:'application/json',body:JSON.stringify(snapshot)});});
 const pages=await Promise.all([context.newPage(),context.newPage()]);
 await Promise.all(pages.map(p=>p.goto('http://localhost:5191/?view=shared-colony')));
 const world=await pages[0].evaluate(async()=>{const {createWorld}=await import('/src/sim/colony.ts');return createWorld(42)});
 snapshot={protocol:1,colonyId:'rattery-staging-market-v1',paymentsEnabled:false,revision:1,tick:0,at:Date.now(),version:'fixture',world,trades:[],market:null};
 const state=p=>p.evaluate(async()=>{const m=await import('/src/store.ts');return {world:m.getWorld(),shared:m.useStore.getState().shared,status:m.useStore.getState().feedStatus}});
 const wait=async(rev)=>{for(const p of pages)await p.waitForFunction(async r=>(await import('/src/store.ts')).useStore.getState().shared?.revision===r,rev)};
 await wait(1);assert.deepEqual((await state(pages[0])).world,(await state(pages[1])).world);
 const original=JSON.stringify((await state(pages[0])).world);await pages[0].waitForTimeout(1200);assert.equal(JSON.stringify((await state(pages[0])).world),original,'observer must not advance biology');
 snapshot=structuredClone(snapshot);snapshot.revision=2;snapshot.at=Date.now();snapshot.world.simDay=1;await wait(2);
 offline=true;await pages[0].waitForFunction(async()=>(await import('/src/store.ts')).useStore.getState().feedStatus==='error');assert.equal((await state(pages[0])).world.simDay,1);
 offline=false;snapshot.revision=1;snapshot.world.simDay=0;await pages[0].waitForTimeout(1200);assert.equal((await state(pages[0])).shared.revision,2,'reject old snapshots');
 snapshot.revision=3;snapshot.world.simDay=2;snapshot.at=Date.now();await wait(3);assert.equal((await state(pages[0])).status,'live');
 await pages[1].reload();await wait(3);assert.deepEqual((await state(pages[0])).world,(await state(pages[1])).world);assert(calls>5);
 snapshot.runId='rattery-staging-round2';snapshot.revision=0;snapshot.world.simDay=0;snapshot.at=Date.now();await wait(0);assert.equal((await state(pages[0])).world.simDay,0);
 delete snapshot.runId;snapshot.revision=99;snapshot.world.simDay=99;await pages[0].waitForTimeout(1200);assert.equal((await state(pages[0])).world.simDay,0,'reject previous run after switch');

 console.log('PASS: two observers, no local biology, revision ordering, outage preservation, recovery, reload');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
