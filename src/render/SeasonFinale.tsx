import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {tr,useLanguage} from '../i18n';
import {useSeasonClosed,useSeasonResult,refreshSeasonResult} from '../season/resultState';
import {useSeasonVisual} from '../season/visualState';
import './season-finale.css';
const points=(halves:string)=>(Number(halves)/2).toLocaleString(undefined,{maximumFractionDigits:1});
function ResultDetails(){const r=useSeasonResult(s=>s.result);if(r?.phase!=='complete')return null;return <>
 <ol className="season-final-ranking">{r.ranking.map((row,i)=><li key={row.ticker} data-nest={row.ticker}><span>{i===0?'♛':i+1}</span><strong>{row.ticker}</strong><b>{points(row.finalHalves)} <small>pts</small></b><small>{points(row.baseHalves)} {Number(row.weeklyAdjustment)>=0?'+':''}{row.weeklyAdjustment} {tr('weekly adjustment','每周调整')}</small></li>)}</ol>
 <p className="season-final-payment">{tr('Payments planned for Monday, October 5, late morning (São Paulo). Distribution is not yet complete.','计划于10月5日星期一圣保罗时间上午晚些时候发放奖励。目前尚未完成发放。')}</p>
 <a href={`https://robin.etherscan.io/block/${r.block}`} target="_blank" rel="noopener noreferrer">{tr('Verified onchain snapshot','已验证链上快照')} ↗</a>
 </>;}
export function SeasonFinaleCard(){useLanguage(s=>s.language);const closed=useSeasonClosed(),r=useSeasonResult(s=>s.result),available=useSeasonResult(s=>s.available);if(!closed)return null;
 return <section className="season-finale-card" aria-live="polite" data-season-finale={r?.phase==='complete'?'complete':'awaiting'}><span className="season-final-kicker">{tr('SEASON I · ENDED','第一赛季 · 已结束')}</span>
 {r?.phase==='complete'?<><h3>♛ {r.winner}</h3><p>{tr('Season I champion','第一赛季冠军')}</p><button className="season-button is-primary" onClick={()=>{useSeasonResult.setState({dialog:true});useSeasonVisual.getState().focusNest(r.winner!);}}>{tr('View final result','查看最终结果')}</button></>:<><h3>{tr('Result being verified','结果核验中')}</h3><p>{tr('Gameplay ended at 00:00 São Paulo. We are validating the final scores and official Friday closing prices before announcing the champion.','赛季已于圣保罗时间00:00结束。正在核验最终积分及周五官方收盘价，随后公布冠军。')}</p>{!available&&<small>{tr('Verification service temporarily unavailable. Retrying automatically.','核验服务暂不可用，正在自动重试。')}</small>}</>}
 <small>{tr('Payments: Monday, late morning · São Paulo','奖励发放：周一上午晚些时候 · 圣保罗')}</small></section>;
}
export default function SeasonFinaleHost(){useLanguage(s=>s.language);const {dialog:open,result}=useSeasonResult(),ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{void refreshSeasonResult();const timer=setInterval(()=>void refreshSeasonResult(),10000);const visible=()=>{if(!document.hidden)void refreshSeasonResult();};document.addEventListener('visibilitychange',visible);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visible);};},[]);
 useEffect(()=>{if(!open)return;const previous=document.activeElement as HTMLElement|null;ref.current?.querySelector<HTMLButtonElement>('button')?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopImmediatePropagation();useSeasonResult.setState({dialog:false});}if(e.key==='Tab'){const items=Array.from(ref.current?.querySelectorAll<HTMLElement>('button,a[href]')??[]),first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};window.addEventListener('keydown',key,true);return()=>{window.removeEventListener('keydown',key,true);if(previous?.isConnected)previous.focus();};},[open]);
 if(!open||result?.phase!=='complete')return null;
 return createPortal(<div className="stock-popup-backdrop season-finale-backdrop"><div ref={ref} className="stock-popup season-finale-dialog" role="dialog" aria-modal="true" aria-labelledby="season-finale-title"><header><span className="season-final-kicker">RATTERY · SEASON I</span><button className="stock-popup-close" aria-label={tr('Close','关闭')} onClick={()=>useSeasonResult.setState({dialog:false})}>×</button></header><div className="season-final-crown" aria-hidden="true">♛</div><h2 id="season-finale-title">{result.winner}</h2><p className="season-final-champion">{tr('Season I champion','第一赛季冠军')}</p><ResultDetails/></div></div>,document.body);
}
