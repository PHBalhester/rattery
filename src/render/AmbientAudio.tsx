import {tr} from '../i18n';
import {useEffect,useRef,useState} from 'react';

export default function AmbientAudio(){
 const audio=useRef<HTMLAudioElement|null>(null),pending=useRef(false);
 const [playing,setPlaying]=useState(false),[failed,setFailed]=useState(false);
 useEffect(()=>()=>{const a=audio.current;if(a){a.pause();a.removeAttribute('src');a.load();audio.current=null;}},[]);
 const toggle=async()=>{
  let a=audio.current;
  if(!a){
   a=new Audio('/audio/conifers.mp3');a.preload='none';a.loop=true;a.volume=.25;audio.current=a;
   a.onplay=()=>setPlaying(true);a.onpause=()=>setPlaying(false);a.onerror=()=>{setFailed(true);setPlaying(false);};
  }
  if(!a.paused){a.pause();return;}
  if(pending.current)return;
  pending.current=true;setFailed(false);
  try{await a.play();}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setFailed(true);setPlaying(false);}finally{pending.current=false;}
 };
 return <button className="chip audio-toggle" onClick={()=>void toggle()} aria-pressed={playing} aria-label={failed?tr("Audio unavailable","音频不可用"):playing?tr("Turn lo-fi off","关闭音乐"):tr("Turn lo-fi on","开启音乐")} title={failed?tr("Audio unavailable","音频不可用"):playing?tr("Turn lo-fi off · Dusty Decks — Conifers","关闭音乐 · Dusty Decks — Conifers"):tr("Turn lo-fi on · Dusty Decks — Conifers","开启音乐 · Dusty Decks — Conifers")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 17V5l9-2v7M10 8l9-2"/><ellipse cx="6.5" cy="18" rx="3.5" ry="2.5"/>{!playing&&<path className="audio-off-mark" d="m16 15 5 5m0-5-5 5"/>}</svg><span className="sr-only">{failed?tr("Audio unavailable","音频不可用"):playing?tr("Lo-fi on","音乐开"):tr("Lo-fi off","音乐关")}</span></button>;
}
