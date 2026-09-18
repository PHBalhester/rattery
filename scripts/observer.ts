import {Pool} from 'pg';
import {observerServer,readObservation} from '../server/observer.js';
async function main(){
 const production=process.env.RATTERY_OBSERVER_MODE==='production-readonly';
 if(!production&&process.env.RATTERY_OBSERVER_MODE!=='staging-readonly')throw Error('Mode required');
 const url=new URL(process.env.RATTERY_OBSERVER_DATABASE_URL??'');
 if(!['postgres:','postgresql:'].includes(url.protocol)||!(production?url.pathname==='/rattery_production':url.pathname.endsWith('_worker_staging'))||url.search)throw Error('Staging database required');
 const pool=new Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:true,ca:process.env.RATTERY_OBSERVER_DATABASE_CA},max:2,connectionTimeoutMillis:5000,statement_timeout:5000,idle_in_transaction_session_timeout:5000});
 const runId=process.env.RATTERY_OBSERVER_RUN_ID??'rattery-staging-round1';
 await readObservation(pool,runId);
 const server=observerServer(()=>readObservation(pool,runId),process.env.RATTERY_OBSERVER_SECRET??'');
 const port=Number(process.env.PORT||8080);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Port invalid');
 server.listen(port,'0.0.0.0',()=>console.log('Read-only observer started'));
 const stop=()=>{server.close(()=>void pool.end());setTimeout(()=>process.exit(0),10000).unref();};process.once('SIGTERM',stop);process.once('SIGINT',stop);
}
main().catch(()=>{console.error('Observer startup failed; details withheld');process.exitCode=1;});
