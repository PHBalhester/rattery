import {NEST_DESIGNS,TIER_NAMES,VISUAL_TIERS,visualTier,useSeasonVisual,type NestId,type VisualEvent} from '../season/visualState';
import {setTutorialStage} from './tutorialStage';
import {useEffect,useRef,useState,type CSSProperties,type PointerEvent as ReactPointerEvent,type ReactNode} from 'react';

/** Counts towards `value` with an ease-out, like a scoreboard. Instant under reduced motion. */
function useCount(value:number){
 const [shown,setShown]=useState(value);const from=useRef(value);
 useEffect(()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches){setShown(value);from.current=value;return;}
  const start=performance.now(),a=from.current;let raf=0;
  const step=(t:number)=>{const k=Math.min(1,(t-start)/650),e=1-(1-k)**3;const v=Math.round(a+(value-a)*e);setShown(v);from.current=v;if(k<1)raf=requestAnimationFrame(step);};
  raf=requestAnimationFrame(step);return()=>cancelAnimationFrame(raf);},[value]);
 return shown;
}
/** Adds a ripple at the pointer; purely decorative. */
function ripple(e:ReactPointerEvent<HTMLButtonElement>){const b=e.currentTarget,r=b.getBoundingClientRect();b.style.setProperty('--rx',`${e.clientX-r.left}px`);b.style.setProperty('--ry',`${e.clientY-r.top}px`);b.classList.remove('is-rippling');void b.offsetWidth;b.classList.add('is-rippling');}

const EFFECT_MS:Record<VisualEvent['kind']|'winner',number>={feed:4000,shield:3600,attack:9000,winner:7000};
function Action({label,aria,icon,onClick,busy,accent,hint}:{label:string;aria:string;icon:ReactNode;onClick:()=>void;busy?:number;accent?:boolean;hint:string}){
 return <button type="button" className={`nest-action${accent?' is-accent':''}${busy?' is-busy':''}`} aria-label={aria} title={hint} onPointerDown={ripple} onClick={onClick} style={busy?{'--busy-ms':`${busy}ms`} as CSSProperties:undefined}>
  <span className="nest-action-icon" aria-hidden="true">{icon}</span><span className="nest-action-label">{label}</span><i className="nest-action-progress" aria-hidden="true"/>
 </button>;
}
const Icon={
 view:<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/></svg>,
 feed:<svg viewBox="0 0 24 24"><path d="M12 3c3 3 5 6 5 9a5 5 0 01-10 0c0-3 2-6 5-9z"/><path d="M12 10v6"/></svg>,
 shield:<svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/></svg>,
 snake:<svg viewBox="0 0 24 24"><path d="M4 18c3 0 3-4 6-4s3 4 6 4 3-6 0-8-6-1-6-4 3-3 6-2"/><circle cx="17" cy="4.5" r="1"/></svg>,
 crown:<svg viewBox="0 0 24 24"><path d="M4 17l-1-10 5 4 4-6 4 6 5-4-1 10z"/><path d="M4 20h16"/></svg>,
};

function NestCard({id}:{id:NestId}){
 const d=NEST_DESIGNS.find(n=>n.id===id)!;const s=useSeasonVisual();const score=s.scores[id],shown=useCount(score),tier=visualTier(score);
 const [busy,setBusy]=useState<{kind:string;until:number}|null>(null);const prev=useRef(score);const [delta,setDelta]=useState<{v:number;k:number}|null>(null);
 useEffect(()=>{if(score!==prev.current){setDelta({v:score-prev.current,k:Date.now()});prev.current=score;}},[score]);
 useEffect(()=>{if(!busy)return;const t=setTimeout(()=>setBusy(null),busy.until-Date.now());return()=>clearTimeout(t);},[busy]);
 const run=(kind:VisualEvent['kind']|'winner')=>{setBusy({kind,until:Date.now()+EFFECT_MS[kind]});if(kind==='winner'){s.revealWinner(id);if(!matchMedia('(prefers-reduced-motion: reduce)').matches)s.focusNest(id);}else s.play(id,kind);};
 const next=VISUAL_TIERS[tier+1],progress=next?(score-VISUAL_TIERS[tier])/(next-VISUAL_TIERS[tier]):1;
 return <article className={`nest-card${s.hover===id?' is-hovered':''}${s.winner===id?' is-winner':''}`} style={{'--nest-color':d.color} as CSSProperties} data-nest={id}
  onPointerEnter={()=>s.setHover(id)} onPointerLeave={()=>s.setHover(null)} onFocus={()=>s.setHover(id)} onBlur={()=>s.setHover(null)}>
  <header className="nest-card-head">
   <div><span className="nest-card-letter">{d.letter}</span><h3>{d.company}</h3><small>{d.id} · Nest {d.letter}</small></div>
   <div className="nest-card-score" aria-live="polite"><strong>{shown.toLocaleString('en-US')}</strong><small>demo pts</small>{delta&&<em key={delta.k} className={delta.v>0?'is-up':'is-down'}>{delta.v>0?'+':''}{delta.v}</em>}</div>
  </header>
  <ol className="nest-tiers" aria-label={`${d.company} visual stage`}>{TIER_NAMES.map((name,i)=><li key={name} data-on={i<=tier||undefined} data-current={i===tier||undefined}><i/><span>{name}</span></li>)}</ol>
  <div className="nest-progress"><i style={{transform:`scaleX(${Math.max(.02,progress)})`}}/></div>
  <label className="nest-slider"><span className="sr-only">{d.company} demo points</span><input type="range" min="0" max="4000" step="20" value={Math.min(4000,score)} aria-label={`${d.company} demo points`} onChange={e=>s.setScore(id,Number(e.target.value))}/></label>
  <div className="nest-actions">
   <Action label="View" aria="View nest" icon={Icon.view} hint="Fly the camera to this nest" onClick={()=>s.focusNest(id)}/>
   <Action label="Feed" aria="Feed +20" icon={Icon.feed} hint="Parachute a food sack (+20 demo)" busy={busy?.kind==='feed'?EFFECT_MS.feed:0} onClick={()=>run('feed')}/>
   <Action label="Shield" aria="Shield FX" icon={Icon.shield} hint="Raise a woven shield (blocks the next strike)" busy={busy?.kind==='shield'?EFFECT_MS.shield:0} onClick={()=>run('shield')}/>
   <Action label="Snake" aria="Attack FX" icon={Icon.snake} hint="The den snake strikes this nest (−40 demo)" busy={busy?.kind==='attack'?EFFECT_MS.attack:0} onClick={()=>run('attack')}/>
   <Action label="Crown" aria="Reveal winner" icon={Icon.crown} accent hint="Winner sequence" busy={busy?.kind==='winner'?EFFECT_MS.winner:0} onClick={()=>run('winner')}/>
  </div>
 </article>;
}

export default function SeasonNestPreview(){
 const state=useSeasonVisual(),[open,setOpen]=useState(true);const winner=NEST_DESIGNS.find(n=>n.id===state.winner);
 // Let the Season tutorial fly the camera and replay the cosmetic effect it is explaining.
 useEffect(()=>setTutorialStage(({nest,play})=>{const s=useSeasonVisual.getState();setOpen(true);
  if(play==='winner'&&nest){s.revealWinner(nest);if(!matchMedia('(prefers-reduced-motion: reduce)').matches)s.focusNest(nest);return;}
  if(nest!==undefined)s.focusNest(nest);
  if(nest&&play&&play!=='winner')s.play(nest,play);}),[]);
 return <section className={`nest-preview-controls${open?' is-open':''}`} aria-label="Season scene rehearsal">
  <header className="nest-dock-head">
   <div><span className="nest-preview-eyebrow">Season I · scene study</span><h2>{winner?<><span style={{color:winner.color}}>{winner.company}</span> takes the crown</>:'Three nests. One colony.'}</h2><p>Visual demo · fictional points · no wallet or payments</p></div>
   <div className="nest-preview-tools">
    <button type="button" onPointerDown={ripple} onClick={()=>state.focusNest(null)}>Overview</button>
    <button type="button" onPointerDown={ripple} onClick={()=>state.reset()}>Reset scene</button>
    <button type="button" onPointerDown={ripple} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Hide controls':'Show controls'}</button>
   </div>
  </header>
  {open&&<><div className="nest-preview-cards">{NEST_DESIGNS.map(n=><NestCard key={n.id} id={n.id}/>)}</div>
  <p className="nest-preview-note">Stages at 250 / 1,000 / 3,000 points are visual proposals, not gameplay rules. Mascots are cosmetic, not colony residents. Company names identify tickers only; no affiliation.</p></>}
 </section>;
}
