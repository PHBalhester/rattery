/** Rendering-only feedback. Never changes simulation clocks, behavior or anatomy. */
export const qualityProfiles=[
 {name:'high',pixelRatio:2,shadowSize:2048,shadows:true,furDistance:Infinity,minLod:0},
 {name:'balanced',pixelRatio:1.25,shadowSize:1024,shadows:true,furDistance:18,minLod:0},
 {name:'economy',pixelRatio:.9,shadowSize:512,shadows:false,furDistance:0,minLod:1},
 {name:'minimal',pixelRatio:.65,shadowSize:512,shadows:false,furDistance:0,minLod:2},
] as const;
export class AdaptiveQuality{
 level=0;private elapsed=0;private windowMs=0;private frames=0;private goodMs=0;private warmup=5000;
 resetWindow(){this.windowMs=0;this.frames=0;this.goodMs=0;this.warmup=this.elapsed+5000;}
 sample(ms:number){
  if(!Number.isFinite(ms)||ms<=0)return false;
  this.elapsed+=ms;if(this.elapsed<this.warmup)return false;
  this.windowMs+=ms;this.frames++;if(this.windowMs<2500||this.frames<4)return false;
  const mean=this.windowMs/this.frames,window=this.windowMs;this.windowMs=0;this.frames=0;
  if(mean>32){this.goodMs=0;if(this.level<3){this.level++;return true;}}
  else if(mean<22){this.goodMs+=window;if(this.goodMs>=30000&&this.level>0){this.level--;this.goodMs=0;return true;}}
  else this.goodMs=0;
  return false;
 }
 get profile(){return qualityProfiles[this.level];}
}
