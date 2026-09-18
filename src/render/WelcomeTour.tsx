import {useEffect,useRef,useState} from 'react';
import {tr,useLanguage} from '../i18n';

const STORAGE_KEY='rattery:welcome-tour:v1';
function firstVisit(){try{return localStorage.getItem(STORAGE_KEY)!=='done';}catch{return true;}}

/** Local-only onboarding: never connects a wallet or changes colony state. */
export default function WelcomeTour(){
 useLanguage(s=>s.language);
 const [open,setOpen]=useState(firstVisit),[step,setStep]=useState(0);
 const dialog=useRef<HTMLDialogElement>(null),help=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(open){const node=dialog.current;if(node&&!node.open){node.showModal();node.querySelector<HTMLButtonElement>('.tour-next')?.focus();}return()=>node?.close();}},[open]);
 const dismiss=()=>{try{localStorage.setItem(STORAGE_KEY,'done');}catch{/* Storage may be unavailable in private contexts. */}dialog.current?.close();setOpen(false);help.current?.focus();};
 const tips=[
  {title:tr('Welcome to the colony','欢迎来到群落'),text:tr('Would you like a quick look around? Four short tips will help you get started. You can skip at any time.','想快速了解一下吗？四条简短提示将帮助你开始探索。你可以随时跳过。'),detail:tr('Watching is free. No wallet needed.','观看免费，无需连接钱包。')},
  {title:tr('Meet your residents','认识这里的大鼠'),text:tr('Drag to orbit and zoom in for a closer look. Select a rat in the colony or the Residents list to see its story and condition.','拖动以旋转视角，放大以仔细观察。选择场景中的大鼠或居民列表中的名字，查看它的经历和状态。'),detail:tr('Family tree shows relationships. Memorial remembers past residents.','家谱展示亲缘关系，纪念园记录已逝居民。')},
  {title:tr('Read the colony’s mood','了解群落的状态'),text:tr('The panels show needs, stress and social life. Green means things are going well; red marks problems. Trades can influence resources and behaviour.','面板展示需求、压力和社交生活。绿色表示状态良好，红色提示问题。交易可能影响资源和行为。'),detail:tr('These are simulation indicators, not measurements of real animals.','这些是模拟指标，并非真实动物的测量数据。')},
  {title:tr('Settle in','放松观察'),text:tr('Use Hide panels for a clear view and the music note for lo-fi sound. Wallet connection is optional; it is not needed to explore.','使用“隐藏面板”获得开阔视野，点击音符播放低保真音乐。连接钱包是可选的，探索无需钱包。'),detail:import.meta.env.VITE_STAGING==='true'?tr('This is a demo. Real minting and paid care are not enabled.','当前为演示环境，真实铸造与付费照料尚未启用。'):tr('Check availability and costs before any mint or care action. Find this guide again under Help in the footer.','铸造或照料前，请查看可用状态和费用。可在页脚的“帮助”中再次打开本指南。')},
 ];
 const tip=tips[step];
 return <><button ref={help} className="tour-help" type="button" onClick={()=>{setStep(0);setOpen(true);}}>{tr('Help','帮助')}</button>{open&&<dialog ref={dialog} className="welcome-tour" aria-labelledby="tour-title" aria-describedby="tour-description" onCancel={event=>{event.preventDefault();dismiss();}}>
  <div className="tour-heading"><span>RATTERY</span><span aria-label={tr('Tutorial progress','教程进度')}>{step+1} / {tips.length}</span></div>
  <div aria-live="polite" aria-atomic="true"><h2 id="tour-title">{tip.title}</h2><p id="tour-description">{tip.text}</p><p className="tour-detail">{tip.detail}</p></div>
  <div className="tour-dots" aria-hidden="true">{tips.map((_,i)=><span key={i} className={i===step?'current':''}/>)}</div>
  <div className="tour-actions"><button type="button" className="tour-skip" onClick={dismiss}>{tr('Skip','跳过')}</button><button type="button" className="tour-next" autoFocus onClick={()=>step===tips.length-1?dismiss():setStep(s=>Math.min(s+1,tips.length-1))}>{step===tips.length-1?tr('Explore colony','探索群落'):tr('Next','下一步')}<span aria-hidden="true"> →</span></button></div>
 </dialog>}</>;
}
