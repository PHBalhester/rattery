import PaidCare from './PaidCare';
import {mainnetPayments} from '../paymentMode';
import {useWallet,stagingSignIn} from '../wallet';
import {useState} from 'react';
import {getWorld,useStore} from '../store';
import {tr,locale} from '../i18n';
import {DEMO_WALLETS,demoCare,type CareAction} from '../sim/care';
import CareActionPicker from './CareActionPicker';
import {ratNeeds} from './ratNeeds';
export default function RatCare(){
 const connected=useWallet(s=>s.account),authenticated=useWallet(s=>s.authenticated);
 const version=useStore(s=>s.version);void version;const focused=useStore(s=>s.focusedId),status=useStore(s=>s.feedStatus),world=getWorld();
 const [wallet,setWallet]=useState<string>(DEMO_WALLETS[0]),[name,setName]=useState(''),[message,setMessage]=useState<[string,string]|null>(null),[naming,setNaming]=useState<CareAction|null>(null);
 const rat=focused?world.rats[focused]:undefined;
 if(mainnetPayments)return <PaidCare ratId={focused}/>;
 if(!rat||rat.deadAt!==null)return null;
 const owner=world.care?.owners[rat.id],demo=status==='demo',allowed=demo&&(!owner||owner===wallet);
 function act(action:CareAction){try{if(useStore.getState().feedStatus!=='demo')throw Error('Payments unavailable');demoCare(getWorld(),wallet,rat!.id,action,Date.now(),name||rat!.name);setMessage(['Action completed. Test tokens burned.','操作完成，测试代币已销毁。']);useStore.setState(s=>({version:s.version+1}));}catch(e){const errors:Record<string,[string,string]>={'Only owner may interact':['Only the owner can interact.','仅所有者可互动。'],'Cooldown active':['This action is cooling down.','此操作处于冷却期。'],'Already satiated':['This rat is already satiated.','这只大鼠已经吃饱。'],'Rat busy or needs rest':['This rat is busy or needs rest.','这只大鼠正忙或需要休息。'],'Invalid name':['Enter a valid name (1–24 characters).','请输入有效名字（1–24个字符）。'],'Insufficient test tokens':['Not enough test tokens.','测试代币不足。'],'Water unavailable or not needed':['Water is unavailable or not needed now.','当前无法提供饮水或无需饮水。'],'Adults only':['Adults only.','仅适用于成年个体。'],'No acute stress to relieve':['No acute stress to relieve.','暂无需要缓解的急性压力。']};setMessage(errors[(e as Error).message]??['Action unavailable. Check ownership, needs and cooldown.','操作不可用，请检查所有权、需求和冷却时间。']);}}
 const suggested=ratNeeds(rat).flatMap(n=>n.actions);
 const cooldown=(action:CareAction)=>{const key=rat.id+':'+(['prosocial','aggression'].includes(action)?'stimulus':action);return Math.max(0,(world.care?.cooldowns[key]??0)-Date.now());};
 function pick(action:CareAction){if(['mint','name'].includes(action)){setNaming(action);setMessage(null);return;}setNaming(null);act(action);}
 return <section className="rat-care"><div className="panel-head"><span>{tr('Care for this rat','照护这只大鼠')}</span><span>{owner?`${tr('Owner','所有者')}: ${owner.slice(0,6)}…${owner.slice(-4)}`:tr('Not minted · any wallet may help','尚未铸造 · 任何钱包均可帮助')}</span></div>
 {stagingSignIn&&<div className="wallet-scope"><strong>{tr('Persistent wallet account','持久化钱包账户')}</strong><p>{authenticated?tr('Signed in. Paid interactions await a validated testnet token and the authoritative colony connection.','已登录。付费互动仍需验证测试网代币并连接权威群落服务。'):tr('Connect and sign in to verify your wallet. The demonstration below stays separate from your account.','连接并登录以验证您的钱包。下方演示与您的账户相互独立。')}</p><button className="chip" onClick={()=>useWallet.setState({open:true})}>{tr('Open wallet account','打开钱包账户')}</button></div>}
 {demo?<div className="demo-notice"><b>{tr('Demo mode · fictional tokens','演示模式 · 虚拟代币')}</b><label>{tr('Test account','测试账户')}<select value={wallet} onChange={e=>setWallet(e.target.value)}><option value={DEMO_WALLETS[0]}>A</option><option value={DEMO_WALLETS[1]}>B</option></select></label><span>{tr('Balance','余额')}: {(world.demoToken?.balances[wallet]??5000000).toLocaleString(locale())} · {tr('Burned','已销毁')}: {(world.care?.burned??0).toLocaleString(locale())}</span></div>:<div><button className="chip" onClick={()=>useWallet.setState({open:true})}>{connected?tr('View connected wallet','查看已连接钱包'):tr('Connect wallet','连接钱包')}</button><p>{tr('Paid care awaits the RATTERY token and payment service.','付费照护尚待RATTERY代币和支付服务配置完成。')}</p></div>}
 {demo&&owner&&owner!==wallet&&<p className="permission-note">{tr('Only the owner can provide care. Observation stays public.','仅所有者可以照护，观察仍向所有人开放。')}</p>}
 <CareActionPicker owned={!!owner} selected={naming} suggested={suggested} disabled={a=>!allowed||cooldown(a)>0} note={a=>cooldown(a)>0?`${Math.ceil(cooldown(a)/60000)} ${tr('min','分钟')}`:undefined} onPick={pick}/>
 {naming&&<div className="care-name-form"><label>{tr('Name','名字')}<input aria-label={tr('Rat name','大鼠名字')} maxLength={24} value={name} onChange={e=>setName(e.target.value)} placeholder={rat.name}/></label><div className="care-button-row"><button className="chip chip-accent" disabled={!allowed} onClick={()=>{act(naming);setNaming(null);}}>{naming==='mint'?tr('Confirm mint','确认铸造'):tr('Confirm rename','确认重命名')}</button><button className="chip" onClick={()=>setNaming(null)}>{tr('Cancel','取消')}</button></div></div>}
 <p role="status" className="care-status">{message&&tr(...message)}</p>
 <details className="readout-details care-rules"><summary>{tr('Rules & costs','规则与费用')}</summary><p>{tr('Every action burns RATTERY permanently. Cooldowns apply per rat and action.','每项操作都会永久销毁RATTERY。冷却时间按个体和操作计算。')}</p><p>{tr('Boosters are fictional simulation effects for adult rats. Each burns 100,000 RATTERY and biases social interactions for 2 real hours. Only one can be active; both share the same cooldown. Encounters still depend on proximity and affinity.','增强剂是仅适用于成年大鼠的虚构模拟效果。每次销毁100,000枚RATTERY，并在现实2小时内影响社交互动。两种效果不可同时启用，且共享冷却时间。互动仍取决于距离和亲和度。')}</p></details></section>;
}
