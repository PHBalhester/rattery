import {create} from 'zustand';
export type Language='en'|'zh';
function initial():Language{try{return localStorage.getItem('rattery-language')==='zh'?'zh':'en';}catch{return 'en';}}
export const useLanguage=create<{language:Language;setLanguage:(language:Language)=>void}>(set=>({language:initial(),setLanguage:language=>{try{localStorage.setItem('rattery-language',language);}catch{}document.documentElement.lang=language==='zh'?'zh-Hans':'en';set({language});}}));
export function tr(en:string,zh:string){return useLanguage.getState().language==='zh'?zh:en;}
export function locale(){return useLanguage.getState().language==='zh'?'zh-CN':'en-US';}
