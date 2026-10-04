import {useSeasonVisual,type NestId,type VisualEvent} from './visualState';
const ids:NestId[]=['NVDA','AAPL','AMZN'];let initialized=false,serial=0,timer=0;const seen=new Set<string>(),queue:VisualEvent[]=[];
function playNext(){const event=queue.shift();if(event)useSeasonVisual.setState({event});if(queue.length)timer=window.setTimeout(playNext,4500);else timer=0;}
/** Only verified live snapshots enter this adapter; no demo scoring or predicted damage. */
export function publishLiveNests(snapshot:{nests:{id:number;score:string;halfPoint:number;shieldUntil:number}[];events?:{available:boolean;items:{key:string;kind:number;nest:number;points:string;damage:string;blocked:boolean}[]}}){
 if(useSeasonVisual.getState().winner)return;
 const scores={NVDA:0,AAPL:0,AMZN:0},shieldUntil={NVDA:0,AAPL:0,AMZN:0};
 for(const row of snapshot.nests){const id=ids[row.id-1],score=Number(row.score)+Number(row.halfPoint)/2;if(!id||!Number.isFinite(score)||score<0)continue;scores[id]=score;shieldUntil[id]=row.shieldUntil;}
 useSeasonVisual.setState({scores,shieldUntil});const events=snapshot.events;if(!events?.available)return;
 for(const e of events.items){if(seen.has(e.key))continue;seen.add(e.key);const nest=ids[e.nest-1];if(initialized&&nest&&[1,2,3].includes(e.kind)&&queue.length<20)queue.push({serial:++serial,nest,kind:(['join','feed','shield','attack'] as const)[e.kind] as VisualEvent['kind'],points:Number(e.points),damage:Number(e.damage),blocked:e.blocked});}
 initialized=true;if(seen.size>300){const recent=[...seen].slice(-150);seen.clear();recent.forEach(key=>seen.add(key));}if(!timer&&queue.length)playNext();
}

/** Final scores are published only by the verified result endpoint. Stop queued gameplay FX. */
export function publishFinalNests(rows:{ticker:NestId;finalHalves:string}[],winner:NestId){
 if(useSeasonVisual.getState().winner===winner)return;
 if(timer)window.clearTimeout(timer);timer=0;queue.length=0;
 const scores={NVDA:0,AAPL:0,AMZN:0};for(const row of rows)scores[row.ticker]=Number(row.finalHalves)/2;
 useSeasonVisual.setState({scores,event:null,shieldUntil:{NVDA:0,AAPL:0,AMZN:0}});
 useSeasonVisual.getState().revealWinner(winner);
}
