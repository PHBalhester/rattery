import type {Persistence} from './persistence.js';
import type {MarketCollector} from './market-collector.js';
/** Non-overlapping loops with bounded exponential backoff and awaited shutdown. */
export function startWorkerRuntime(service:Persistence,collector:MarketCollector,report:(event:Record<string,unknown>)=>void,reconcile=false,residence?:()=>Promise<Record<string,unknown>>){
 let stopping=false;
 const timers=new Set<ReturnType<typeof setTimeout>>(),wakeups=new Set<()=>void>();
 const wait=(ms:number)=>new Promise<void>(resolve=>{
  const done=()=>{clearTimeout(timer);timers.delete(timer);wakeups.delete(done);resolve();};
  const timer=setTimeout(done,ms);timers.add(timer);wakeups.add(done);
 });
 const loop=async(name:string,interval:number,work:()=>Promise<Record<string,unknown>>)=>{
  let failures=0,lastReport=0;
  while(!stopping){
   try{const metrics=await work();failures=0;
    if(Date.now()-lastReport>=30000){report({event:name+'_ok',...metrics,rssBytes:process.memoryUsage().rss});lastReport=Date.now();}
   }catch{failures++;report({event:name+'_error',consecutiveFailures:failures});}
   if(!stopping)await wait(failures?Math.min(60000,1000*2**Math.min(failures,6)):interval);
  }
 };
 const tasks=[
  loop('biology',100,()=>service.advanceSimulation()),
  loop('market',5000,async()=>{const result=await collector.poll(100);const quotes=await collector.retryPrices(10);return {...result,quotesResolved:quotes.resolved};}),
 ];
 if(residence)tasks.push(loop('residence',60000,residence));
 if(reconcile)tasks.push(loop('payments',15000,()=>service.reconcileSubmitted(5)));
 return async()=>{stopping=true;for(const done of [...wakeups])done();await Promise.all(tasks);};
}
