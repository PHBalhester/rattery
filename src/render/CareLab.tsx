import {useEffect,useState} from 'react';
import WalletConnection from './WalletConnection';
import {useWallet,localCareWalletRequest} from '../wallet';
import {localCareLab} from '../localCareGate';
import {CARE_RULES,type CareAction} from '../sim/care';
import {burnCall,tokenUnits} from '../market/burn';
import {tr,useLanguage} from '../i18n';
type Intent={id:string;rat_id:string;action:CareAction;cost:number;units:string;token:string;chain_id:number;status:string;submission_started_at:string|null;submitted_hash:string|null;expires_at:string};
type View={wallet:string;chainId:number;token:string;decimals:number;revision:number;rats:{id:string;name:string;owner:string|null;energy:number;hydration:number|null;dead:boolean}[];intents:Intent[]};
async function api(op:string,data:unknown={}){
 if(!localCareLab)throw Error('Local lab disabled');
 const response=await fetch('/api/care?op='+op,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(data),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('Action unavailable, expired or cooling down');return response.json();
}
const labels:Record<CareAction,[string,string]>={mint:['Mint','铸造'],name:['Rename','重命名'],feed:['Feed','喂食'],water:['Offer water','提供饮水'],pet:['Pet','抚摸'],play:['Play','玩耍'],treat:['Offer treat','提供零食'],explore:['Explore','探索'],prosocial:['Prosocial stimulus','亲社会刺激'],aggression:['Aggression stimulus','攻击性刺激']};
export default function CareLab(){
 const {language,setLanguage}=useLanguage(),w=useWallet();
 const [view,setView]=useState<View|null>(null),[ratId,setRatId]=useState(''),[action,setAction]=useState<CareAction>('mint'),[name,setName]=useState('Lab Rat');
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[recovery,setRecovery]=useState('');
 const refresh=async()=>{const v=await api('overview') as View;if(v.wallet!==useWallet.getState().account)throw Error('Wallet mismatch');setView(v);setRatId(id=>id||v.rats.find(r=>!r.owner&&!r.dead)?.id||'');};
 useEffect(()=>{setView(null);if(w.authenticated)void refresh().catch(()=>setNotice('Session unavailable. Sign in again.'));},[w.authenticated,w.account]);
 if(!localCareLab)return null;
 const rat=view?.rats.find(r=>r.id===ratId),intent=view?.intents.find(i=>i.rat_id===ratId&&['reserved','review'].includes(i.status));
 const journalKey=(id:string)=>'rattery-local-payment:'+w.account+':'+id;
 async function run(work:()=>Promise<void>){if(busy)return;setBusy(true);setNotice('');try{await work();}catch{setNotice(tr('Action not completed. Refresh or recover the existing payment; do not burn again.','操作未完成，请刷新或恢复现有支付，不要再次销毁。'));}finally{try{await refresh();}catch{/* Keep the last view for recovery. */}setBusy(false);}}
 function validate(i:Intent){
  if(!view||view.wallet!==w.account||i.token!==view.token||i.chain_id!==46630||view.chainId!==46630||i.cost!==CARE_RULES[i.action].cost||BigInt(i.units)!==(i.cost?tokenUnits(i.cost,view.decimals):0n))throw Error('Intent mismatch');
 }
 const reserve=()=>run(async()=>{await api('reserve',{requestId:crypto.randomUUID(),ratId,action,...(['mint','name'].includes(action)?{name}:{})});setNotice(tr('Reserved. Review the amount before confirming.','已预留，请在确认前检查金额。'));});
 const pay=()=>run(async()=>{
  if(!intent||intent.submission_started_at)throw Error('Recovery required');validate(intent);
  if(intent.cost===0){await api('finalize',{id:intent.id});setNotice(tr('Applied in database.','已写入数据库。'));return;}
  const owner=useWallet.getState().account!;
  const balance=await localCareWalletRequest('eth_call',[{to:intent.token,data:'0x70a08231'+owner.slice(2).padStart(64,'0')},'latest']);
  if(typeof balance!=='string'||BigInt(balance)<BigInt(intent.units))throw Error('Insufficient balance');
  // Persist uncertainty before touching the wallet. The server gate prevents a second tab from sending.
  localStorage.setItem(journalKey(intent.id),JSON.stringify({attempted:true}));
  await api('begin',{id:intent.id});
  const hash=await localCareWalletRequest('eth_sendTransaction',[{from:owner,...burnCall(intent.token,BigInt(intent.units))}]);
  if(typeof hash!=='string'||!/^0x[0-9a-f]{64}$/i.test(hash))throw Error('Unknown transaction outcome');
  localStorage.setItem('rattery-local-payment:'+owner+':'+intent.id,JSON.stringify({attempted:true,hash}));
  await api('submitted',{id:intent.id,hash});
  const result=await api('finalize',{id:intent.id,hash});
  setNotice(result.status==='applied'?tr('Applied in database.','已写入数据库。'):tr('Payment recorded for review. Do not pay again.','支付已记录，等待审核，请勿重复支付。'));
 });
 const recover=()=>run(async()=>{
  if(!intent)throw Error('No intent');validate(intent);
  let saved:{hash?:string}={};try{saved=JSON.parse(localStorage.getItem(journalKey(intent.id))||'{}');}catch{/* Manual hash still works. */}
  const hash=intent.submitted_hash||saved.hash||recovery.trim();
  if(intent.cost>0&&(!hash||!/^0x[0-9a-f]{64}$/i.test(hash)))throw Error('Transaction hash needed');
  const result=await api('finalize',{id:intent.id,hash});
  setNotice(result.status==='applied'?tr('Recovered without another burn.','已恢复，无需再次销毁。'):tr('Payment recorded for review. Do not pay again.','支付已记录，等待审核，请勿重复支付。'));
 });
 return <main style={{maxWidth:900,margin:'30px auto',padding:24,background:'#101214',color:'#eee',border:'1px solid #444',overflow:'auto',maxHeight:'90vh'}}>
 <header style={{display:'flex',justifyContent:'space-between',gap:16}}><h1>RATTERY · {tr('Local payment lab','本地支付实验室')}</h1><button className="chip" onClick={()=>setLanguage(language==='en'?'zh':'en')}>EN / CH</button></header>
 <p>{tr('Local mainnet copy · synthetic balances · no real funds. This view reads the database, not the demonstration colony.','本地主网副本 · 模拟余额 · 无真实资金。此界面读取数据库，并非演示群落。')}</p>
 <WalletConnection/>
 {!w.authenticated?<p>{tr('Connect and sign in to begin.','连接并登录以开始。')}</p>:!view?<p>{tr('Loading persistent account…','正在加载持久化账户…')}</p>:<>
 <p>{tr('Database revision','数据库版本')}: <output data-testid="revision">{view.revision}</output></p>
 <label>{tr('Rat','大鼠')} <select aria-label="Rat" value={ratId} disabled={busy} onChange={e=>{setRatId(e.target.value);setNotice('');}}>{view.rats.map(r=><option key={r.id} value={r.id}>{r.name} · {r.id}</option>)}</select></label>
 <p data-testid="owner">{tr('Owner','所有者')}: {rat?.owner||tr('Unminted','未铸造')}</p><p>{tr('Energy','能量')}: <output data-testid="energy">{rat?.energy.toFixed(3)}</output></p>
 <p>{tr('Token contract','代币合约')}: {view.token}</p>
 {intent?<section><h2>{tr('Existing reservation','现有预留')}</h2><p>{labels[intent.action][language==='zh'?1:0]} · {intent.cost.toLocaleString()} {tr('test tokens','测试代币')}</p>
 <p data-testid="payment-state">{intent.status==='review'?tr('Payment received — operator review required','已收到支付 — 需要人工审核'):intent.submission_started_at?tr('Submission started — recovery only','已开始提交 — 仅可恢复'):tr('Reserved — not submitted','已预留 — 尚未提交')}</p>
 <button className="chip" disabled={busy||intent.status!=='reserved'||!!intent.submission_started_at} onClick={()=>void pay()}>{tr('Confirm local payment','确认本地支付')}</button>
 <label>{tr('Transaction hash (if needed)','交易哈希（如需要）')}<input aria-label="Transaction hash" value={recovery} onChange={e=>setRecovery(e.target.value)} maxLength={66}/></label>
 <button className="chip" disabled={busy||intent.status!=='reserved'} onClick={()=>void recover()}>{tr('Recover payment','恢复支付')}</button></section>:<section>
 <label>{tr('Action','操作')} <select aria-label="Action" value={action} onChange={e=>setAction(e.target.value as CareAction)} disabled={busy}>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{tr(...label)}</option>)}</select></label>
 {['mint','name'].includes(action)&&<label>{tr('Name','名字')} <input aria-label="Rat name" value={name} maxLength={32} onChange={e=>setName(e.target.value)} disabled={busy}/></label>}
 <p>{CARE_RULES[action].cost.toLocaleString()} {tr('test tokens burned','测试代币销毁')}</p>
 <button className="chip" disabled={busy||rat?.dead||!!(rat?.owner&&rat.owner!==w.account)} onClick={()=>void reserve()}>{tr('Reserve action','预留操作')}</button></section>}
 <button className="chip" disabled={busy} onClick={()=>void run(refresh)}>{tr('Refresh database','刷新数据库')}</button>
 <p>{tr('A lost wallet response never permits automatic resubmission. Use the transaction hash to recover; uncertain attempts require review.','钱包响应丢失后不会自动重发，请使用交易哈希恢复；结果不明的尝试需要审核。')}</p>
 </>}
 <p role="status">{busy?tr('Working…','处理中…'):notice}</p>
 </main>;
}
