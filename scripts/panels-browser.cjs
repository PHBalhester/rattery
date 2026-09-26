const {chromium,outputDir}=require('./lib/browser-runtime.cjs');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{for(const [width,height] of [[1440,900],[1024,768],[390,844],[360,740]]){
  const p=await browser.newPage({viewport:{width,height}}),errors=[];
  p.setDefaultTimeout(15000);
  p.on('pageerror',e=>errors.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE/i.test(m.text()))errors.push(m.text());});
  await p.goto('http://localhost:5173/');
  await p.getByRole('button',{name:'Explore the colony',exact:false}).click();
  await p.waitForSelector('.burrow-host[data-rats="blender"]');
  const panel=p.locator('.condition-panel');
  if(width<780){assert(!await panel.isVisible());await p.getByRole('button',{name:'Show info',exact:true}).click();}
  assert.equal(await p.getByRole('meter').count(),6);
  const box=await panel.boundingBox();assert(box&&box.x>=0&&box.x+box.width<=width+1,'Condition panel out of viewport');
  assert(await p.locator('.chip-trade').isVisible());
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page overflows horizontally');
  await p.screenshot({path:path.join(outputDir,`panels-${width}.png`)});
  await p.getByRole('button',{name:'Rat',exact:true}).click();
  assert(await p.getByText('Meet a resident',{exact:true}).isVisible());
  if(width<780){await p.getByRole('button',{name:'Meet the rats',exact:true}).click();await p.locator('.production-residents button').first().click();}
  else await p.getByRole('button',{name:'Follow a rat',exact:true}).click();
  await p.getByText('Individual observation',{exact:true}).waitFor();
  assert(await p.getByText('Demo mode · fictional tokens',{exact:true}).count());
  assert.equal(await p.locator('.care-group').count(),4);
  assert.equal(await p.locator('.rat-vitals [role="meter"]').count(),5);
  await p.screenshot({path:path.join(outputDir,`rat-${width}.png`)});
  await p.getByRole('button',{name:'Events',exact:true}).click();
  assert(await p.getByText('Observed interactions',{exact:true}).isVisible());
  await p.getByRole('button',{name:'Colony',exact:true}).click();
  await p.getByText('Space and social life',{exact:true}).click();
  assert(await p.getByText('Cohesion',{exact:true}).isVisible());
  await p.getByRole('button',{name:'Hide info',exact:true}).click();
  await panel.waitFor({state:'hidden'});assert(await p.locator('.chip-trade').isVisible());
  await p.getByRole('button',{name:'Show info',exact:true}).click();await panel.waitFor({state:'visible'});
  const seasonButtons=p.locator('.season-rail .season-actions button');
  assert.equal(await seasonButtons.count(),2);
  for(const b of await seasonButtons.all())assert(await b.isDisabled());
  assert(await p.locator('.season-nav-button').isDisabled());
  assert.equal(await p.locator('.season-tutorial, .season-rail a').count(),0);
  assert((await p.locator('.season-rail').textContent()).includes('Coming soon'));
  await p.getByRole('button',{name:'Language / 语言'}).click();
  assert((await p.locator('.season-rail').textContent()).includes('即将推出'));
  assert(await p.locator('.season-nav-button').isDisabled());
  await p.screenshot({path:path.join(outputDir,`season-locked-${width}.png`)});
  const telemetry=await p.locator('.burrow-host').getAttribute('data-performance');
  assert.deepEqual(errors,[]);console.log('PASS panels/locked Season EN+ZH',width,height,telemetry);
  await p.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});