import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
mkdirSync('test-results',{recursive:true});
const tests=['determinism-test','replay-test','approved-trade-rules-test','care-test','burn-test','audit-security-test','social-test','navigation-test','exploration-test','ecology-test','enrichment-test','separation-test','motion-crowding-test','feed-resilience-test','snapshot-service-test','snapshot-incremental-test','memorial-alerts-test','foot-ik-test','adaptive-quality-test','adaptive-anatomy-test','foot-matrix-equivalence-test'];
for(const test of tests){
 console.log('TEST',test);
 const r=spawnSync(process.execPath,['--import','tsx','scripts/'+test+'.ts'],{stdio:'inherit',timeout:180000});
 if(r.error||r.status!==0){console.error('FAILED',test,r.error?.message??r.status);process.exit(1);}
}
console.log('PASS: '+tests.length+' controlled local suites');
