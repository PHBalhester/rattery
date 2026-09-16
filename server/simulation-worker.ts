import type {Persistence} from './persistence.js';
/** One in-flight iteration per worker; PostgreSQL serializes different workers. */
export function startSimulationWorker(service:Persistence,onError:(error:unknown)=>void,intervalMs=100){
 if(!Number.isInteger(intervalMs)||intervalMs<50||intervalMs>10000)throw Error('Invalid worker interval');
 let stopped=false,timer:ReturnType<typeof setTimeout>|undefined;
 let active:Promise<void>=Promise.resolve();
 const run=()=>{active=(async()=>{
  try{await service.advanceSimulation();}catch(error){onError(error);}
  finally{if(!stopped)timer=setTimeout(run,intervalMs);}
 })();};
 run();
 return async()=>{stopped=true;if(timer)clearTimeout(timer);await active;};
}
