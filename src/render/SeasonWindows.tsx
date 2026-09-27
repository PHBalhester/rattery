import {useEffect,useState,type CSSProperties} from 'react';
import {tr,locale,useLanguage} from '../i18n';
import {getWorld,useStore} from '../store';
import {colonyMetrics} from '../sim/colonyMetrics';
import Count from './Count';
import {TICKERS,useSeasonFeed,weeklyPoints,weeklyReturnPct,dayChangePct,direction,colonyCondition,recurringPoints,prizeBreakdown,weekPhase,span,type Condition} from './seasonFeed';

const signed=(v:number,digits=1)=>`${v>0?'+':v<0?'−':''}${Math.abs(v).toLocaleString(locale(),{minimumFractionDigits:digits,maximumFractionDigits:digits})}`;
const usd=(v:number)=>`$${Math.round(v).toLocaleString('en-US')}`;
const CONDITION:Record<Condition,[string,string]>={happy:['Happy','愉快'],neutral:['Neutral','中性'],stressed:['Stressed','紧张']};

function Badge(){
 const source=useSeasonFeed(s=>s.source);
 return source==='live'?<span className="swin-badge is-live"><i/>{tr('Live','实时')}</span>:source==='demo'?<span className="swin-badge is-demo" title={tr('Demo numbers for review. Not real prices.','评审用演示数据，并非真实价格。')}>DEMO</span>:<span className="swin-badge">{tr('Pending','待接入')}</span>;
}
function Help({step,label}:{step:string;label:string}){
 return <button type="button" className="swin-help" aria-label={label} title={label} onClick={()=>window.dispatchEvent(new CustomEvent('rattery:season-tutorial',{detail:step}))}>?</button>;
}
function useNow(ms:number){const [now,setNow]=useState(Date.now());useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),ms);return()=>clearInterval(t);},[ms]);return now;}

/** This week's three reference stocks: day direction drives the 10-minute effect, week return drives the settlement bonus. */
export function StockWindow(){
 useLanguage(s=>s.language);useStore(s=>s.version);
 const quotes=useSeasonFeed(s=>s.quotes);
 const world=getWorld(),m=colonyMetrics(world),condition=colonyCondition(m.stress),known=m.n>0;
 const open=quotes?Object.values(quotes).some(q=>q.session==='regular'):false;
 return <section className="swin season-stocks" aria-labelledby="swin-stocks-title">
  <header className="swin-head"><h3 id="swin-stocks-title">{tr('This week\'s stocks','本周股票')}</h3><span className={`swin-market${open?' is-open':''}`} title={open?tr('US market open','美股开市'):tr('US market closed: stock effect is neutral','美股休市：股价影响为中性')}><i/>{open?tr('Open','开市'):tr('Closed','休市')}</span><Badge/><Help step="stocks" label={tr('How the stocks count','股票如何计分')}/></header>
  {quotes?<table className="swin-table">
   <thead><tr><th>{tr('Nest','巢穴')}</th><th>{tr('Price','价格')}</th><th title={tr('Versus the previous regular close','相对前一常规收盘价')}>{tr('Today','今日')}</th><th title={tr('Weekly return × 10, applied at settlement','周收益率×10，结算时计入')}>{tr('Week','本周')}</th><th title={tr('Points per 10 minutes with the current colony condition','按当前群落状况每10分钟的积分')}>/10m</th></tr></thead>
   <tbody>{TICKERS.map(({ticker,color})=>{const q=quotes[ticker],d=direction(q),pts=weeklyPoints(q),per=known?recurringPoints(condition,d):0;
    return <tr key={ticker} style={{'--c':color} as CSSProperties} data-ticker={ticker}>
     <th scope="row"><i aria-hidden="true"/>{ticker}</th>
     <td>{q.last.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
     <td className={d==='up'?'is-up':d==='down'?'is-down':''}>{q.session==='regular'?<>{d==='up'?'▲':d==='down'?'▼':'■'} {signed(dayChangePct(q))}%</>:<span title={tr('Market closed: neutral','休市：中性')}>■ {tr('flat','持平')}</span>}</td>
     <td className={pts>0?'is-up':pts<0?'is-down':''} title={`${signed(weeklyReturnPct(q),2)}%`}>{signed(pts,0)}</td>
     <td className={per>0?'is-up':per<0?'is-down':''}>{signed(per,per%1?1:0)}</td>
    </tr>;})}</tbody>
  </table>:<p className="swin-empty">{tr('Stock prices appear here when the price feed is connected.','价格数据接入后将在此显示股价。')}</p>}
  <footer className="swin-foot"><span className={`swin-mood is-${condition}`}>{tr('Colony','群落')}: <b>{known?tr(...CONDITION[condition]):tr('Waiting','等待中')}</b></span><span>{known?`${Math.round(m.stress*100)}% ${tr('avg stress','平均压力')}`:''}</span></footer>
 </section>;
}

/** Estimated prize for the current week, its split and the clock. */
export function PrizeWindow(){
 useLanguage(s=>s.language);
 const prize=useSeasonFeed(s=>s.prize),now=useNow(15000),w=weekPhase(now);
 const b=prize?prizeBreakdown(prize):null;
 const clock=w.phase==='settling'?[tr('Settling · opens in','结算中 · 开启倒计时'),span(w.opensAt-now)]:w.phase==='final'?[tr('Final hours · closes in','最后阶段 · 结束倒计时'),span(w.closesAt-now)]:[tr('Closes in','结束倒计时'),span(w.closesAt-now)];
 return <section className="swin season-prize" aria-labelledby="swin-prize-title">
  <header className="swin-head"><h3 id="swin-prize-title">{tr('Weekly Prize','每周奖金')}</h3><Badge/><Help step="pot" label={tr('Where the prize comes from','奖金来源')}/></header>
  {b?<>
   <div className="swin-total"><strong>$<Count value={Math.round(b.total)} format={v=>v.toLocaleString('en-US')}/></strong><small>{tr('estimated · paid in the winning nest\'s Stock Token','估算 · 以获胜巢穴的Stock Token支付')}</small></div>
   <div className="swin-split" role="img" aria-label={`${tr('Winning players','获胜玩家')} ${usd(b.active)}, ${tr('Holders','持有者')} ${usd(b.passive)}`}>
    <span style={{flexGrow:b.active}}><b>{usd(b.active)}</b><small>{tr('Winners 80%','获胜者 80%')}</small></span>
    <span style={{flexGrow:b.passive}}><b>{usd(b.passive)}</b><small>{tr('Holders 20%','持有者 20%')}</small></span>
   </div>
   <p className="swin-source">{prize!.openingUsd>0&&<>{usd(prize!.openingUsd)} {tr('opening','开幕资金')} + </>}{b.feePrizeEth.toLocaleString('en-US',{maximumFractionDigits:3})} ETH {tr('(70% of fees)','（手续费的70%）')}</p>
  </>:<p className="swin-empty">{tr('The prize estimate appears here when fee tracking is connected.','手续费统计接入后将在此显示奖金估算。')}</p>}
  <footer className="swin-foot season-prize-clock"><span>{clock[0]} <b>{clock[1]}</b></span>{w.entryUsd!==null&&<span title={tr('Entry price now; it rises as the week ends','当前入场价，临近周末会上涨')}>{tr('Entry','入场')} <b>USD {w.entryUsd}</b>{w.nextEntry&&<small> · {w.nextEntry.usd} {tr('in','于')} {span(w.nextEntry.at-now)}</small>}</span>}</footer>
 </section>;
}

export default function SeasonWindows(){return <><StockWindow/><PrizeWindow/></>;}
