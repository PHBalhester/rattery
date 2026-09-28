import {useEffect,useState,useRef} from 'react';
import {createPortal} from 'react-dom';
import {formatUnits} from 'ethers';
import {tr,useLanguage} from '../i18n';
import {useWallet,seasonTransactionRequest} from '../wallet';
import {useSeason,seasonAPI,refreshSeason,ROUTER,SIGNER} from '../seasonState';
import {seasonApprovalCall,seasonBurnCall,type SeasonQuote} from '../market/seasonBurn';
const names=[['Join a nest','加入巢穴'],['Feed','喂养'],['Shield','护盾'],['Attack','攻击']] as const;
function hydrate(raw:any):SeasonQuote{const q={...raw};for(const k of ['nonce','membership','amount','usdCents','issuedAt','expiresAt'])q[k]=BigInt(q[k]);return q;}
export default function SeasonAction(){
 useLanguage(s=>s.language);const {snapshot,action}=useSeason(),wallet=useWallet(),dialog=useRef<HTMLDivElement>(null),lock=useRef(false);
 const [nest,setNest]=useState(1),[intent,setIntent]=useState<any>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[hash,setHash]=useState(''),[now,setNow]=useState(Date.now());
 const close=()=>{if(!lock.current)useSeason.setState({action:null});};
 useEffect(()=>{setIntent(null);setNotice('');setHash('');setNest(action===1||action===2?snapshot?.member?.nest||1:action===3&&snapshot?.member?.nest===1?2:1);},[action,wallet.account]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{if(action===null)return;const previous=document.activeElement as HTMLElement|null;dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!lock.current){e.stopImmediatePropagation();useSeason.setState({action:null});}if(e.key==='Tab'){const items=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')??[]),first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};window.addEventListener('keydown',key,true);return()=>{window.removeEventListener('keydown',key,true);if(previous?.isConnected)previous.focus();};},[action]);
 if(action===null)return null;
 const ready=wallet.authenticated&&snapshot?.phase==='open'&&useSeason.getState().available;
 const active=intent&&Number(intent.quote.expiresAt)*1000>now+3000;
 async function run(work:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setNotice('');try{await work();}catch(e){setNotice((e as Error).message);}finally{setBusy(false);lock.current=false;void refreshSeason();}}
 const validate=(i:any)=>{if(i.config.router.toLowerCase()!==ROUTER||i.config.quoteSigner.toLowerCase()!==SIGNER||i.config.token.toLowerCase()!=='0xc322305e79337300b59ff48389f8c9a1d9e0de76'||i.quote.wallet.toLowerCase()!==wallet.account||i.quote.kind!==action||i.quote.nest!==nest)throw Error('Unexpected quote');return hydrate(i.quote);};
 const getQuote=()=>run(async()=>{const i=await seasonAPI('quote',{kind:action,nest});const q=validate(i);seasonBurnCall(i.config,q,i.signature);setIntent(i);});
 const approve=()=>run(async()=>{if(!active)throw Error('Quote expired. Get a new quote.');const q=validate(intent);const tx=seasonApprovalCall(intent.config,q);await seasonTransactionRequest(wallet.account!,tx,true);setNotice(tr('Approval submitted. Wait for confirmation, then burn. If the quote expires, get a new one.','授权已提交。确认后执行销毁。若报价过期，请获取新报价。'));});
 const execute=()=>run(async()=>{if(!active)throw Error('Quote expired. Get a new quote.');const q=validate(intent),tx=seasonBurnCall(intent.config,q,intent.signature);const h=String(await seasonTransactionRequest(wallet.account!,tx,true));setHash(h);localStorage.setItem('rattery:season-pending:'+wallet.account,JSON.stringify({quoteHash:intent.quoteHash,hash:h}));setNotice(tr('Transaction submitted. Check its receipt before trying again.','交易已提交，请先检查收据再重试。'));});
 const recover=()=>run(async()=>{const saved=JSON.parse(localStorage.getItem('rattery:season-pending:'+wallet.account)||'null');if(!saved)throw Error('No submitted action to recover.');const r=await seasonAPI('finalize',saved);if(r.confirmed){localStorage.removeItem('rattery:season-pending:'+wallet.account);setHash(saved.hash);setIntent(null);setNotice(tr('Confirmed. Your nest score is recorded onchain.','已确认。巢穴积分已记录在链上。'));}});
 return createPortal(<div className="stock-popup-backdrop"><div ref={dialog} className="stock-popup season-action-dialog" role="dialog" aria-modal="true" aria-labelledby="season-action-title"><header><h2 id="season-action-title">{tr(names[action][0],names[action][1])}</h2><button className="stock-popup-close" disabled={busy} onClick={close} aria-label={tr('Close','关闭')}>×</button></header>
  {!wallet.authenticated?<p><button onClick={()=>{close();useWallet.setState({open:true});}}>{tr('Connect and sign in','连接并登录')}</button></p>:<>
  <div className="season-nest-choice">{['NVDA','AAPL','AMZN'].map((ticker,i)=><button key={ticker} disabled={busy||action===3&&snapshot?.member?.nest===i+1||(action===1||action===2)&&snapshot?.member?.nest!==i+1} aria-pressed={nest===i+1} onClick={()=>{setNest(i+1);setIntent(null);}}>{ticker}<small>{snapshot?.nests[i]?`${snapshot.nests[i].score}${snapshot.nests[i].halfPoint?'.5':''} pts`:''}</small></button>)}</div>
  <p>{tr('The action burns RATTERY. Review the amount and gas in your wallet.','此操作将销毁 RATTERY。请在钱包中核对数量与 gas 费用。')}</p>
  <button disabled={!ready||busy||!!hash} onClick={getQuote}>{tr('Get current quote','获取当前报价')}</button>
  {intent&&<div className="season-quote-review"><strong>{Number(intent.quote.usdCents)/100} USD · {Number(formatUnits(intent.quote.amount,18)).toLocaleString(undefined,{maximumFractionDigits:4})} RATTERY</strong><p>{active?`${Math.max(0,Math.floor((Number(intent.quote.expiresAt)*1000-now)/1000))}s`:tr('Quote expired. Refresh it.','报价已过期，请刷新。')}</p><button disabled={!active||busy||!!hash} onClick={approve}>{tr('1 · Approve exact amount','1 · 授权指定数量')}</button><button disabled={!active||busy||!!hash} onClick={execute}>{tr('2 · Burn & execute','2 · 销毁并执行')}</button></div>}
  <p><button disabled={busy} onClick={recover}>{tr('Check submitted action','检查已提交操作')}</button></p></>}
  {busy&&<p role="status">{tr('Waiting for wallet or confirmation…','等待钱包或确认…')}</p>}{notice&&<p role="status">{notice}</p>}{hash&&<a href={`https://robin.etherscan.io/tx/${hash}`} target="_blank" rel="noopener noreferrer">{tr('View transaction','查看交易')} ↗</a>}
 </div></div>,document.body);
}