const {chromium}=require('./lib/browser-runtime.cjs');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const context=await browser.newContext();await context.addInitScript(()=>localStorage.setItem('rattery:welcome-tour:v1','done'));
 const pages=await Promise.all([context.newPage(),context.newPage()]),errors=[];for(const page of pages)page.on('pageerror',e=>errors.push(e.message));
 await Promise.all(pages.map(p=>p.goto('https://staging.rattery.tech/?view=shared-colony')));
 for(const page of pages)await page.waitForFunction(()=>Number(document.querySelector('.shared-status')?.dataset.revision)>0,{},{timeout:30000});
 const states=await Promise.all(pages.map(p=>p.evaluate(async()=>{const r=await fetch('/api/observer');const j=await r.json();return {status:r.status,colony:j.colonyId,version:j.version,revision:j.revision,payments:j.paymentsEnabled,extinct:j.world.extinct,run:j.runId,living:Object.values(j.world.rats).filter(r=>r.deadAt===null).length,day:j.world.simDay,care:!!j.world.care,bytes:JSON.stringify(j).length}})));
 assert.equal(states[0].colony,states[1].colony);assert.equal(states[0].version,states[1].version);assert.equal(states[0].run,states[1].run);if(process.env.RATTERY_REQUIRE_LIVE==='true'){for(const s of states){assert(s.living>0);assert.equal(s.extinct,false);assert.equal(s.run,process.env.RATTERY_EXPECTED_RUN||'rattery-staging-round2')}}for(const s of states){assert.equal(s.status,200);assert.equal(s.payments,false);assert.equal(s.care,false)}
 await pages[0].screenshot({path:'test-results/shared-colony-public.png'});
 await context.setOffline(true);await pages[0].waitForFunction(()=>document.querySelector('.shared-status')?.textContent?.includes('Connection delayed'),{},{timeout:20000});
 await context.setOffline(false);await pages[0].waitForFunction(()=>document.querySelector('.shared-status')?.textContent?.includes('Shared staging colony'),{},{timeout:20000});
 await pages[1].goto('https://staging.rattery.tech/');await pages[1].waitForTimeout(1500);assert.equal(await pages[1].locator('.shared-status').count(),0);assert.deepEqual(errors,[]);console.log('PASS: public shared observers, matching colony/engine, sanitized data, offline recovery, default demonstration preserved',states);
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
