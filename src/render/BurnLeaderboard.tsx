import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {tr,locale,useLanguage} from '../i18n';
import {useWallet} from '../wallet';
import Count from './Count';

/*
 * Top burners: share of all confirmed RATTERY burns recorded by the colony ledger (/api/burners).
 * Nest membership starts with Season I; until then rows carry nest:null.
 * Review builds fall back to clearly labelled DEMO rows when the endpoint is not deployed.
 */
type Nest='NVDA'|'AAPL'|'AMZN';
type Row={wallet:string;units:string;burns:number;nest:Nest|null};
type Board={totalUnits:string;burns:number;wallets:number;at:number;leaders:Row[];demo?:boolean};
const NEST:Record<Nest,{name:string;letter:string;color:string}>={NVDA:{name:'NVIDIA',letter:'A',color:'#91cf36'},AAPL:{name:'Apple',letter:'B',color:'#dce6f0'},AMZN:{name:'Amazon',letter:'C',color:'#ffae43'}};
const DECIMALS=18n;
const short=(w:string)=>w.slice(0,6)+'…'+w.slice(-4);
function compact(units:string){
 const whole=BigInt(units)/10n**DECIMALS,n=Number(whole);
 return n>=1e9?(n/1e9).toFixed(2)+'B':n>=1e6?(n/1e6).toFixed(n>=1e7?1:2)+'M':n>=1e3?(n/1e3).toFixed(n>=1e4?0:1)+'K':n.toLocaleString('en-US');
}
/** Share in basis points of a basis point (1e-6 precision) using integer math. */
function share(units:string,total:string){const t=BigInt(total);return t===0n?0:Number(BigInt(units)*100_000_000n/t)/1_000_000;}
const pct=(v:number)=>v>0&&v<.01?'<0.01%':v.toLocaleString(locale(),{minimumFractionDigits:2,maximumFractionDigits:2})+'%';

function demoBoard():Board{
 const nests:(Nest|null)[]=['NVDA','AMZN','AAPL','NVDA',null,'AAPL','AMZN','NVDA','AAPL',null,'AMZN','NVDA'];
 const amounts=[4200000,3100000,2650000,1800000,1500000,1250000,900000,760000,500000,500000,320000,150000];
 let seed=7;const hex=()=>Array.from({length:40},()=>((seed=seed*16807%2147483647)%16).toString(16)).join('');
 const leaders=amounts.map((a,i)=>({wallet:'0x'+hex(),units:(BigInt(a)*10n**DECIMALS).toString(),burns:1+((i*7)%9),nest:nests[i]}));
 return {totalUnits:(BigInt(amounts.reduce((s,v)=>s+v,0)+2400000)*10n**DECIMALS).toString(),burns:212,wallets:64,at:Date.now(),leaders,demo:true};
}

export default function BurnLeaderboard({onClose,allowDemo}:{onClose:()=>void;allowDemo:boolean}){
 useLanguage(s=>s.language);
 const me=useWallet(s=>s.account);
 const [board,setBoard]=useState<Board|null>(null),[failed,setFailed]=useState(false),[now,setNow]=useState(Date.now());
 const panel=useRef<HTMLElement>(null);
 useEffect(()=>{
  let alive=true;
  const load=async()=>{
   try{
    const r=await fetch('/api/burners',{cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!r.ok)throw Error('unavailable');const d=await r.json();
    if(alive){setBoard({totalUnits:d.totalUnits,burns:d.burns,wallets:d.wallets,at:d.at,leaders:d.leaders});setFailed(false);}
   }catch{if(alive){if(allowDemo)setBoard(b=>b&&!b.demo?b:demoBoard());else setFailed(true);}}
  };
  void load();const t=setInterval(load,30000),c=setInterval(()=>setNow(Date.now()),5000);
  return()=>{alive=false;clearInterval(t);clearInterval(c);};
 },[allowDemo]);
 useEffect(()=>{panel.current?.focus({preventScroll:true});},[]);
 const top=useMemo(()=>board?.leaders.length?share(board.leaders[0].units,board.totalUnits):0,[board]);
 const age=board?Math.max(0,Math.round((now-board.at)/1000)):0;
 return <section ref={panel} tabIndex={-1} className="burn-board" aria-labelledby="burn-board-title" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose();}}}>
  <span className="season-corner tl" aria-hidden="true"/><span className="season-corner tr" aria-hidden="true"/>
  <header className="burn-head">
   <div><span className="burn-kicker">Season I · {tr('Leaderboard','排行榜')}</span><h3 id="burn-board-title">{tr('Top burners','销毁排行')}</h3></div>
   {board?.demo&&<span className="swin-badge is-demo" title={tr('Demo rows for review. Not real wallets.','评审用演示数据，并非真实钱包。')}>DEMO</span>}
   <button type="button" className="burn-close" onClick={onClose} aria-label={tr('Close leaderboard','关闭排行榜')}>×</button>
  </header>
  {board&&<div className="burn-totals">
   <div><small>{tr('Total burned','累计销毁')}</small><strong>{compact(board.totalUnits)}</strong><em>RATTERY</em></div>
   <div><small>{tr('Burners','销毁钱包')}</small><strong><Count value={board.wallets}/></strong></div>
   <div><small>{tr('Burns','销毁次数')}</small><strong><Count value={board.burns}/></strong></div>
  </div>}
  <ol className="burn-list" aria-label={tr('Wallets ranked by share of all burns','按销毁占比排序的钱包')}>
   {!board&&!failed&&Array.from({length:6},(_,i)=><li key={i} className="burn-row is-skeleton" aria-hidden="true"><i/><span/><span/></li>)}
   {failed&&<li className="burn-empty">{tr('The leaderboard is unavailable right now. Try again in a moment.','排行榜暂时不可用，请稍后再试。')}</li>}
   {board&&!board.leaders.length&&<li className="burn-empty">{tr('No burns recorded yet.','尚无销毁记录。')}</li>}
   {board?.leaders.map((r,i)=>{const s=share(r.units,board.totalUnits),nest=r.nest?NEST[r.nest]:null,mine=me===r.wallet;
    return <li key={r.wallet} className={`burn-row${i<3?' is-podium':''}${mine?' is-me':''}`} data-rank={i+1} style={{'--i':i,'--w':top?Math.max(.03,s/top):0,'--c':nest?.color??'#6f6a5c'} as CSSProperties}>
     <span className="burn-rank" aria-label={tr('Rank','排名')+' '+(i+1)}>{i+1}</span>
     <div className="burn-who">
      <a href={'https://robinhoodchain.blockscout.com/address/'+r.wallet} target="_blank" rel="noopener noreferrer" title={r.wallet}>{short(r.wallet)}</a>
      {mine&&<b className="burn-me">{tr('You','你')}</b>}
      <small>{compact(r.units)} RATTERY · {r.burns} {r.burns===1?tr('burn','次'):tr('burns','次')}</small>
     </div>
     <span className={`burn-nest${nest?'':' is-none'}`} title={nest?nest.name:tr('Nests open with Season I','巢穴将在第一赛季开放')}>{nest?<><i>{nest.letter}</i>{nest.name}</>:'—'}</span>
     <strong className="burn-share">{pct(s)}</strong>
     <span className="burn-bar" aria-hidden="true"><i/></span>
    </li>;})}
  </ol>
  <footer className="burn-foot">
   <span className="burn-live"><i aria-hidden="true"/>{board?(age<10?tr('Updated just now','刚刚更新'):tr(`Updated ${age}s ago`,`${age}秒前更新`)):tr('Loading…','加载中…')}</span>
   <span>{tr('Share of all confirmed RATTERY burns. Nests appear when Season I opens.','占全部已确认RATTERY销毁的比例。巢穴将在第一赛季开放后显示。')}</span>
  </footer>
 </section>;
}
