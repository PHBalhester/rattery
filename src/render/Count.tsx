import {useEffect,useRef,useState} from 'react';

/** Number that glides to its new value and flashes briefly when it changes. Instant under reduced motion. */
export default function Count({value,format=(v:number)=>String(v)}:{value:number;format?:(v:number)=>string}){
 const [shown,setShown]=useState(value),[flash,setFlash]=useState(0),from=useRef(value);
 useEffect(()=>{
  if(value===from.current)return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){from.current=value;setShown(value);return;}
  const start=performance.now(),a=from.current;let raf=0;setFlash(f=>f+1);
  const step=(t:number)=>{const k=Math.min(1,(t-start)/520),v=Math.round(a+(value-a)*(1-(1-k)**3));from.current=v;setShown(v);if(k<1)raf=requestAnimationFrame(step);};
  raf=requestAnimationFrame(step);return()=>cancelAnimationFrame(raf);
 },[value]);
 return <b key={flash} className={flash?'count-flash':undefined}>{format(shown)}</b>;
}
