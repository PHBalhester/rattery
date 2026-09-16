const {chromium}=require('./lib/browser-runtime.cjs');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
const page=await browser.newPage({viewport:{width:1400,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:5173/');await page.waitForSelector('.burrow-host[data-habitat="blender"][data-rats="blender"]');
const out=require('./lib/browser-runtime.cjs').outputDir+'/';
await page.screenshot({path:out+'habitat-overview.png'});
await page.getByRole('button',{name:'Nest',exact:true}).click();await page.waitForTimeout(300);await page.screenshot({path:out+'habitat-nest.png'});await page.getByRole('button',{name:'View rat',exact:true}).click();await page.waitForTimeout(300);await page.screenshot({path:out+'colony-blender-rat.png'});
for(let i=0;i<5;i++){await page.getByRole('button',{name:'Play areas',exact:true}).click();await page.waitForTimeout(100);if(i===0)await page.screenshot({path:out+'habitat-play.png'});}
await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Overview',exact:true}).click();await page.waitForTimeout(200);assert.equal(await page.locator('.render-error').count(),0);
await page.route('**/models/habitat.glb',route=>route.abort());await page.reload();await page.waitForSelector('.burrow-host[data-habitat="fallback"]');assert.equal(await page.locator('.render-error').count(),0);assert.deepEqual(errors,[]);
console.log(JSON.stringify({loaded:true,areas:5,mobile:true,fallback:true,errors}));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
