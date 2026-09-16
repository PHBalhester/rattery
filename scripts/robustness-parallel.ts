import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
mkdirSync('test-results',{recursive:true});
const results=await Promise.all([1,2,3,4,5,6].map(seed=>new Promise<{seed:number;code:number|null}>(resolve=>{
 const child=spawn('npm',['run','test:robustness'],{env:{...process.env,RATTERY_TEST_SEED:String(seed)},stdio:['ignore','pipe','pipe']});let log='';
 child.stdout.on('data',data=>{log+=data;process.stdout.write(`[seed ${seed}] ${data}`);});child.stderr.on('data',data=>{log+=data;process.stderr.write(`[seed ${seed}] ${data}`);});
 child.on('exit',code=>{writeFileSync(`test-results/robustness-seed-${seed}.log`,log);resolve({seed,code});});child.on('error',error=>{log+=String(error);resolve({seed,code:1});});
})));
writeFileSync('test-results/robustness-summary.json',JSON.stringify(results,null,2));if(results.some(r=>r.code!==0))process.exitCode=1;else console.log('PASS: six isolated seeds, five scenarios each, 3600000 total ticks');
