import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {tr,useLanguage} from '../i18n';
type Change={percent:number;referenceAt:number;targetAt:number};
type Row={symbol:string;name:string;token:string;price:number|null;at:number|null;status:string;change24h:Change|null;change7d:Change|null};
type Feed={protocol:number;chainId:number;source:string;quotes:Row[]};
const colors:Record<string,string>={NVDA:'#91cf36',AAPL:'#dce6f0',AMZN:'#ffae43'};
const percent=(v:number)=>`${v>0?'+':''}${v.toFixed(2)}%`;
export default function StockPopup({onClose}:{onClose:()=>void}){
 const language=useLanguage(s=>s.language),dialog=useRef<HTMLDivElement>(null);
 const [data,setData]=useState<Feed|null>(null),[error,setError]=useState(false),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0),[now,setNow]=useState(Date.now());
 const date=(v:number)=>new Date(v).toLocaleString(language==='zh'?'zh-CN':'en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo',hour12:false});
 useEffect(()=>{let active=true,timer:ReturnType<typeof setTimeout>;const controller=new AbortController();
  async function refresh(){try{const r=await fetch('/api/season-stocks',{signal:controller.signal});if(!r.ok)throw Error('Unavailable');const j:Feed=await r.json();if(j.protocol!==1||j.chainId!==4663||!Array.isArray(j.quotes)||j.quotes.length!==3||j.quotes.some(q=>!colors[q.symbol]))throw Error('Invalid feed');if(active){setData(j);setError(false);}}catch{if(active)setError(true);}finally{if(active){setLoading(false);timer=setTimeout(refresh,60000);}}}
  setLoading(true);void refresh();return()=>{active=false;controller.abort();clearTimeout(timer);};
 },[retry]);
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(id);},[]);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const before=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
 const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();onClose();}if(e.key==='Tab'){const buttons=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')??[]);const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
 window.addEventListener('keydown',key,true);return()=>{document.body.style.overflow=before;window.removeEventListener('keydown',key,true);const target=previous?.isConnected?previous:Array.from(document.querySelectorAll<HTMLElement>('.season-stocks-toggle,.dock-tab.is-season')).find(e=>e.offsetParent!==null);target?.focus();};
 },[onClose]);
 return createPortal(<div className="stock-popup-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div ref={dialog} className="stock-popup" role="dialog" aria-modal="true" aria-labelledby="stock-popup-title">
  <header><div><span className="stock-popup-kicker">ROBINHOOD CHAIN · SEASON I</span><h2 id="stock-popup-title">{tr('Stock watch','股票行情')}</h2></div><button className="stock-popup-close" onClick={onClose} aria-label={tr('Close stock watch','关闭股票行情')}>×</button></header>
  <p className="stock-popup-intro">{tr('Three nests. Three companies. Follow their token prices.','三个巢穴，三家公司。查看其代币价格。')}</p>
  {loading&&!data&&<p role="status">{tr('Reading prices from Robinhood Chain…','正在读取 Robinhood Chain 价格…')}</p>}
  {error&&<p className="stock-popup-error" role="status">{tr('Price updates are unavailable. Any prices below are the last received observations.','暂时无法更新价格。下方价格为上次收到的数据。')} <button onClick={()=>setRetry(n=>n+1)}>{tr('Retry','重试')}</button></p>}
  <div className="stock-popup-grid">{(data?.quotes??[]).map(q=>{const stale=q.status==='stale'||q.at!==null&&now-q.at>86400000;return <article key={q.symbol} style={{'--stock-color':colors[q.symbol]} as CSSProperties} className="stock-popup-card">
   <div className="stock-popup-company"><span>{q.symbol}</span><small>{q.name}</small></div>
   <strong className="stock-popup-price">{q.price!==null?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(q.price):'—'}</strong>
   <small className="stock-popup-unit">{tr('per Stock Token','每枚股票代币')}</small>
   <div className="stock-popup-changes">{([['24h',q.change24h],['7d',q.change7d]] as const).map(([label,c])=><div key={label}><span>{label==='7d'?tr('7 days','7天'):tr('24 hours','24小时')}</span><b className={c?c.percent>0?'is-up':c.percent<0?'is-down':'':''}>{c?percent(c.percent):'—'}</b>{c&&<small title={tr('Last oracle observation at or before the reference time','参考时间或之前的最后一条预言机报价')}>{tr('From','起点')} {date(c.referenceAt)}</small>}</div>)}</div>
   <p className="stock-popup-time">{q.at?`${tr('Oracle updated','预言机更新')} ${date(q.at)} (BRT)`:tr('Price unavailable','价格不可用')}{q.status==='paused'&&<b>{tr('Oracle paused','预言机暂停')}</b>}{stale&&<b>{tr('Older observation','较早的报价')}</b>}</p>
   <a href={`https://robin.etherscan.io/address/${q.token}`} target="_blank" rel="noopener noreferrer">{tr('View token','查看代币')} ↗</a>
  </article>;})}</div>
  <footer>{tr('Source: Chainlink oracles on Robinhood Chain. Token prices include the issuer’s multiplier. Changes compare oracle snapshots over 24 hours and 7 days; they are not the Season’s weekly points adjustment. Closed markets can retain older observations.','来源：Robinhood Chain 上的 Chainlink 预言机。代币价格包含发行方乘数。涨跌幅比较24小时和7天的预言机快照，并非赛季每周积分调整。休市时可能保留较早报价。')}</footer>
 </div></div>,document.body);
}