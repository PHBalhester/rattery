const {chromium,outputDir}=require('./lib/browser-runtime.cjs');
const assert=require('node:assert/strict');
const path=require('node:path');
// Guided Season tutorial (review builds only): unlocked by ?season-tutorial, walks all steps,
// keeps the card inside the viewport, restores cinema and closes with Escape.
(async()=>{
 const base=process.env.RATTERY_BASE_URL||'http://localhost:5173/';
 const browser=await chromium.launch({headless:true});
 try{for(const [width,height] of [[1440,900],[390,844]]){
  const p=await browser.newPage({viewport:{width,height}}),errors=[];
  p.setDefaultTimeout(Number(process.env.RATTERY_TIMEOUT||30000));
  p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{try{localStorage.setItem('rattery:welcome-explainer:v2','done');}catch{}});
  await p.goto(base+'?season-tutorial');
  await p.waitForSelector('.stut-card.is-placed');
  const steps=await p.locator('.stut-progress i').count();
  assert.equal(steps,16);
  for(let i=0;i<steps;i++){
   assert.equal((await p.locator('.stut-count').textContent()).trim(),`${i+1} / ${steps}`);
   const box=await p.locator('.stut-card').boundingBox();
   assert(box&&box.width>200&&box.height>120,'Card not rendered');
   assert(await p.locator('#stut-title').isVisible());
   if(i<steps-1)await p.keyboard.press('ArrowRight');
  }
  await p.keyboard.press('ArrowLeft');
  assert.equal((await p.locator('.stut-count').textContent()).trim(),`${steps-1} / ${steps}`);
  await p.screenshot({path:path.join(outputDir,`season-tutorial-${width}.png`)});
  await p.keyboard.press('Escape');
  await p.locator('.stut').waitFor({state:'detached'});
  assert.deepEqual(errors,[]);console.log('PASS season tutorial',width,height);
  await p.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
