const fs=require('node:fs'),path=require('node:path');
const playwright=require('playwright');
const outputDir=path.resolve(__dirname,'../../test-results/browser');
fs.mkdirSync(outputDir,{recursive:true});
fs.mkdirSync(path.resolve(__dirname,'../../test-results/audit-2026-09-16'),{recursive:true});
const chromium={...playwright.chromium,launch:(options={})=>playwright.chromium.launch({...options,...(process.env.RATTERY_BROWSER_CHANNEL?{channel:process.env.RATTERY_BROWSER_CHANNEL}:{})})};
module.exports={...playwright,chromium,outputDir};
