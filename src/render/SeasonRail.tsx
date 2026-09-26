import {useEffect,useRef,useState} from 'react';
import {create} from 'zustand';
import {tr,useLanguage} from '../i18n';
import {useCA} from '../store';
import {truncateCA} from '../copy/pons';
import {SEASON_RULES_FINAL,SEASON_STEPS,WHITEPAPER_URL} from '../copy/season';

export const useSeason=create<{tutorial:boolean;open:()=>void;close:()=>void}>(set=>({tutorial:false,open:()=>set({tutorial:true}),close:()=>set({tutorial:false})}));

function Flourish({flip=false}:{flip?:boolean}){
 return <svg className={`season-flourish${flip?' is-flipped':''}`} viewBox="0 0 64 16" aria-hidden="true"><path d="M2 8h38" /><path d="M40 8c6 0 8-6 13-6 4 0 6 3 6 6s-2 6-6 6c-3 0-5-2-5-4" /><path d="M44 8l4-4 4 4-4 4z" className="gem" /><circle cx="6" cy="8" r="1.6" className="gem" /></svg>;
}

/** Title card for Season 1: the left rail entry point. */
export default function SeasonRail(){
 useLanguage(s=>s.language);
 const open=useSeason(s=>s.open);
 return <><aside className="season-rail floating-panel" aria-labelledby="season-title">
  <span className="season-corner tl" aria-hidden="true"/><span className="season-corner tr" aria-hidden="true"/><span className="season-corner bl" aria-hidden="true"/><span className="season-corner br" aria-hidden="true"/>
  <span className="season-kicker">{tr('RATTERY · Colony games','RATTERY · 群落赛事')}</span>
  <div className="season-title-row"><Flourish/><h2 id="season-title" lang="en">Season&nbsp;<span>I</span></h2><Flourish flip/></div>
  <p className="season-sub">{tr('Burn · Care · Win tokenized stocks','销毁 · 照护 · 赢取代币化股票')}</p>
  <span className="season-status"><i aria-hidden="true"/>{tr('Coming soon','即将开始')}</span>
  <div className="season-actions">
   <button type="button" className="season-button is-primary" onClick={open}><span aria-hidden="true">▶</span>{tr('Tutorial','教程')}</button>
   {WHITEPAPER_URL?<a className="season-button" href={WHITEPAPER_URL} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">§</span>{tr('Whitepaper','白皮书')}</a>:<button type="button" className="season-button" disabled title={tr('Published before the season starts','赛季开始前发布')}><span aria-hidden="true">§</span>{tr('Whitepaper','白皮书')}<small>{tr('soon','即将')}</small></button>}
  </div>
 </aside><SeasonTutorial/></>;
}

/** Compact entry for phones, where the rail is hidden. */
export function SeasonNavButton(){
 useLanguage(s=>s.language);
 return <button type="button" className="season-nav-button" onClick={useSeason.getState().open}>✦ Season I · {tr('Tutorial','教程')}</button>;
}

function SeasonTutorial(){
 useLanguage(s=>s.language);
 const {tutorial,close}=useSeason(),ca=useCA();
 const [step,setStep]=useState(0),dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=dialog.current;if(tutorial&&node&&!node.open){setStep(0);node.showModal();}if(!tutorial&&node?.open)node.close();},[tutorial]);
 const s=SEASON_STEPS[step],last=step===SEASON_STEPS.length-1;
 return <dialog ref={dialog} className="season-tutorial" aria-labelledby="season-tutorial-title" onClose={close} onCancel={close} onClick={e=>{if(e.target===dialog.current)close();}}>
  <header className="season-tutorial-head">
   <div><span className="season-kicker">{tr('How to play','玩法')}</span><h2 id="season-tutorial-title" lang="en">Season <span>I</span></h2></div>
   <button type="button" className="season-close" aria-label={tr('Close tutorial','关闭教程')} onClick={close}>×</button>
  </header>
  {!SEASON_RULES_FINAL&&<p className="season-draft">{tr('Draft rules. Final dates, scoring and prizes are published before launch.','规则草案。最终日期、计分和奖励将在上线前公布。')}</p>}
  <ol className="season-progress" aria-label={tr('Tutorial steps','教程步骤')}>{SEASON_STEPS.map((x,i)=><li key={i}><button type="button" aria-current={i===step?'step':undefined} data-done={i<step||undefined} onClick={()=>setStep(i)}><span>{i+1}</span><small>{tr(...x.title)}</small></button></li>)}</ol>
  <section className="season-step" key={step} aria-live="polite">
   <div className="season-step-icon" aria-hidden="true">{s.icon}</div>
   <span className="season-step-count">{tr('Step','第')} {step+1}{tr(` of ${SEASON_STEPS.length}`,` 步，共 ${SEASON_STEPS.length} 步`)}</span>
   <h3>{tr(...s.title)}</h3>
   <p>{tr(...s.body)}</p>
   {s.tip&&<p className="season-tip"><b>{tr('Tip','提示')}</b>{tr(...s.tip)}</p>}
   {last&&<p className="season-ca">{tr('Official contract','官方合约')}: <code title={ca??''}>{ca?truncateCA(ca):tr('announced at launch','上线时公布')}</code></p>}
  </section>
  <footer className="season-tutorial-foot">
   <button type="button" className="season-button" disabled={step===0} onClick={()=>setStep(step-1)}>← {tr('Back','上一步')}</button>
   {last?<button type="button" className="season-button is-primary" onClick={close}>{tr('Got it, explore the colony','明白了，探索群落')}</button>:<button type="button" className="season-button is-primary" onClick={()=>setStep(step+1)}>{tr('Next','下一步')} →</button>}
  </footer>
 </dialog>;
}
