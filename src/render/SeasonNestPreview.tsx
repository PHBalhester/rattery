import {NEST_DESIGNS,TIER_NAMES,visualTier,useSeasonVisual} from '../season/visualState';
import {useState} from 'react';
export default function SeasonNestPreview(){
 const state=useSeasonVisual(),[open,setOpen]=useState(true);
 return <section className={`nest-preview-controls${open?' is-open':''}`} aria-label="Season scene rehearsal">
  <header><div><span className="nest-preview-eyebrow">SEASON I · SCENE STUDY</span><h2>{state.winner?`${NEST_DESIGNS.find(n=>n.id===state.winner)!.company} wins the rehearsal`:'Three nests. One colony.'}</h2><p>Visual demo · fictional scores · no wallet or payments</p></div><div className="nest-preview-tools"><button onClick={()=>state.focusNest(null)}>Overview</button><button onClick={()=>state.reset()}>Reset scene</button><button aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Hide controls':'Show controls'}</button></div></header>
  {open&&<><div className="nest-preview-cards">{NEST_DESIGNS.map(n=><article key={n.id} style={{'--nest-color':n.color} as React.CSSProperties} data-nest={n.id}>
   <div className="nest-preview-score"><h3><i/>{n.company}<small>{n.id} · NEST {n.letter}</small></h3><strong>{state.scores[n.id].toLocaleString('en-US')}<small>DEMO POINTS</small></strong></div>
   <label><span>{TIER_NAMES[visualTier(state.scores[n.id])]}</span><input type="range" min="0" max="4000" step="20" value={Math.min(4000,state.scores[n.id])} aria-label={`${n.company} demo points`} onChange={e=>state.setScore(n.id,Number(e.target.value))}/></label>
   <div className="nest-preview-actions"><button onClick={()=>state.focusNest(n.id)}>View nest</button><button onClick={()=>state.play(n.id,'feed')}>Feed +20</button><button onClick={()=>state.play(n.id,'shield')}>Shield FX</button><button onClick={()=>state.play(n.id,'attack')}>Attack FX</button><button className="nest-reveal" onClick={()=>state.revealWinner(n.id)}>Reveal winner</button></div>
  </article>)}</div><p className="nest-preview-note">Design tiers at 250 / 1,000 / 3,000 points are visual proposals, not gameplay rules. The six colored mascots are cosmetic previews, not additional colony residents.</p></>}
 </section>;
}