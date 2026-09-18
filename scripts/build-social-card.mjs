import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
const logo=readFileSync(new URL('../public/rattery-logo.png',import.meta.url)).toString('base64');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
 await page.setContent(`<!doctype html><html><head><style>
 *{box-sizing:border-box}body{margin:0;width:1200px;height:630px;background:#050706;color:#f4f3ed;font-family:Arial,sans-serif;overflow:hidden}
 .frame{position:absolute;inset:28px;border:1px solid #ffffff20;border-radius:20px}
 .logo{position:absolute;width:670px;height:670px;right:-55px;top:-20px;object-fit:contain;mix-blend-mode:screen;opacity:.95}
 .copy{position:absolute;left:76px;top:114px;z-index:2}
 .eyebrow{font-size:16px;letter-spacing:4px;color:#a5cfb4;margin:0 0 28px}
 h1{font-size:86px;letter-spacing:-5px;margin:0 0 26px;font-weight:700;line-height:1}
 .tagline{font-size:31px;line-height:1.3;letter-spacing:-.6px;color:#e0e4de;margin:0}
 .caption{font-size:18px;line-height:1.55;color:#929e97;margin-top:22px}
 footer{position:absolute;bottom:70px;left:76px;right:76px;display:flex;justify-content:space-between;border-top:1px solid #ffffff24;padding-top:24px;font-size:16px;color:#aeb8b1}
 .dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#a5cfb4;margin-right:10px}
 </style></head><body><div class="frame"></div><img class="logo" src="data:image/png;base64,${logo}"><div class="copy"><p class="eyebrow">A DIGITAL COLONY EXPERIMENT</p><h1>RATTERY</h1><p class="tagline">A living colony.<br>A shared experiment.</p><p class="caption">Watch life unfold in 3D.<br>Community activity shapes their world.</p></div><footer><span>rattery.tech</span><span><i class="dot"></i>On Robinhood Chain</span></footer></body></html>`);
 await page.locator('img').evaluate(img=>img.decode());
 await page.screenshot({path:new URL('../public/rattery-social-v2.png',import.meta.url).pathname});
}finally{await browser.close();}
