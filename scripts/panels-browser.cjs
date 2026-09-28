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
  await p.goto(process.env.RATTERY_BASE_URL||'http://localhost:5173/');
  await p.getByRole('button',{name:'Explore the colony',exact:false}).click();
  await p.waitForSelector('.burrow-host[data-rats="blender"]');
  const panel=p.locator('.condition-panel');
  if(width<780){assert(!await panel.isVisible());await p.locator('.dock-tab.is-colony').click();}
  assert.equal(await p.getByRole('meter').count(),6);
  const box=await panel.boundingBox();assert(box&&box.x>=0&&box.x+box.width<=width+1,'Condition panel out of viewport');
  if(width<780){const nav=await p.locator('.colony-navigation').boundingBox();assert(box.y>=nav.y+nav.height,'Navigation must not cover the panel tabs');}
  assert(await p.locator(width<780?'.dock-tab.is-trade':'.chip-trade').isVisible());
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page overflows horizontally');
  await p.screenshot({path:path.join(outputDir,`panels-${width}.png`)});
  await p.getByRole('button',{name:'Rat',exact:true}).click();
  assert(await p.getByText('Meet a resident',{exact:true}).isVisible());
  if(width<780){await p.locator('.dock-tab.is-rats').click();await p.locator('.production-residents button').first().click();}
  else await p.getByRole('button',{name:'Follow a rat',exact:true}).click();
  await p.getByText('Individual observation',{exact:true}).waitFor();
  assert(await p.getByText('Demo mode · fictional tokens',{exact:true}).count());
  assert.equal(await p.locator('.care-group').count(),2);
  assert.deepEqual(await p.locator('.care-option strong').allTextContents(),['Name','Sociability','Irritability']);
  assert.equal(await p.locator('.rat-vitals [role="meter"]').count(),5);
  await p.screenshot({path:path.join(outputDir,`rat-${width}.png`)});
  await p.getByRole('button',{name:'Events',exact:true}).click();
  assert(await p.getByText('Observed interactions',{exact:true}).isVisible());
  await p.getByRole('button',{name:'Colony',exact:true}).click();
  await p.getByText('Space and social life',{exact:true}).click();
  assert(await p.getByText('Cohesion',{exact:true}).isVisible());
  // Phones close and reopen panels from the dock; larger screens use Hide info / Show info.
  if(width<780)await p.locator('.dock-tab.is-colony').click();else await p.getByRole('button',{name:'Hide info',exact:true}).click();
  await panel.waitFor({state:'hidden'});assert(await p.locator(width<780?'.dock-tab.is-trade':'.chip-trade').isVisible());
  if(width<780)await p.locator('.dock-tab.is-colony').click();else await p.getByRole('button',{name:'Show info',exact:true}).click();await panel.waitFor({state:'visible'});
  const seasonButtons=p.locator('.season-rail .season-actions button');
  assert.equal(await seasonButtons.count(),2);
  assert(await seasonButtons.nth(0).isEnabled());assert(await seasonButtons.nth(1).isDisabled());
  assert.equal(await p.locator('.season-nav-button,.burn-nav-toggle').count(),0,'No duplicate Season navigation shortcuts');
  assert.equal(await p.locator('.season-tutorial, .season-rail a').count(),0);
  assert((await p.locator('.season-rail').textContent()).includes('Coming soon'));
  await p.getByRole('button',{name:'Language / 语言'}).click();
  assert((await p.locator('.season-rail').textContent()).includes('即将推出'));
  assert.equal(await p.locator('.season-nav-button,.burn-nav-toggle').count(),0,'No duplicate Season navigation shortcuts');
  if(width<780)await p.locator('.dock-tab.is-season').click();
  const season=p.locator(width<780?'.dock-season':'.season-rail');
  assert.equal(await p.locator('.season-gameplay-action:visible').count(),4,'Only one visible group of game actions');
  for(const b of await season.locator('.season-gameplay-action').all())assert(await b.isDisabled(),'Gameplay stays unavailable until launch');
  const banner=await season.locator('.season-banner').boundingBox(),actions=await season.locator('.season-gameplay-grid').boundingBox();
  assert(banner&&actions&&actions.y>=banner.y+banner.height,'Actions are below the banner');
  assert(actions.x>=0&&actions.x+actions.width<=width+1,'Actions fit the viewport');
  await p.screenshot({path:path.join(outputDir,`season-released-${width}.png`)});
  const telemetry=await p.locator('.burrow-host').getAttribute('data-performance');
  assert.deepEqual(errors,[]);console.log('PASS panels/released tutorial EN+ZH',width,height,telemetry);
  await p.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});