import {useEffect,useRef,useState} from 'react';
import {useStore} from '../store';
import {useWallet,mainnetBurnRequest} from '../wallet';
import {mainnetPayments,PAYMENT_TOKEN} from '../paymentMode';
import {CARE_RULES,type CareAction} from '../sim/care';
import {tokenUnits} from '../market/burn';
import {tr,locale,useLanguage} from '../i18n';
type Intent={id:string;rat_id:string;action:CareAction;name:string|null;cost:number;units:string;token:string;chain_id:number;status:string;submission_started_at:string|null;submitted_hash:string|null;expires_at:string};
type View={residence?:{verified_ms:string;checked_at:string;value_micros:string;status:string}|null;wallet:string;chainId:number;token:string;decimals:number;revision:number;rats:{id:string;name:string;owner:string|null;dead:boolean}[];intents:Intent[]};
const labels:Record<CareAction,[string,string]>={mint:['Mint rat','铸造大鼠'],name:['Rename','重命名'],feed:['Feed','喂食'],water:['Offer water','提供饮水'],pet:['Gentle petting','温柔抚摸'],play:['Play','玩耍'],treat:['Offer treat','提供零食'],explore:['Invite to explore','邀请探索'],prosocial:['Sociability booster','社交增强剂'],aggression:['Irritability booster','易怒增强剂']};
const explanations:Record<CareAction,[string,string]>={
 mint:['Register ownership of this rat and choose its name. Only your wallet can provide care afterward. This is not an NFT.','登记此大鼠的所有权并命名，此后仅您的钱包可提供照护。这不是NFT。'],
 name:['Change the name of your rat for free.','免费更改您拥有的大鼠的名字。'],
 feed:['Restore up to 15 energy points, limited by satiety.','恢复最多15点能量，受饱腹程度限制。'],
 water:['Restore up to 15 hydration points.','恢复最多15点水分。'],
 pet:['Reduce acute stress by up to 5 points, depending on receptivity. A heart briefly appears after confirmation.','根据接受程度降低最多5点急性压力。确认后会短暂显示爱心。'],
 play:['Encourage play, use 3 energy points and reduce cortisol by up to 3 points. The rat must be available to play.','鼓励玩耍，消耗3点能量并降低最多3点皮质醇。大鼠必须处于可玩耍状态。'],
 treat:['Restore up to 5 energy points and increase the simulated dopamine index by up to 10 points.','恢复最多5点能量，并将模拟多巴胺指数提高最多10点。'],
 explore:['End the current exploration rest period so the rat can explore again. It does not force a destination.','结束当前探索休息期，让大鼠可以再次探索，不强制指定目的地。'],
 prosocial:['A fictional effect for adults that encourages affinity with nearby rats for 2 real hours. It does not guarantee friendship.','仅适用于成年大鼠的虚构效果，在现实2小时内促进与附近大鼠的亲近，但不保证建立友谊。'],
 aggression:['A fictional effect for adults that reduces affinity with nearby rats for 2 real hours. It does not guarantee a fight.','仅适用于成年大鼠的虚构效果，在现实2小时内降低与附近大鼠的亲近，但不保证发生争斗。'],
};
function CareHelp(){
 const dialog=useRef<HTMLDialogElement>(null);
 return <><button type="button" className="chip care-help-button" aria-label={tr('Explain mint and care','了解铸造与照护')} aria-haspopup="dialog" onClick={()=>dialog.current?.showModal()}>?</button>
 <dialog ref={dialog} className="wallet-dialog care-help-dialog" aria-labelledby="care-help-title">
 <header><h2 id="care-help-title">{tr('Mint & care guide','铸造与照护指南')}</h2><button type="button" className="chip" aria-label={tr('Close help','关闭帮助')} onClick={()=>dialog.current?.close()}>×</button></header>
 <p>{tr('Every paid action permanently burns RATTERY. Network fees are separate and paid in ETH. Review the action before confirming in your wallet.','每项付费操作都会永久销毁RATTERY。网络费用另以ETH支付。请在钱包确认前核对操作。')}</p>
 <dl>{(Object.keys(labels) as CareAction[]).map(action=><div className="care-help-item" key={action}><dt>{tr(...labels[action])}</dt><dd><strong>{CARE_RULES[action].cost.toLocaleString(locale())} RATTERY</strong> · {CARE_RULES[action].hours?tr(`Once every ${CARE_RULES[action].hours} real hours`,`每${CARE_RULES[action].hours}个现实小时一次`):tr('Once per rat','每只大鼠一次')}<p>{tr(...explanations[action])}</p></dd></div>)}</dl>
 <p>{tr('The two boosters share a 2-hour cooldown and cannot stack. Care may be unavailable when a rat is busy, resting, satiated or dead. These are simulation indices, not medical measurements.','两种增强剂共享2小时冷却且不可叠加。大鼠忙碌、休息、饱腹或死亡时，部分照护不可用。这些是模拟指数，不是医学测量值。')}</p>
 <button type="button" className="chip chip-accent" onClick={()=>dialog.current?.close()}>{tr('Got it','明白了')}</button>
 </dialog></>;
}
async function api(op:string,data:unknown={}){
 if(!mainnetPayments)throw Error('Unavailable');
 const response=await fetch('/api/payment?op=care/'+op,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error(response.status===401?'Session expired':'Unavailable');return response.json();
}
export default function PaidCare({ratId}:{ratId:string|null}){
 useLanguage(s=>s.language);const w=useWallet();
 const [view,setView]=useState<View|null>(null),[action,setAction]=useState<CareAction>('mint'),[name,setName]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[hash,setHash]=useState(''),[selected,setSelected]=useState('');
 const locked=useRef(false),request=useRef<{key:string;id:string}|null>(null);
 const refresh=async()=>{const v=await api('overview') as View;if(v.wallet!==useWallet.getState().account||v.chainId!==4663||v.token!==PAYMENT_TOKEN||v.decimals!==18||!Array.isArray(v.intents)||!Array.isArray(v.rats))throw Error('Account mismatch');setView(previous=>previous?.wallet===v.wallet&&previous.revision>v.revision?previous:v);};
 useEffect(()=>{setView(null);setSelected('');setNotice('');if(!w.authenticated)return;let live=true;const update=()=>{if(live&&!locked.current)void refresh().catch(()=>{if(live)setNotice(tr('Account unavailable. Reconnect or retry.','账户暂不可用，请重新连接或重试。'));});};update();const timer=setInterval(update,10000);return()=>{live=false;clearInterval(timer)};},[w.authenticated,w.account]);
 useEffect(()=>{setSelected('');setName('');setHash('');setAction('mint');request.current=null;},[ratId]);
 const rat=view?.rats.find(r=>r.id===ratId),pending=view?.intents.filter(i=>['reserved','review'].includes(i.status))??[],intent=pending.find(i=>i.id===selected)??pending.find(i=>i.rat_id===ratId);
 const journal=(id:string,owner=w.account)=>'rattery-payment:4663:'+owner+':'+id;
 let saved:{attempted?:boolean;hash?:string}={};try{if(intent)saved=JSON.parse(localStorage.getItem(journal(intent.id))||'{}');}catch{/* The server still prevents a second submission. */}
 function validate(i:Intent){if(!view||view.wallet!==useWallet.getState().account||i.token!==PAYMENT_TOKEN||i.chain_id!==4663||!Object.prototype.hasOwnProperty.call(CARE_RULES,i.action)||i.cost!==CARE_RULES[i.action].cost||BigInt(i.units)!==(i.cost?tokenUnits(i.cost,18):0n)||! /^[0-9a-f-]{36}$/.test(i.id))throw Error('Reservation mismatch');}
 async function run(work:()=>Promise<void>){if(locked.current)return;locked.current=true;setBusy(true);setNotice('');try{await work();}catch{setNotice(tr('Could not complete. Refresh your account; if a transaction was sent, recover it without paying again.','未能完成。请刷新账户；若交易已发送，请恢复原交易，不要重复支付。'));}finally{try{await refresh();}catch{}locked.current=false;setBusy(false);}}
 const reserve=()=>run(async()=>{if(!rat)throw Error('Select rat');const chosen=rat.owner&&action==='mint'?'name':action;const key=JSON.stringify([rat.id,chosen,name]);if(request.current?.key!==key)request.current={key,id:crypto.randomUUID()};const i=await api('reserve',{requestId:request.current.id,ratId:rat.id,action:chosen,...(['mint','name'].includes(chosen)?{name:name.trim()||rat.name}:{})}) as Intent;validate(i);setSelected(i.id);setNotice(tr('Reserved. Review the amount, then confirm.','已预留，请核对金额后确认。'));});
 const pay=()=>run(async()=>{if(!intent||intent.status!=='reserved')throw Error('No reservation');validate(intent);if(intent.cost===0){await api('finalize',{id:intent.id});setNotice(tr('Name updated.','名字已更新。'));return;}
 if(intent.submission_started_at||saved.attempted||Date.now()>=Number(intent.expires_at))throw Error('Recovery required');
 const owner=w.account!;const balance=await mainnetBurnRequest(owner,BigInt(intent.units));if(typeof balance!=='string'||!/^0x[0-9a-f]+$/i.test(balance)||BigInt(balance)<BigInt(intent.units)){setNotice(tr('Insufficient RATTERY balance.','RATTERY余额不足。'));return;}
 localStorage.setItem(journal(intent.id,owner),JSON.stringify({attempted:true}));await api('begin',{id:intent.id});
 const result=await mainnetBurnRequest(owner,BigInt(intent.units),true);if(typeof result!=='string'||!/^0x[0-9a-f]{64}$/i.test(result))throw Error('Unknown outcome');
 try{localStorage.setItem(journal(intent.id,owner),JSON.stringify({attempted:true,hash:result}));}catch{/* Record on the server even if storage fills. */}
 setHash(result);await api('submitted',{id:intent.id,hash:result});setNotice(tr('Transaction sent. Confirmation continues automatically; do not pay again.','交易已发送，将自动继续确认，请勿重复支付。'));
 });
 const recover=()=>run(async()=>{if(!intent)throw Error('No reservation');validate(intent);const receipt=intent.submitted_hash||saved.hash||hash.trim();if(intent.cost&&(!receipt||!/^0x[0-9a-f]{64}$/i.test(receipt)))throw Error('Transaction hash required');const result=await api('finalize',{id:intent.id,hash:receipt});setNotice(result.status==='applied'?tr('Confirmed and applied. No second burn.','已确认并生效，无需再次销毁。'):tr('Burn recorded for review. Do not pay again.','销毁已记录并待审核，请勿重复支付。'));});
 if(!mainnetPayments)return null;
 return <section className="rat-care paid-care"><div className="panel-head"><strong>{tr('Mint & care','铸造与照护')}</strong><CareHelp/></div>
 {!w.authenticated?<><p>{tr('Connect and sign in to mint or care for a rat. Observation is free.','连接并登录以铸造或照护大鼠，观察始终免费。')}</p><button className="chip" onClick={()=>useWallet.setState({open:true})}>{tr('Open wallet','打开钱包')}</button></>:!view?<p>{tr('Loading account…','正在加载账户…')}</p>:<>
 <label>{tr('Choose a rat','选择大鼠')}<select aria-label={tr('Choose a rat for mint and care','选择要铸造或照护的大鼠')} value={rat?.dead?'':rat?.id??''} disabled={busy} onChange={e=>useStore.getState().focus(e.target.value||null)}><option value="">{tr('Select a living rat…','选择存活的大鼠…')}</option>{view.rats.filter(r=>!r.dead).map(r=><option key={r.id} value={r.id}>{r.name}{r.owner===w.account?tr(' · Yours',' · 您的'):r.owner?tr(' · Owned',' · 已有主人'):''}</option>)}</select></label>
 <div className="care-explanation"><strong>{tr('Residence · 7 / 30 / 90 days','居住时间 · 7 / 30 / 90天')}</strong><p>{tr('Keep at least US$100 in RATTERY at the current verified price. Falling below resets progress, including price drops and burns. Recognition only; no financial reward.','按当前已验证价格持有至少100美元的RATTERY。低于门槛将重置进度，包括价格下跌及销毁。仅为身份认可，无财务奖励。')}</p><p>{view.residence?`${(Number(view.residence.verified_ms)/86400000).toFixed(2)} ${tr('verified days','已验证天数')} · ${view.residence.status==='eligible'&&Date.now()-Number(view.residence.checked_at)<180000?tr('Qualifying','符合条件'):view.residence.status==='below-threshold'?tr('Below US$100','低于100美元'):tr('Verification pending','等待验证')}`:tr('Verification begins after signed login. No past holding time is assumed.','签名登录后开始验证，不推定之前的持有时间。')}</p></div>
 {pending.length>0&&<details open><summary>{tr('Pending actions','待处理操作')} ({pending.length})</summary>{pending.map(i=><button className="chip" key={i.id} disabled={busy} onClick={()=>{setSelected(i.id);setHash('')}}>{tr(...labels[i.action])} · {view.rats.find(r=>r.id===i.rat_id)?.name??i.name??i.rat_id}</button>)}</details>}
 {intent?<div className="payment-confirmation"><strong>{tr(...labels[intent.action])} · {intent.name??view.rats.find(r=>r.id===intent.rat_id)?.name??intent.rat_id}</strong><p>{intent.cost.toLocaleString(locale())} RATTERY · {tr('burned permanently','永久销毁')}</p><p>{intent.status==='review'?tr('Payment recorded. Resolution pending; do not pay again.','支付已记录，等待处理，请勿重复支付。'):intent.submission_started_at||saved.attempted?tr('Submission started. Recover the existing transaction.','已开始提交，请恢复现有交易。'):tr('This registers ownership/care in RATTERY. Network fees are paid separately in ETH.','此操作在RATTERY记录所有权或照护，网络费用另以ETH支付。')}</p>
 <div className="care-button-row">
 <button className="chip chip-accent" disabled={busy||intent.status!=='reserved'||(intent.cost>0&&(!!intent.submission_started_at||!!saved.attempted||Date.now()>=Number(intent.expires_at)))} onClick={()=>void pay()}>{intent.cost?tr('Confirm Burn','确认销毁'):tr('Confirm free rename','确认免费重命名')}</button>
{!intent.submission_started_at&&intent.status==='reserved'&&<button className="chip" disabled={busy} onClick={()=>void run(async()=>{await api('cancel',{id:intent.id});request.current=null;setSelected('');})}>{tr('Cancel','取消')}</button>}
 </div>
 {(intent.submission_started_at||saved.attempted)&&<><label>{tr('Transaction hash','交易哈希')}<input value={hash} maxLength={66} onChange={e=>setHash(e.target.value)} placeholder="0x…"/></label><button className="chip" disabled={busy||intent.status!=='reserved'} onClick={()=>void recover()}>{tr('Recover transaction','恢复交易')}</button></>}
 </div>:rat&&!rat.dead?<><p>{rat.owner?rat.owner===w.account?tr('You own this rat.','您拥有这只大鼠。'):tr('Only the owner can provide care.','仅所有者可提供照护。'):tr('Unminted · any wallet may provide care.','尚未铸造 · 任何钱包均可照护。')}</p><label>{tr('Action','操作')}<select value={rat.owner&&action==='mint'?'name':action} onChange={e=>setAction(e.target.value as CareAction)} disabled={busy}>{(Object.keys(labels) as CareAction[]).filter(a=>rat.owner?a!=='mint':a!=='name').map(a=><option key={a} value={a}>{tr(...labels[a])} · {CARE_RULES[a].cost.toLocaleString(locale())} RATTERY</option>)}</select></label>{['mint','name'].includes(action)&&<label>{tr('Name','名字')}<input maxLength={24} value={name} onChange={e=>setName(e.target.value)} placeholder={rat.name}/></label>}<p>{tr('Paid actions burn RATTERY. Ownership is recorded in the project, without an NFT.','付费操作会销毁RATTERY，所有权记录在项目内，不发行NFT。')}</p>{action==='pet'&&<p className="care-explanation">{tr('Gentle petting reduces acute stress by up to 5 points, depending on receptivity. Cooldown: 1 hour. A heart appears above the rat after confirmation.','温柔抚摸可根据接受程度降低最多5点急性压力。冷却时间为1小时，确认后大鼠上方会显示爱心。')}</p>}{['prosocial','aggression'].includes(action)&&<p>{tr('Fictional behavioural effect for adults: 2 real hours, shared cooldown, no stacking.','仅适用于成年个体的虚构行为效果：持续现实2小时，共享冷却时间，不可叠加。')}</p>}<button className="chip" disabled={busy||!!(rat.owner&&rat.owner!==w.account)} onClick={()=>void reserve()}>{tr('Review action & cost','核对操作与费用')}</button></>:<p>{tr('Select a living rat to view actions. Pending payments remain recoverable here.','选择存活的大鼠以查看操作，待处理支付仍可在此恢复。')}</p>}
 {view.intents.filter(i=>i.status==='applied').slice(0,3).map(i=><p className="care-success" key={i.id}>{tr('Applied','已生效')} · {tr(...labels[i.action])} · {view.rats.find(r=>r.id===i.rat_id)?.name??i.rat_id}{i.action==='pet'?tr(' — acute stress reduced according to receptivity.',' — 已根据接受程度降低急性压力。'):''}</p>)}
 <button className="chip care-refresh" disabled={busy} onClick={()=>void run(async()=>{await refresh();setNotice(tr('Account updated. Choose a living rat above to view mint and care actions.','账户已更新。请在上方选择存活的大鼠以查看铸造与照护操作。'));})}>{tr('Check status','查看状态')}</button></>}
 <p role="status">{busy?tr('Working…','处理中…'):notice}</p></section>;
}
