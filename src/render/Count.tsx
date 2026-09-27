import {useEffect,useRef,useState} from 'react';

/** Glides to a new value; changing reduced-motion preference also stops an active tween. */
export default function Count({value,format=(v:number)=>String(v)}:{value:number;format?:(v:number)=>string}){
 const [shown,setShown]=useState(value),[flash,setFlash]=useState(0),from=useRef(value);
 useEffect(()=>{
  if(value===from.current)return;
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  let raf=0;
  const finish=()=>{cancelAnimationFrame(raf);from.current=value;setShown(value);};
  if(media.matches){finish();return;}
  const onMotion=()=>{if(media.matches)finish();};
  media.addEventListener('change',onMotion);
  const start=performance.now(),a=from.current;setFlash(f=>f+1);
  const step=(t:number)=>{const k=Math.min(1,(t-start)/520),v=Math.round(a+(value-a)*(1-(1-k)**3));from.current=v;setShown(v);if(k<1)raf=requestAnimationFrame(step);};
  raf=requestAnimationFrame(step);
  return()=>{cancelAnimationFrame(raf);media.removeEventListener('change',onMotion);};
 },[value]);
 return <b key={flash} className={flash?'count-flash':undefined}>{format(shown)}</b>;
}
