import {useEffect,useRef,useState} from 'react';
import {tr,useLanguage} from '../i18n';
const KEY='rattery:welcome-explainer:v2';
function firstVisit(){try{return localStorage.getItem(KEY)!=='done';}catch{return true;}}
export default function WelcomeTour(){
 useLanguage(s=>s.language);
 const [open,setOpen]=useState(firstVisit);
 const dialog=useRef<HTMLDialogElement>(null),help=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const node=dialog.current;if(open&&node&&!node.open)node.showModal();return()=>node?.close();},[open]);
 function dismiss(){try{localStorage.setItem(KEY,'done');}catch{/* Optional browser preference. */}dialog.current?.close();setOpen(false);help.current?.focus();}
 return <><button ref={help} type="button" className="tour-help" onClick={()=>setOpen(true)}>{tr('How it works','如何运作')}</button>{open&&<dialog ref={dialog} className="welcome-tour colony-explainer" aria-labelledby="tour-title" onCancel={e=>{e.preventDefault();dismiss();}}>
 <div className="tour-heading"><span>RATTERY / {tr('THE BASICS','基础介绍')}</span><button type="button" aria-label={tr('Close guide','关闭指南')} onClick={dismiss}>×</button></div>
 <h2 id="tour-title">{tr('A living colony. A shared world.','生机勃勃的共享群落。')}</h2>
 <p>{tr('Everyone watches the same digital rats. They explore, rest, form relationships and grow older—even when you leave.','每个人都在观察同一群数字大鼠。它们探索、休息、建立关系并逐渐变老，即使你离开也会继续。')}</p>
 <ol className="explainer-steps">
 <li><strong>{tr('Trades change their environment','交易改变环境')}</strong><p>{tr('Yes, token trading matters. Buys can support resources and exploration. Sells can add pressure and stress. Reactions depend on the colony’s condition, trade size and cooldowns.','代币交易会产生影响。买入可支持资源与探索，卖出可增加压力。反应取决于群落状态、交易规模和冷却时间。')}</p></li>
 <li><strong>{tr('Choose a rat to help','选择一只大鼠提供帮助')}</strong><p>{tr('Select a rat, then open its care actions to name it, offer food or water, or play. Paid actions burn RATTERY permanently; review the cost and availability before confirming. Naming is recorded in the project, not as an NFT.','选择一只大鼠，查看照护操作，为它命名、提供食物或水、或玩耍。付费操作永久销毁RATTERY；确认前请检查费用和可用性。命名记录在项目内，不是NFT。')}</p></li>
 <li><strong>{tr('Check what they need','查看它们的需求')}</strong><p>{tr('Colony status shows current needs and alerts. Open an alert to find affected rats. Temporary assisted care, when active, reduces negative effects.','群落状态显示当前需求和警报。打开警报可查看受影响的大鼠。临时照护启用时会减少负面影响。')}</p></li>
 </ol>
 <details><summary>{tr('A few more things to know','更多须知')}</summary><p>{tr('Unminted rats can receive care from any wallet; minted rats require their owner. Cooldowns apply. The snake is a separate harmful action that can kill an eligible rat. Behaviour is simulated, not a scientific measurement.','未铸造的大鼠可由任何钱包照护；已铸造的大鼠需由所有者照护。操作有冷却时间。蛇是独立的有害操作，可能杀死符合条件的大鼠。行为属于模拟，并非科学测量。')}</p></details>
 <p className="tour-detail">{tr('Free to watch. No wallet needed. Drag to look around, or use Meet the rats to choose a resident.','免费观看，无需钱包。拖动以环顾，或通过“认识大鼠”选择居民。')}</p>
 <button type="button" className="tour-next" autoFocus onClick={dismiss}>{tr('Explore the colony','探索群落')} →</button>
 </dialog>}</>;
}
