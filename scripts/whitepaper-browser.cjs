// Whitepaper page: served at /whitepaper, all sections present, no scripts, no horizontal overflow,
// and the Season card links to it. Run against the dev server:
// RATTERY_TEST_URL=http://127.0.0.1:5173/ node scripts/whitepaper-browser.cjs
const {chromium}=require('./lib/browser-runtime.cjs');
const assert=require('node:assert/strict');
(async()=>{
 const base=process.env.RATTERY_TEST_URL||'http://localhost:5173/';
 const browser=await chromium.launch({headless:true});
 try{
  for(const [width,height] of [[1440,900],[390,844]]){
   const p=await browser.newPage({viewport:{width,height}});const errors=[];
   p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   const r=await p.goto(base+'whitepaper');assert.equal(r.status(),200);
   assert.equal(await p.title(),'Season I Whitepaper · RATTERY');
   assert.equal(await p.locator('script').count(),0,'Static page, no scripts');
   assert.equal(await p.locator('.wp-section').count(),15);
   assert.equal(await p.locator('.wp-asset a[rel="noopener noreferrer"]').count(),3);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width,'No horizontal page scroll');
   assert.equal(await p.locator(width<980?'.wp-toc.is-drop':'.wp-toc.is-side').isVisible(),true);
   assert.equal(await p.evaluate(()=>/[–—]/.test(document.body.innerText)),false);
   assert.deepEqual(errors,[]);console.log('PASS whitepaper page',width);await p.close();
  }
  const p=await browser.newPage({viewport:{width:1440,height:900}});p.setDefaultTimeout(Number(process.env.RATTERY_TIMEOUT||120000));
  await p.addInitScript(()=>{try{localStorage.setItem('rattery:welcome-explainer:v2','done');localStorage.setItem('rattery:panels','open');}catch{}});
  await p.goto(base);const link=p.locator('a.season-button',{hasText:'Whitepaper'}).first();await link.waitFor();
  assert.equal(await link.getAttribute('href'),'/whitepaper');assert.equal(await link.getAttribute('target'),'_blank');
  console.log('PASS Season card whitepaper link');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
