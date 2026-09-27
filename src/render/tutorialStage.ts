// Optional bridge between the Season tutorial and a scene that can illustrate it.
// The public colony registers nothing, so cues are no-ops there. The DEV nest preview
// registers a handler that flies the camera and plays cosmetic effects.
export type StageNest='NVDA'|'AAPL'|'AMZN';
export type StageCue={nest?:StageNest|null;play?:'feed'|'shield'|'attack'|'winner'};
let handler:((cue:StageCue)=>void)|null=null;
export function setTutorialStage(next:(cue:StageCue)=>void){handler=next;return()=>{if(handler===next)handler=null;};}
export function cueStage(cue:StageCue){try{handler?.(cue);}catch{/* Illustration only. */}}
