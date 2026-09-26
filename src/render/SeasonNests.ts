import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {NEST_DESIGNS,TIER_NAMES,visualTier,type NestId,type VisualEvent} from '../season/visualState';
import type {BlenderRatAssets,BlenderRatVisual} from './BlenderRat';
import {SNAKE_DEN} from '../sim/snake';
import {makeKit,wovenCourses,wovenStakes,rib,thatch,bedding,fabricTexture,flagCanvas,rnd,shade,type Kit} from './season/craft';
import {Particles,FloatingText,shieldMaterial} from './season/fx';
import {SeasonSnake} from './season/SeasonSnake';

/*
 * Season nest diorama (development preview only). Cosmetic: it never reads or writes World, wallets,
 * payments or the simulation. Build tiers are art direction, not economic rules.
 *
 * Motion notes applied here: staggered construction (pieces drop with anticipation-free ease-out and a
 * landing squash), overlapping action (flag cloth and tail lag the body), short anticipation before the
 * snake strike, ethogram-based mascot behaviours (sniff, rear, cephalocaudal grooming, bedding, carrying,
 * nose-to-nose) and freeze-then-flee on threat.
 */

type Style='drop'|'grow'|'pop'|'unfold';
type Piece={obj:T.Object3D;style:Style;home:T.Vector3;scale:T.Vector3;landed:boolean};
type Behaviour='idle'|'walk'|'sniff'|'rear'|'groom'|'arrange'|'carry'|'social'|'flee'|'hide'|'rush'|'cheer';
type Mascot={rat:BlenderRatVisual;x:number;z:number;heading:number;speed:number;route:T.Vector2[];behaviour:Behaviour;next:Behaviour|null;timer:number;dur:number;
 prop:T.Mesh|null;carrying:boolean;head:number;rise:number;yaw:number;hop:number;distress:number;social:boolean;seed:number};
type Nest={id:NestId;design:typeof NEST_DESIGNS[number];root:T.Group;pieces:Piece[];tierEnd:number[];build:number;target:number;tier:number;score:number;
 flag:{mesh:T.Mesh<T.PlaneGeometry,T.MeshStandardMaterial>;back:T.Mesh;base:Float32Array;map:T.CanvasTexture};droop:number;
 sign:{canvas:HTMLCanvasElement;map:T.CanvasTexture;shown:number;flash:number;board:T.Mesh};
 halo:T.Mesh<T.RingGeometry,T.MeshBasicMaterial>;shield:T.Mesh<T.SphereGeometry,T.ShaderMaterial>;shieldAt:number;
 crown:T.Group;crownAt:number;lantern:T.PointLight;sack:T.Group;sackAt:number;rats:Mascot[];shake:number;hover:number;event:VisualEvent['kind']|null;eventAt:number};

const clamp=T.MathUtils.clamp,damp=T.MathUtils.damp;
const easeOut=(t:number)=>1-(1-t)**3,easeBack=(t:number)=>{const c=1.7;return 1+(c+1)*(t-1)**3+c*(t-1)**2;};
const WALL=2.1,CENTER_Z=-.5,FLOOR=.2,PORCH=.33,ROWS=5,ROW_H=.22,DOME_Y=FLOOR+ROWS*ROW_H-.05,DOME_H=1.45;
const STYLE:Record<NestId,{facets:number;motif:'grid'|'linen'|'stripe';ribs:number;ink:string;dome:number}>={
 NVDA:{facets:3,motif:'grid',ribs:8,ink:'#0e1a06',dome:1.95},AAPL:{facets:0,motif:'linen',ribs:6,ink:'#1d2630',dome:1.45},AMZN:{facets:0,motif:'stripe',ribs:7,ink:'#241304',dome:1.15}};
const WAYPOINTS=[[0,2.75],[-.9,2.85],[.9,2.85],[0,3.2],[-1.55,2.2],[1.55,2.3],[-2.7,.2],[2.6,.1],[-1.5,3.05],[1.4,3.1]].map(([x,z])=>new T.Vector2(x,z));
const DOOR=new T.Vector2(0,1.45),DOORSTEP=new T.Vector2(0,2.4);

/** Cosmetic presentation only. Its six mascots never enter World.rats or ownership state. */
export class SeasonNests{
 readonly root=new T.Group();
 private nests=new Map<NestId,Nest>();private kit:Kit;private textures:T.Texture[]=[];private geos:T.BufferGeometry[]=[];private mats:T.Material[]=[];
 private time=0;private serial=0;private revealSerial=-1;private winner:NestId|null=null;private revealAt=-100;private hovered:NestId|null=null;
 private particles:Particles;private text:FloatingText;private snake:SeasonSnake;private snakeTarget:NestId|null=null;private fireworks:{at:number;x:number;z:number;h:number;fired:boolean;seed:number}[]=[];
 private level=0;private reduced=false;private alive=0;private frame=0;
 constructor(scene:T.Scene,width:number,height:number){
  this.root.name='Season nest visual preview';scene.add(this.root);this.kit=makeKit();
  this.particles=new Particles(192);this.root.add(this.particles.points);this.text=new FloatingText(this.root);
  this.snake=new SeasonSnake(new T.Vector3((SNAKE_DEN.x-width/2)/30,0,(SNAKE_DEN.y-height/2)/30));this.root.add(this.snake.root);
  this.snake.onImpact=()=>this.impact();
  for(const design of NEST_DESIGNS)this.nests.set(design.id,this.buildNest(design,width,height));
 }

 // ---------- construction -------------------------------------------------------------------------
 private mesh(geo:T.BufferGeometry,mat:T.Material){this.geos.push(geo);const m=new T.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;return m;}
 private buildNest(design:typeof NEST_DESIGNS[number],width:number,height:number):Nest{
  const k=this.kit,st=STYLE[design.id],seed=design.id.charCodeAt(0)*31;
  const root=new T.Group();root.name=`${design.id} nest ${design.letter}`;root.position.set(-(design.anchor[0]*width-width/2)/30,-.04,-(design.anchor[1]*height-height/2)/30);root.rotation.y=Math.PI;root.scale.setScalar(1.2);this.root.add(root);
  const fabricMap=fabricTexture(design.color,st.motif);this.textures.push(fabricMap);
  const fabric=new T.MeshPhysicalMaterial({map:fabricMap,roughness:.85,sheen:1,sheenColor:new T.Color(shade(design.color,.25)),sheenRoughness:.6,side:T.DoubleSide});
  const accent=new T.MeshStandardMaterial({color:design.color,roughness:.6,metalness:design.id==='AAPL'?.55:.1});this.mats.push(fabric,accent);
  const pieces:Piece[]=[];const tierEnd:number[]=[];
  const add=(obj:T.Object3D,style:Style,parent:T.Object3D=root)=>{parent.add(obj);pieces.push({obj,style,home:obj.position.clone(),scale:obj.scale.clone(),landed:false});return obj;};
  const body=new T.Group();body.position.z=CENTER_Z;root.add(body);

  // Tier 0 · bedding: earthen mound, loose straw, first two woven courses, a seed pile.
  const mound=this.mesh(new T.LatheGeometry([new T.Vector2(0,FLOOR),new T.Vector2(3.1,FLOOR),new T.Vector2(3.45,.08),new T.Vector2(3.55,0)],48),k.earth);root.add(mound);
  const straw=bedding(k.strawDark,170,3.1,FLOOR+.01,seed);this.geos.push(straw.geometry);root.add(straw);
  const courses=wovenCourses(WALL,ROWS,ROW_H,FLOOR,.42,seed);
  add(this.mesh(wovenStakes(WALL,ROWS*ROW_H+.18,FLOOR-.05,.42),k.twig),'grow',body);
  add(this.mesh(courses[0],k.straw),'grow',body);add(this.mesh(courses[1],k.straw),'grow',body);
  const pile=new T.Group();for(let i=0;i<9;i++){const s=this.mesh(new T.SphereGeometry(.07,6,5),k.seed);s.scale.set(1,.6,.75);s.position.set((rnd(seed+i)-.5)*.5,FLOOR+.04+(i>5?.06:0),(rnd(seed+i*3)-.5)*.35);pile.add(s);}pile.position.set(-1.7,0,2.1);add(pile,'pop');
  tierEnd.push(pieces.length);

  // Tier 1 · shelter: the wall rises course by course, ribs bend over, thatch bands, awning and doorframe.
  for(let r=2;r<ROWS;r++)add(this.mesh(courses[r],k.straw),'grow',body);
  for(let i=0;i<st.ribs;i++){const a=i/st.ribs*Math.PI+.2;add(this.mesh(rib(WALL*.98,st.dome,a,DOME_Y,st.facets,.06),k.twig),'grow',body);}
  for(let b=0;b<3;b++)add(this.mesh(thatch(WALL,st.dome,DOME_Y,0,Math.PI*2,b,3,seed+b*40),k.straw),'drop',body);
  // Company sash woven round the roof: the colour reads from the overview.
  const sash=this.mesh(new T.TorusGeometry(WALL*Math.cos(.42)+.03,.1,8,64),fabric);sash.rotation.x=Math.PI/2;sash.scale.z=1.6;sash.position.set(0,DOME_Y+Math.sin(.42)*st.dome,CENTER_Z);add(sash,'unfold');
  const frame=new T.Group();for(const x of [-.62,.62]){const post=this.mesh(new T.CylinderGeometry(.07,.09,1.2,6),k.twig);post.position.set(x,FLOOR+.6,1.62);frame.add(post);}
  const lintel=this.mesh(new T.CylinderGeometry(.075,.075,1.5,6),k.twig);lintel.rotation.z=Math.PI/2;lintel.position.set(0,FLOOR+1.2,1.62);frame.add(lintel);
  const lash=this.mesh(new T.TorusGeometry(.1,.03,5,10),k.rope);lash.position.set(-.62,FLOOR+1.18,1.62);frame.add(lash);const lash2=lash.clone();lash2.position.x=.62;frame.add(lash2);
  add(frame,'drop');
  const awningGeo=new T.PlaneGeometry(1.75,.8,12,6);{const p=awningGeo.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),f=(y+.4)/.8;p.setXYZ(i,x,-.18*f*f+Math.sin(x*3)*.02,y);}awningGeo.computeVertexNormals();}
  const awning=this.mesh(awningGeo,fabric);awning.position.set(0,FLOOR+1.42,2.0);awning.rotation.x=-.42;add(awning,'unfold');
  const poles=new T.Group();for(const x of [-.82,.82]){const pole=this.mesh(new T.CylinderGeometry(.045,.06,1.25,6),k.twig);pole.position.set(x,FLOOR+.62,2.36);poles.add(pole);}add(poles,'grow');
  tierEnd.push(pieces.length);

  // Tier 2 · haven: porch planks laid one by one, provisions with personality, lantern and side basket.
  for(let i=0;i<6;i++){const plank=this.mesh(new T.BoxGeometry(2.7+rnd(seed+i)*.12,.07,.21),k.plank);plank.position.set((rnd(seed+i*5)-.5)*.08,PORCH-.035,1.85+i*.24);plank.rotation.y=(rnd(seed+i*9)-.5)*.04;add(plank,'drop');}
  this.provisions(design.id,k,accent,fabric).forEach(p=>add(p,'pop'));
  const lamp=new T.Group();const cage=this.mesh(new T.CylinderGeometry(.13,.13,.26,6,1,true),k.brass);(cage.material as T.Material).side=T.DoubleSide;lamp.add(cage);
  const glow=this.mesh(new T.SphereGeometry(.08,10,8),k.lantern);lamp.add(glow);const cap=this.mesh(new T.ConeGeometry(.16,.12,6),k.brass);cap.position.y=.19;lamp.add(cap);
  const lantern=new T.PointLight('#ffb65c',0,3.4,2);lamp.add(lantern);lamp.position.set(.82,FLOOR+1.05,2.36);add(lamp,'drop');
  const basket=this.mesh(new T.LatheGeometry([new T.Vector2(0,0),new T.Vector2(.32,.02),new T.Vector2(.4,.3),new T.Vector2(.42,.34)],14),k.strawDark);(basket.material as T.Material).side=T.DoubleSide;basket.position.set(2.2,FLOOR,.9);add(basket,'pop');
  tierEnd.push(pieces.length);

  // Tier 3 · lodge: woven loft on the roof, bunting, brass trim, side banner, finial.
  const loftY=DOME_Y+st.dome-.25;
  const loft=new T.Group();loft.position.set(0,0,CENTER_Z);
  wovenCourses(.72,2,.18,loftY,.01,seed+7,12).forEach(g=>loft.add(this.mesh(g,k.straw)));add(loft,'grow');
  const loftRibs=new T.Group();loftRibs.position.set(0,0,CENTER_Z);for(let i=0;i<4;i++)loftRibs.add(this.mesh(rib(.7,.62,i/4*Math.PI,loftY+.34,st.facets,.045),k.twig));add(loftRibs,'grow');
  const loftCap=this.mesh(thatch(.72,.62,loftY+.34,0,Math.PI*2,1,2,seed+99),k.straw);loftCap.position.z=CENTER_Z;add(loftCap,'drop');
  const trim=this.mesh(new T.TorusGeometry(WALL+.05,.045,6,56),k.brass);trim.rotation.x=Math.PI/2;trim.position.set(0,DOME_Y+.02,CENTER_Z);add(trim,'pop');
  const finial=new T.Group();const orb=this.mesh(new T.SphereGeometry(.13,12,10),k.brass);const spike=this.mesh(new T.ConeGeometry(.06,.34,8),accent);spike.position.y=.24;finial.add(orb,spike);finial.position.set(0,loftY+1.02,CENTER_Z);add(finial,'pop');
  add(this.bunting(design.color,fabric,k),'unfold');
  const banner=this.mesh(new T.PlaneGeometry(.8,1.1,4,6),fabric);banner.position.set(-WALL-.02,FLOOR+.75,CENTER_Z+.25);banner.rotation.y=-Math.PI/2-.15;add(banner,'unfold');
  tierEnd.push(pieces.length);

  // Always present: flagpole + cloth flag (double-sided so the name reads from both sides), sign, halo.
  const pole=this.mesh(new T.CylinderGeometry(.055,.08,4.5,8),k.twig);pole.position.set(2.55,2.25,-1.35);root.add(pole);
  const knob=this.mesh(new T.SphereGeometry(.11,10,8),k.brass);knob.position.set(2.55,4.53,-1.35);root.add(knob);
  const fc=flagCanvas(design.company,design.id,design.color,st.ink);const flagMap=new T.CanvasTexture(fc.canvas);flagMap.colorSpace=T.SRGBColorSpace;flagMap.anisotropy=8;this.textures.push(flagMap);fc.withLogo(()=>{flagMap.needsUpdate=true;});
  const backMap=flagMap.clone();backMap.wrapS=T.RepeatWrapping;backMap.repeat.x=-1;backMap.offset.x=1;backMap.needsUpdate=true;this.textures.push(backMap);
  fc.withLogo(()=>{backMap.needsUpdate=true;});
  const flagGeo=new T.PlaneGeometry(2.3,1.35,24,12);flagGeo.translate(1.15,0,0);this.geos.push(flagGeo);
  const flagMat=new T.MeshStandardMaterial({map:flagMap,roughness:.88,side:T.FrontSide}),backMat=new T.MeshStandardMaterial({map:backMap,roughness:.88,side:T.BackSide});this.mats.push(flagMat,backMat);
  const flagMesh=new T.Mesh(flagGeo,flagMat),back=new T.Mesh(flagGeo,backMat);flagMesh.castShadow=true;
  const flagRoot=new T.Group();flagRoot.position.set(2.6,3.72,-1.35);flagRoot.add(flagMesh,back);root.add(flagRoot);
  const signCanvas=document.createElement('canvas');signCanvas.width=512;signCanvas.height=256;const signMap=new T.CanvasTexture(signCanvas);signMap.colorSpace=T.SRGBColorSpace;signMap.anisotropy=4;this.textures.push(signMap);
  const sign=new T.Group();const stake=this.mesh(new T.CylinderGeometry(.05,.06,1.25,6),k.twig);stake.position.y=.62;sign.add(stake);
  const board=this.mesh(new T.BoxGeometry(2.1,1.05,.07),k.plank);board.position.y=1.2;board.rotation.x=-.42;sign.add(board);
  const face=new T.Mesh(new T.PlaneGeometry(2.0,.98),new T.MeshStandardMaterial({map:signMap,roughness:.8}));this.geos.push(face.geometry);this.mats.push(face.material as T.Material);face.position.z=.037;board.add(face);
  sign.position.set(-3.25,0,2.35);sign.rotation.y=.4;root.add(sign);
  const halo=new T.Mesh(new T.RingGeometry(3.6,3.85,64),new T.MeshBasicMaterial({color:design.color,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending}));halo.rotation.x=-Math.PI/2;halo.position.y=.03;this.geos.push(halo.geometry);this.mats.push(halo.material);root.add(halo);
  const shield=new T.Mesh(new T.SphereGeometry(3.95,48,24,0,Math.PI*2,0,Math.PI/2),shieldMaterial(design.color));shield.material.uniforms.height.value=3.95;shield.visible=false;shield.renderOrder=4;this.geos.push(shield.geometry);this.mats.push(shield.material);shield.position.z=.3;root.add(shield);
  const crown=this.crown(design.color);crown.visible=false;root.add(crown);
  const sack=this.sack(fabric,k);sack.visible=false;root.add(sack);
  const nest:Nest={id:design.id,design,root,pieces,tierEnd,build:tierEnd[0],target:tierEnd[0],tier:0,score:-1,flag:{mesh:flagMesh,back,base:(flagGeo.attributes.position.array as Float32Array).slice(),map:flagMap},droop:0,
   sign:{canvas:signCanvas,map:signMap,shown:0,flash:0,board},halo,shield,shieldAt:-100,crown,crownAt:-100,lantern,sack,sackAt:-100,rats:[],shake:0,hover:0,event:null,eventAt:-100};
  this.drawSign(nest,0);return nest;
 }
 private provisions(id:NestId,k:Kit,accent:T.Material,fabric:T.Material){
  const out:T.Object3D[]=[];const at=(o:T.Object3D,x:number,z:number,ry=0)=>{o.position.set(x,FLOOR,z);o.rotation.y=ry;out.push(o);return o;};
  const cheese=this.mesh(new T.CylinderGeometry(.28,.28,.2,12,1,false,0,Math.PI/3),k.cheese);cheese.position.y=.1;const c=new T.Group();c.add(cheese);at(c,-2.35,.55,.6);
  if(id==='AAPL'){
   const basket=new T.Group();const b=this.mesh(new T.LatheGeometry([new T.Vector2(0,0),new T.Vector2(.36,.02),new T.Vector2(.46,.26),new T.Vector2(.48,.3)],16),k.strawDark);(b.material as T.Material).side=T.DoubleSide;basket.add(b);
   for(let i=0;i<5;i++){const apple=this.fruit(i%2?k.red:k.leaf,k);apple.position.set(Math.cos(i*1.3)*.2,.3+(i>2?.08:0),Math.sin(i*1.3)*.2);basket.add(apple);}at(basket,-1.95,1.25);
   const loose=this.fruit(k.red,k);loose.position.y=.12;const l=new T.Group();l.add(loose);at(l,-1.45,2.05);
   const cloth=this.mesh(new T.CylinderGeometry(.34,.4,.1,16),fabric);cloth.position.y=.05;const cl=new T.Group();cl.add(cloth);at(cl,1.85,1.75);
  }else if(id==='AMZN'){
   const stack=new T.Group();[[0,0,.46],[.05,.44,.38],[-.3,0,.34]].forEach(([x,y,s],i)=>{const box=this.mesh(new T.BoxGeometry(s,s*.8,s),k.paper);box.position.set(x*1.4,y+s*.4,i===2?.4:0);box.rotation.y=rnd(i+3)*.4;stack.add(box);
    const tape=this.mesh(new T.BoxGeometry(s*1.01,s*.82,.06),accent);tape.position.copy(box.position);tape.rotation.copy(box.rotation);stack.add(tape);});at(stack,-2.05,1.1,.3);
   const cart=new T.Group();const bed=this.mesh(new T.BoxGeometry(.7,.16,.42),k.plank);bed.position.y=.2;cart.add(bed);for(const [x,z] of [[-.25,-.22],[.25,-.22],[-.25,.22],[.25,.22]]){const w=this.mesh(new T.TorusGeometry(.09,.03,6,12),k.twig);w.position.set(x,.1,z);cart.add(w);}
   const load=this.mesh(new T.BoxGeometry(.3,.24,.3),k.paper);load.position.y=.4;cart.add(load);at(cart,1.9,1.8,-.4);
  }else{
   const crates=new T.Group();[[0,0],[.42,0],[.2,.34]].forEach(([x,y],i)=>{const crate=this.mesh(new T.BoxGeometry(.4,.32,.36),k.plank);crate.position.set(x,y+.16,0);crate.rotation.y=(rnd(i+21)-.5)*.2;crates.add(crate);
    const band=this.mesh(new T.BoxGeometry(.42,.05,.38),accent);band.position.copy(crate.position);band.position.y+=.08;crates.add(band);});at(crates,-2.25,1.05,.4);
   const bundle=this.mesh(new T.SphereGeometry(.3,14,10),fabric);bundle.scale.set(1,.7,.85);bundle.position.y=.2;const bd=new T.Group();bd.add(bundle);at(bd,1.9,1.75);
  }
  const sackG=new T.Group();const sk=this.mesh(new T.LatheGeometry([new T.Vector2(0,0),new T.Vector2(.26,.02),new T.Vector2(.3,.2),new T.Vector2(.18,.42),new T.Vector2(.1,.46)],14),k.rope);sackG.add(sk);at(sackG,-2.6,1.7,.2);
  return out;
 }
 private fruit(mat:T.Material,k:Kit){const g=new T.Group();const a=this.mesh(new T.SphereGeometry(.1,12,10),mat);a.scale.y=.9;g.add(a);const stem=this.mesh(new T.CylinderGeometry(.008,.01,.06,4),k.twig);stem.position.y=.1;g.add(stem);const leaf=this.mesh(new T.SphereGeometry(.03,6,4),k.leaf);leaf.scale.set(1.6,.3,.8);leaf.position.set(.03,.11,0);g.add(leaf);return g;}
 private bunting(color:string,fabric:T.Material,k:Kit){
  const g=new T.Group();const from=new T.Vector3(2.55,3.2,-1.35),to=new T.Vector3(-.82,FLOOR+1.2,2.36);
  const curve=new T.QuadraticBezierCurve3(from,from.clone().lerp(to,.5).add(new T.Vector3(0,-.5,0)),to);
  g.add(this.mesh(new T.TubeGeometry(curve,24,.012,4),k.rope));
  const light=new T.MeshStandardMaterial({color:'#f3e6c8',roughness:.9,side:T.DoubleSide}),team=new T.MeshStandardMaterial({color,roughness:.8,side:T.DoubleSide});this.mats.push(light,team);
  const tri=new T.BufferGeometry().setFromPoints([new T.Vector3(-.13,0,0),new T.Vector3(.13,0,0),new T.Vector3(0,-.3,0)]);tri.computeVertexNormals();this.geos.push(tri);
  for(let i=1;i<10;i++){const p=curve.getPoint(i/10),t=curve.getTangent(i/10);const m=new T.Mesh(tri,i%2?team:light);m.position.copy(p);m.rotation.y=Math.atan2(t.x,t.z)+Math.PI/2;m.castShadow=true;g.add(m);}
  void fabric;return g;
 }
 private crown(color:string){
  const g=new T.Group();const gold=new T.MeshStandardMaterial({color:'#f2c14e',metalness:.9,roughness:.2,emissive:'#6b4a10',emissiveIntensity:.35}),gem=new T.MeshStandardMaterial({color,metalness:.2,roughness:.1,emissive:color,emissiveIntensity:.5});this.mats.push(gold,gem);
  const band=this.mesh(new T.CylinderGeometry(.62,.55,.34,32,1,true),gold);(band.material as T.Material).side=T.DoubleSide;g.add(band);
  const rim=this.mesh(new T.TorusGeometry(.6,.05,8,32),gold);rim.rotation.x=Math.PI/2;rim.position.y=-.17;g.add(rim);
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;const pt=this.mesh(new T.ConeGeometry(.13,.42,4),gold);pt.position.set(Math.cos(a)*.58,.36,Math.sin(a)*.58);g.add(pt);
   const orb=this.mesh(new T.SphereGeometry(.06,10,8),gold);orb.position.set(Math.cos(a)*.58,.6,Math.sin(a)*.58);g.add(orb);
   const stone=this.mesh(new T.OctahedronGeometry(.08),gem);stone.position.set(Math.cos(a+Math.PI/6)*.6,0,Math.sin(a+Math.PI/6)*.6);g.add(stone);}
  return g;
 }
 private sack(fabric:T.Material,k:Kit){
  const g=new T.Group();const bag=this.mesh(new T.LatheGeometry([new T.Vector2(0,0),new T.Vector2(.24,.03),new T.Vector2(.28,.2),new T.Vector2(.14,.38),new T.Vector2(.07,.44)],14),k.rope);g.add(bag);
  const tie=this.mesh(new T.TorusGeometry(.08,.02,5,10),fabric);tie.rotation.x=Math.PI/2;tie.position.y=.4;g.add(tie);
  const chute=new T.Group();chute.name='chute';const canopy=this.mesh(new T.SphereGeometry(.7,16,8,0,Math.PI*2,0,Math.PI/2.4),fabric);canopy.scale.y=.6;canopy.position.y=1.35;chute.add(canopy);
  const lines=new T.BufferGeometry().setFromPoints([0,1,2,3].flatMap(i=>{const a=i/4*Math.PI*2+.4;return [new T.Vector3(0,.44,0),new T.Vector3(Math.cos(a)*.6,1.25,Math.sin(a)*.6)];}));this.geos.push(lines);
  const lm=new T.LineBasicMaterial({color:'#e6d6b0'});this.mats.push(lm);chute.add(new T.LineSegments(lines,lm));g.add(chute);return g;
 }
 private drawSign(n:Nest,value:number){
  const g=n.sign.canvas.getContext('2d')!,d=n.design;
  const wood=g.createLinearGradient(0,0,0,256);wood.addColorStop(0,'#8a6440');wood.addColorStop(1,'#6b4a2e');g.fillStyle=wood;g.fillRect(0,0,512,256);
  for(let i=0;i<14;i++){g.strokeStyle=`rgba(40,22,8,${.12+rnd(i)*.1})`;g.lineWidth=1+rnd(i+3)*2;g.beginPath();const y=rnd(i+7)*256;g.moveTo(0,y);g.bezierCurveTo(170,y+6,340,y-6,512,y+3);g.stroke();}
  g.fillStyle=d.color;g.fillRect(0,0,512,14);
  g.textAlign='left';g.fillStyle='#f6e8c8';g.font='700 34px "IBM Plex Mono",monospace';g.fillText(`NEST ${d.letter} · ${d.id}`,28,62);
  g.font='800 92px "Segoe UI",Arial,sans-serif';g.fillStyle=n.sign.flash>0?'#ffffff':'#fff4dc';g.fillText(Math.round(value).toLocaleString('en-US'),28,168);
  g.font='600 30px "Segoe UI",Arial,sans-serif';g.fillStyle=d.color;g.fillText(`${TIER_NAMES[visualTier(value)]}`,28,222);
  n.sign.map.needsUpdate=true;
 }

 // ---------- mascots --------------------------------------------------------------------------------
 attachRats(assets:BlenderRatAssets){
  for(const n of this.nests.values()){if(n.rats.length)continue;
   for(let i=0;i<2;i++){const rat=assets.create(`preview-${n.id}-${i}`,undefined,n.design.color);rat.root.name=`Cosmetic ${n.id} mascot ${i+1}`;rat.root.scale.setScalar(1.15);n.root.add(rat.root);
    const start=WAYPOINTS[i+1];const prop=this.mesh(new T.SphereGeometry(.07,8,6),i?this.kit.seed:this.kit.strawDark);prop.scale.set(i?1:3.2,i?.7:.35,i?.8:.35);prop.visible=false;this.root.add(prop);
    n.rats.push({rat,x:start.x,z:start.y,heading:i?Math.PI:0,speed:0,route:[],behaviour:'idle',next:null,timer:0,dur:.6+i,prop,carrying:false,head:0,rise:0,yaw:0,hop:0,distress:0,social:false,seed:n.id.charCodeAt(1)*97+i*13});}
  }
 }
 private ground(n:Nest,x:number,z:number){const r=Math.hypot(x,z-CENTER_Z);let h=r<3.1?FLOOR:r<3.55?FLOOR*(1-(r-3.1)/.45):0;if(n.build>=n.tierEnd[1]+1&&Math.abs(x)<1.35&&z>1.72&&z<3.2)h=PORCH;return h;}
 private route(from:T.Vector2,to:T.Vector2){
  const c=new T.Vector2(0,CENTER_Z),pts:T.Vector2[]=[];const doorIn=to.distanceTo(DOOR)<.1,doorOut=from.distanceTo(DOOR)<.3;
  if(doorOut)pts.push(DOORSTEP.clone());
  const a=doorOut?DOORSTEP:from,b=doorIn?DOORSTEP:to;
  // Detour around the woven wall when the straight line would pass through it.
  let close=Infinity;for(let i=0;i<=10;i++){const p=a.clone().lerp(b,i/10);close=Math.min(close,p.distanceTo(c));}
  if(close<2.55){const mid=a.clone().lerp(b,.5).sub(c);if(mid.lengthSq()<.01)mid.set(0,1);mid.setLength(3.0).add(c);pts.push(mid);}
  pts.push(b.clone());if(doorIn)pts.push(DOOR.clone());return pts;
 }
 private goTo(m:Mascot,to:T.Vector2,then:Behaviour,speed=.55){m.route=this.route(new T.Vector2(m.x,m.z),to);m.behaviour='walk';m.next=then;m.speed=speed;}
 private choose(n:Nest,m:Mascot,i:number){
  const other=n.rats[1-i];m.seed++;const r=rnd(m.seed);
  if(n.build<n.target-.3||n.build>n.target+.3){const p=WAYPOINTS[4+(m.seed%4)];this.goTo(m,p,'arrange');return;}
  if(r<.24){let p=WAYPOINTS[Math.floor(rnd(m.seed*3)*WAYPOINTS.length)];if(other&&p.distanceTo(new T.Vector2(other.x,other.z))<1)p=WAYPOINTS[(WAYPOINTS.indexOf(p)+3)%WAYPOINTS.length];this.goTo(m,p,'sniff');}
  else if(r<.38){m.behaviour='rear';m.dur=2.1;}
  else if(r<.54){m.behaviour='groom';m.dur=3.2;}
  else if(r<.68){this.goTo(m,WAYPOINTS[4+(m.seed%4)],'arrange');}
  else if(r<.82){this.goTo(m,n.tier>=2?WAYPOINTS[4]:new T.Vector2(-1.7,2.1),'carry');}
  else if(other&&other.behaviour!=='walk'&&other.behaviour!=='social'){const meet=new T.Vector2(i?.42:-.42,2.95);this.goTo(m,meet,'social');this.goTo(other,new T.Vector2(i?-.42:.42,2.95),'social');}
  else{m.behaviour='sniff';m.dur=2.4;}
  m.timer=0;if(m.behaviour!=='walk')m.dur=m.dur||2;
 }
 private updateRats(n:Nest,dt:number,camera:T.Camera){
  const near=this.snake.busy?this.snake.headWorld.distanceTo(n.root.position):Infinity,threat=this.snake.busy&&near<9.5,cheering=this.winner===n.id&&this.time-this.revealAt<7;
  n.rats.forEach((m,i)=>{
   if(this.reduced){m.behaviour='idle';m.speed=0;}
   else if(threat&&m.behaviour!=='flee'&&m.behaviour!=='hide'){m.behaviour='flee';m.timer=0;m.route=[];}
   else if(!threat&&(m.behaviour==='flee'||m.behaviour==='hide')&&m.timer>.6){m.behaviour='idle';m.dur=.8;m.timer=0;}
   else if(cheering&&m.behaviour!=='cheer'&&m.behaviour!=='walk'){m.behaviour='cheer';m.timer=0;m.dur=4.5;}
   m.timer+=dt;let moving=false,target=0;m.social=false;
   let head=0,rise=0,yaw=0,hop=0,distress=0;
   switch(m.behaviour){
    case 'walk':{const p=m.route[0];if(!p){m.behaviour=m.next??'idle';m.timer=0;m.dur=m.behaviour==='arrange'?2.6:m.behaviour==='carry'?4:m.behaviour==='social'?3:2.4;break;}
     const dx=p.x-m.x,dz=p.y-m.z,d=Math.hypot(dx,dz);if(d<.08){m.route.shift();break;}
     const want=Math.atan2(-dz,dx);let diff=Math.atan2(Math.sin(want-m.heading),Math.cos(want-m.heading));
     // Turn in place first, then walk: no sideways sliding.
     m.heading+=clamp(diff,-dt*4.5,dt*4.5);diff=Math.atan2(Math.sin(want-m.heading),Math.cos(want-m.heading));
     target=Math.abs(diff)<.5?m.speed*Math.min(1,d/.35+.3):0;moving=true;head=-.05;break;}
    case 'sniff':head=.08+Math.sin(this.time*2*Math.PI*7+i)*.025;yaw=Math.sin(m.timer*1.3+i)*.45;if(m.timer>m.dur)this.choose(n,m,i);break;
    case 'rear':{const t=m.timer,up=t<.14?-.06*Math.sin(t/.14*Math.PI):t<.5?easeOut((t-.14)/.36)*.62:t<m.dur-.35?.62:.62*(1-easeOut((t-(m.dur-.35))/.35));rise=up;head=.25+Math.sin(this.time*2*Math.PI*7)*.03;yaw=Math.sin(t*1.7)*.35;if(t>m.dur)this.choose(n,m,i);break;}
    case 'groom':{const t=m.timer;if(t<2){rise=.32*easeOut(Math.min(1,t/.3));head=-.35+Math.sin(t*2*Math.PI*5)*.12;}else{rise=.32*(1-easeOut(Math.min(1,(t-2)/.3)));head=-.45;yaw=(t<2.6?1:-1)*.85*Math.sin(Math.min(1,(t-2)/.25)*Math.PI/2);}if(t>m.dur)this.choose(n,m,i);break;}
    case 'arrange':{head=-.55+Math.max(0,Math.sin(m.timer*2*Math.PI*1.6))*.18;yaw=Math.sin(m.timer*.9)*.2;const nudge=Math.max(0,Math.sin(m.timer*2*Math.PI*1.6))*.12;target=nudge*.4;moving=nudge>.02;
     if(!this.reduced&&rnd(m.seed+Math.floor(m.timer*1.6))>.8&&Math.floor((m.timer-dt)*1.6)!==Math.floor(m.timer*1.6)){const w=n.root.localToWorld(new T.Vector3(m.x+Math.cos(m.heading)*.5,FLOOR+.05,m.z-Math.sin(m.heading)*.5));this.particles.burst(w,3,.8,new T.Color('#d7b56c'),.7,.06,m.seed+Math.floor(m.timer*10),{up:.6,gravity:3});}
     if(m.timer>m.dur)this.choose(n,m,i);break;}
    case 'carry':{head=-.5;if(m.timer>.6){m.carrying=true;this.goTo(m,DOOR,'idle');m.dur=1;}break;}
    case 'social':{m.social=true;head=.02+Math.sin(this.time*2*Math.PI*6)*.02;const partner=n.rats[1-i];if(partner){const want=Math.atan2(-(partner.z-m.z),partner.x-m.x);m.heading+=clamp(Math.atan2(Math.sin(want-m.heading),Math.cos(want-m.heading)),-dt*3,dt*3);}
     if(m.timer>1.8&&m.timer<2.6){rise=.35*Math.sin((m.timer-1.8)/.8*Math.PI);yaw=Math.sin(m.timer*9)*.25;}if(m.timer>m.dur)this.choose(n,m,i);break;}
    case 'flee':{distress=1;if(m.timer<.45){rise=-.08;head=-.1;}else{if(!m.route.length&&Math.hypot(m.x-DOOR.x,m.z-DOOR.y)>.2)m.route=this.route(new T.Vector2(m.x,m.z),DOOR);
     const p=m.route[0];if(p){const dx=p.x-m.x,dz=p.y-m.z,d=Math.hypot(dx,dz);if(d<.1)m.route.shift();else{const want=Math.atan2(-dz,dx);m.heading+=clamp(Math.atan2(Math.sin(want-m.heading),Math.cos(want-m.heading)),-dt*9,dt*9);target=1.6;moving=true;}}else{m.behaviour='hide';m.timer=0;}}break;}
    case 'hide':distress=.8;rise=-.06;head=-.12;break;
    case 'cheer':{const t=m.timer,beat=(t+i*.22)%.9;const hopping=t<3.2;rise=hopping?.72*Math.sin(Math.min(1,t/.35)*Math.PI/2):.72*(1-Math.min(1,(t-3.2)/.4));hop=hopping?Math.max(0,Math.sin(beat/.9*Math.PI))*.28:0;head=.35;yaw=Math.sin(t*3+i)*.25;
     const want=-Math.PI/2;m.heading+=clamp(Math.atan2(Math.sin(want-m.heading),Math.cos(want-m.heading)),-dt*5,dt*5);if(t>m.dur){m.behaviour='idle';m.timer=0;m.dur=1;}break;}
    default:if(m.timer>m.dur&&!this.reduced)this.choose(n,m,i);
   }
   if(m.behaviour==='idle'&&m.carrying&&Math.hypot(m.x-DOOR.x,m.z-DOOR.y)<.25){m.carrying=false;}
   const cur=Math.max(0,(m as Mascot&{v?:number}).v??0);const v=damp(cur,target,8,dt);(m as Mascot&{v?:number}).v=v;
   m.x+=Math.cos(m.heading)*v*dt;m.z-=Math.sin(m.heading)*v*dt;
   // Personal space: bodies never interpenetrate (nose-to-nose keeps a small gap).
   const other=n.rats[1-i];if(other){const dx=m.x-other.x,dz=m.z-other.z,d=Math.hypot(dx,dz),min=m.social&&other.social?.9:1.4;if(d<min&&d>1e-4){const push=(min-d)*.5;m.x+=dx/d*push;m.z+=dz/d*push;}else if(d<=1e-4)m.x+=.5;}
   // Smooth gesture blending (overlapping action): head leads, body follows a little later.
   m.head=damp(m.head,head,10,dt);m.rise=damp(m.rise,rise,7,dt);m.yaw=damp(m.yaw,yaw,6,dt);m.hop=damp(m.hop,hop,18,dt);m.distress=damp(m.distress,distress,6,dt);
   const y=this.ground(n,m.x,m.z);m.rat.root.position.set(m.x,y+m.hop,m.z);m.rat.root.rotation.y=m.heading;m.rat.root.updateMatrixWorld(true);m.rat.qualityLevel=this.level;
   const world=m.rat.root.getWorldPosition(new T.Vector3());
   const toWorld=(wx:number,wz:number)=>{const l=n.root.worldToLocal(new T.Vector3(wx,0,wz));return n.root.position.y+this.ground(n,l.x,l.z)+m.hop;};
   m.rat.update(dt,camera.position.distanceTo(world),moving||v>.04||m.behaviour==='walk',Math.max(v,moving?.2:0),this.reduced,false,true,false,m.social,toWorld,false,false,false,undefined,m.distress);
   m.rat.gesture(m.head,m.rise,m.yaw);
   m.prop!.visible=m.carrying||m.behaviour==='carry'&&m.timer>.4||(m.behaviour==='arrange'&&i===0);
   if(m.prop!.visible){m.rat.root.updateMatrixWorld(true);m.rat.mouth(m.prop!.position);this.root.worldToLocal(m.prop!.position);}
  });
 }

 // ---------- state from the preview store -----------------------------------------------------------
 setScore(id:NestId,score:number){
  const n=this.nests.get(id)!;if(n.score===score)return;
  // A snake strike changes the score when it lands, not when it is ordered.
  if(this.snake.busy&&this.snakeTarget===id&&!this.struck&&score<n.score){this.deferred=score;return;}
  const prev=n.score;n.score=score;n.tier=visualTier(score);
  n.target=n.tierEnd[n.tier];if(this.reduced)n.build=n.target;
  if(prev>=0&&score!==prev&&!this.reduced){n.sign.flash=.6;if(score<prev&&visualTier(score)<visualTier(prev))n.shake=Math.max(n.shake,.5);}
 }
 setHover(id:NestId|null){this.hovered=id;}
 play(event:VisualEvent|null){
  if(!event){this.serial=0;for(const n of this.nests.values())n.event=null;return;}if(event.serial===this.serial)return;this.serial=event.serial;
  const n=this.nests.get(event.nest)!;if(event.kind!=='attack'){n.event=event.kind;n.eventAt=this.time;}
  const front=n.root.localToWorld(new T.Vector3(0,FLOOR+.8,2.5));
  if(event.kind==='shield'){n.shieldAt=this.time;}
  if(event.kind==='feed'){n.sackAt=this.time;if(this.reduced)this.text.show('+20',n.design.color,front);}
  if(event.kind==='attack'){
   const blocked=this.time-n.shieldAt<3.6;
   if(this.reduced){n.shake=0;this.text.show(blocked?'Blocked':'-40',blocked?n.design.color:'#ff7a6b',front);return;}
   this.snakeTarget=n.id;this.struck=false;this.deferred=null;this.snake.attack(n.root.localToWorld(new T.Vector3(0,0,3.4)),blocked);this.pendingBlocked=blocked;
  }
 }
 private pendingBlocked=false;private struck=true;private deferred:number|null=null;
 private impact(){
  const n=this.snakeTarget?this.nests.get(this.snakeTarget):undefined;if(!n)return;this.struck=true;if(this.deferred!==null){const d=this.deferred;this.deferred=null;this.setScore(n.id,d);}const front=n.root.localToWorld(new T.Vector3(0,FLOOR+.9,2.6));
  if(this.pendingBlocked){n.shieldAt=Math.max(n.shieldAt,this.time-1);(n.shield.material.uniforms.hit as {value:number}).value=1;this.particles.burst(front,18,3.2,new T.Color(n.design.color),.6,.16,77,{white:.5,gravity:.5});this.text.show('Blocked',n.design.color,front);return;}
  n.shake=1;n.event='attack';n.eventAt=this.time;this.text.show('-40','#ff7a6b',front);
  this.particles.burst(front,22,2.6,new T.Color('#d8b46a'),1.1,.08,91,{up:.9,gravity:4.5});this.particles.burst(front,8,1.6,new T.Color('#ff7a6b'),.5,.2,93,{gravity:0});
 }
 reveal(winner:NestId|null,serial:number){if(serial===this.revealSerial)return;this.revealSerial=serial;this.winner=winner;this.revealAt=this.time;this.fireworks=[];
  for(const n of this.nests.values())n.crownAt=n.id===winner?this.time:-100;
  if(winner&&!this.reduced){const n=this.nests.get(winner)!;for(let i=0;i<5;i++){const a=i/5*Math.PI*2+.4;const p=n.root.localToWorld(new T.Vector3(Math.cos(a)*3.2,0,Math.sin(a)*1.2-2.2));this.fireworks.push({at:this.time+1.9+i*.55,x:p.x,z:p.z,h:5.2+rnd(i+3)*1.4,fired:false,seed:i*57+11});}}
 }

 // ---------- per-frame ------------------------------------------------------------------------------
 update(dt:number,reduced:boolean,level:number,camera:T.Camera){
  dt=clamp(dt,0,.1);this.time+=dt;this.reduced=reduced;this.level=level;this.frame++;
  this.particles.budget=reduced?0:[192,128,72,40][level]??40;if(reduced)this.particles.clear();
  // Point sprites are sized in drawing-buffer pixels: scale with viewport height and field of view.
  const fov=(camera as T.PerspectiveCamera).fov??42;this.particles.points.material.uniforms.scale.value=innerHeight*Math.min(devicePixelRatio,2)*.5/Math.tan(T.MathUtils.degToRad(fov/2));
  for(const n of this.nests.values()){
   // Construction: pieces arrive in order; demolition runs backwards with a crumble.
   const growing=n.target>n.build;const rate=growing?5.5:9;
   n.build=reduced?n.target:growing?Math.min(n.target,n.build+rate*dt):Math.max(n.target,n.build-rate*dt);
   n.pieces.forEach((p,i)=>this.animatePiece(n,p,clamp(n.build-i,0,1),growing));
   // Flag: pinned at the pole, travelling waves plus gusts; drooping when a rival wins.
   const others=this.winner&&this.winner!==n.id&&this.time-this.revealAt<8;n.droop=damp(n.droop,others?1:0,2,dt);
   if(!reduced&&(level<2||this.frame%2===0))this.waveFlag(n);
   // Sign counts up/down towards the score.
   let shown=reduced?n.score:damp(n.sign.shown,n.score,6,dt);if(Math.abs(shown-n.score)<1)shown=n.score;if(shown!==n.sign.shown||n.sign.flash>0){const redraw=Math.round(shown)!==Math.round(n.sign.shown)||n.sign.flash>0;n.sign.shown=shown;n.sign.flash=Math.max(0,n.sign.flash-dt);if(redraw)this.drawSign(n,shown);}
   n.sign.board.scale.setScalar(1+n.sign.flash*.12);
   // Hover / winner / event halo.
   n.hover=damp(n.hover,this.hovered===n.id?1:0,10,dt);const winnerGlow=this.winner===n.id?.55+.2*Math.sin(this.time*3):0;
   const eventGlow=n.event&&this.time-n.eventAt<2.2?.5*(1-(this.time-n.eventAt)/2.2):0;
   n.halo.material.opacity=Math.max(n.hover*.45,winnerGlow,eventGlow);n.halo.material.color.set(this.winner===n.id?'#f2c14e':n.event==='attack'&&eventGlow>0?'#ff7a6b':n.design.color);
   n.halo.scale.setScalar(1+n.hover*.03+(reduced?0:eventGlow*.06*Math.sin(this.time*8)));
   // Shield rise / hold / dissolve.
   const sa=this.time-n.shieldAt,su=n.shield.material.uniforms as Record<string,{value:number}>;n.shield.visible=sa<3.8;
   if(n.shield.visible){su.time.value=this.time;su.rise.value=reduced?1:easeOut(clamp(sa/.55,0,1));su.fade.value=reduced?1:1-clamp((sa-3.1)/.7,0,1);su.hit.value=Math.max(0,su.hit.value-dt*2.5);}
   // Feed delivery: parachute sack sways down, lands with a puff, rats rush to it.
   this.updateSack(n,dt);
   // Shake after a hit (trauma², decays).
   n.shake=Math.max(0,n.shake-dt*1.6);const tr=n.shake*n.shake;n.root.rotation.z=reduced?0:Math.sin(this.time*38)*.02*tr;n.root.rotation.x=reduced?0:Math.cos(this.time*31)*.015*tr;
   // Crown: descends, lands with a bounce, then turns slowly.
   const ca=this.time-n.crownAt,top=this.roofTop(n);n.crown.visible=this.winner===n.id;
   if(n.crown.visible){const t=reduced?9:ca-.6;const y=t<0?top+6:t<1.4?top+6*(1-easeOut(t/1.4))+Math.sin(clamp(t/1.4,0,1)*Math.PI)*.2:top+Math.max(0,Math.sin((t-1.4)*9)*.15*Math.exp(-(t-1.4)*5));
    n.crown.position.set(0,y,CENTER_Z);n.crown.rotation.y=reduced?0:this.time*.6;if(!reduced&&t>=1.4&&t-dt<1.4)this.particles.burst(n.root.localToWorld(new T.Vector3(0,top+.3,CENTER_Z)),26,2.4,new T.Color('#ffe08a'),.9,.1,301,{white:.6,gravity:1});}
   n.lantern.intensity=level===0&&n.build>=n.tierEnd[1]+8?1.1+Math.sin(this.time*7.3)*.08:0;
   this.updateRats(n,dt,camera);
  }
  this.snake.update(reduced?0:dt);if(reduced&&this.snake.busy)this.snake.cancel();
  // Fireworks: rockets with a spark trail, then a peony burst in the company colour with a white core.
  for(const f of this.fireworks){const age=this.time-f.at;if(age<0||f.fired||reduced)continue;const color=new T.Color(NEST_DESIGNS.find(d=>d.id===this.winner)?.color??'#fff');
   if(age<.7){const y=easeOut(age/.7)*f.h;if(this.frame%2===0)this.particles.spawn(new T.Vector3(f.x,y,f.z),new T.Vector3((rnd(f.seed+age*60)-.5)*.3,-.4,(rnd(f.seed+age*90)-.5)*.3),new T.Color('#ffd9a0'),.4,.07,2,1);}
   else{f.fired=true;const at=new T.Vector3(f.x,f.h,f.z);this.particles.burst(at,30,4.6,color,1.8,.16,f.seed,{white:.3,gravity:1.4,drag:1.3});this.particles.burst(at,6,1.1,new T.Color('#fff6d8'),.7,.26,f.seed+9,{gravity:.3});}}
  this.alive=this.particles.update(dt,this.time);this.text.update(dt);
 }
 private animatePiece(n:Nest,p:Piece,f:number,growing:boolean){
  const o=p.obj;o.visible=f>.001;if(!o.visible){p.landed=false;return;}
  o.position.copy(p.home);o.scale.copy(p.scale);o.rotation.x=o.rotation.x;
  if(f>=1){if(!p.landed&&!this.reduced&&growing&&(p.style==='drop'||p.style==='pop')){p.landed=true;const w=n.root.localToWorld(p.home.clone().setY(Math.max(FLOOR,p.home.y)));this.particles.burst(w,6,1.1,new T.Color('#cdb489'),.6,.06,Math.round(w.x*97+w.z*13),{up:.4,gravity:2.2,drag:3});}return;}
  p.landed=false;
  if(!growing){// Crumble: tip, sink and shrink.
   const c=1-f;o.position.y-=c*.35;o.scale.multiplyScalar(Math.max(.001,f));o.position.x+=Math.sin(p.home.x*7)*c*.2;return;}
  if(p.style==='drop'){const e=easeOut(Math.min(1,f/.7));o.position.y+=(1-e)*1.8;const land=f>.7?Math.sin((f-.7)/.3*Math.PI):0;o.scale.set(p.scale.x*(1+land*.1),p.scale.y*(1-land*.16),p.scale.z*(1+land*.1));}
  else if(p.style==='grow'){o.scale.set(p.scale.x,p.scale.y*Math.max(.001,easeBack(f)),p.scale.z);}
  else if(p.style==='unfold'){const e=easeBack(f);o.scale.set(p.scale.x*Math.max(.001,e),p.scale.y,p.scale.z*Math.max(.001,e));}
  else{o.scale.copy(p.scale).multiplyScalar(Math.max(.001,easeBack(f)));}
 }
 private waveFlag(n:Nest){
  const p=n.flag.mesh.geometry.attributes.position as T.BufferAttribute,b=n.flag.base,t=this.time,seed=n.id.charCodeAt(0);
  const gust=.65+.35*Math.sin(t*.37+seed)*Math.sin(t*.61+seed*.5),amp=(.22*gust)*(1-n.droop*.7);
  for(let i=0;i<p.count;i++){const x=b[i*3],y=b[i*3+1],f=x/2.3,e=f*f*(3-2*f);
   const z=(Math.sin(x*2.6-t*4.2+y*.6)*.55+Math.sin(x*4.7-t*6.1+y*1.3)*.25+Math.sin(x*1.3-t*2.2)*.3)*amp*e;
   const sag=-n.droop*.55*f*f-(1-gust)*.08*f;p.setXYZ(i,x-Math.abs(z)*.18,y+sag+Math.sin(x*3-t*3)*.02*e,z);}
  p.needsUpdate=true;n.flag.mesh.geometry.computeVertexNormals();
 }
 private updateSack(n:Nest,dt:number){
  const a=this.time-n.sackAt,s=n.sack;s.visible=a<4.2&&!this.reduced;if(!s.visible)return;
  const land=new T.Vector3(-.95,PORCH,2.55),chute=s.getObjectByName('chute')!;
  if(a<1.6){const e=easeOut(a/1.6);s.position.set(land.x+Math.sin(a*3)*.35*(1-e),land.y+6*(1-e),land.z);s.rotation.z=Math.sin(a*3.2)*.18*(1-e);chute.scale.set(1,1,1);}
  else{s.position.copy(land);s.rotation.z=0;const k=clamp((a-1.6)/.35,0,1);chute.scale.set(1+k*.3,Math.max(.01,1-k),1+k*.3);chute.visible=k<1;
   if(a-dt<1.6){this.particles.burst(n.root.localToWorld(land.clone()),10,1.4,new T.Color('#d9c393'),.8,.07,211,{up:.5,gravity:2.5,drag:3});this.text.show('+20',n.design.color,n.root.localToWorld(land.clone().add(new T.Vector3(0,.8,0))));
    n.rats.forEach((m,i)=>{if(m.behaviour==='flee'||m.behaviour==='hide')return;this.goTo(m,new T.Vector2(land.x+(i?.45:-.45),land.z+.25),i?'sniff':'carry',1.25);m.dur=1.8;});}
   const shrink=clamp((a-3.4)/.8,0,1);s.scale.setScalar(Math.max(.001,1-shrink));}
 }
 private roofTop(n:Nest){const h=STYLE[n.id].dome;return n.build>=n.tierEnd[2]+3?DOME_Y+h+.95:n.build>=n.tierEnd[0]+8?DOME_Y+h+.35:FLOOR+1.2;}
 /** Development aid: run the scene clock forward without rendering (screenshots on slow machines). */
 advance(seconds:number,reduced:boolean,level:number,camera:T.Camera){for(let t=0;t<seconds;t+=1/30)this.update(1/30,reduced,level,camera);}
 anchor(id:NestId){return this.nests.get(id)!.root.position.clone();}
 diagnostics(){return {nests:[...this.nests].map(([id,v])=>({id,position:v.root.position.toArray(),score:v.score,tier:v.tier,build:Math.round(v.build*10)/10,mascots:v.rats.length,crown:v.crown.visible,behaviours:v.rats.map(r=>r.behaviour)})),particles:this.alive,winner:this.winner,snake:this.snake.busy};}
 dispose(){
  for(const n of this.nests.values())for(const m of n.rats){m.rat.dispose();m.prop?.removeFromParent();}
  this.snake.dispose();this.particles.dispose();this.text.dispose();
  this.geos.forEach(g=>g.dispose());this.mats.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());this.kit.dispose();
  this.root.traverse(o=>{if(o instanceof T.Mesh){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(!this.mats.includes(m))m.dispose();});}});
  this.root.removeFromParent();
 }
}
void mergeGeometries;
