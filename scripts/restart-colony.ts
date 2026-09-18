import {Pool} from 'pg';
import {restartColony} from '../server/restart-colony.js';
const [transitionId,expectedRevision,expectedVersion,mode]=process.argv.slice(2);
if(!transitionId||!expectedRevision||!expectedVersion||!['--dry-run','--commit'].includes(mode))throw Error('Usage: restart-colony.ts TRANSITION_ID EXPECTED_REVISION EXPECTED_ENGINE_VERSION --dry-run|--commit');
const raw=process.env.RATTERY_OPERATOR_DATABASE_URL;
if(!raw)throw Error('Operator database URL required');
const url=new URL(raw);
if(!['postgres:','postgresql:'].includes(url.protocol)||url.search)throw Error('Invalid database URL');
const local=['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname.endsWith('_test');
if(!local&&url.pathname!=='/rattery_production')throw Error('Explicit production or local test database required');
const pool=new Pool({connectionString:raw,max:1,ssl:local?false:{rejectUnauthorized:true,...(process.env.RATTERY_OPERATOR_DATABASE_CA?{ca:process.env.RATTERY_OPERATOR_DATABASE_CA}:{})}});
try{console.log(JSON.stringify(await restartColony(pool,{transitionId,expectedRevision,expectedVersion,commit:mode==='--commit'})));}
catch{console.error('Restart refused; no change committed. Check worker lease, expected revision/version, extinction, pending payments and ledger integrity. Raw database errors withheld.');process.exitCode=1;}
finally{await pool.end();}
