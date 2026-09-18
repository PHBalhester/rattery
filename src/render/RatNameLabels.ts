import * as T from 'three';
/** Screen-sized labels; textContent keeps user-selected names out of HTML. */
export class RatNameLabels {
 private layer=document.createElement('div');private labels=new Map<string,HTMLElement>();private seen=new Set<string>();private occupied:{x:number;y:number;width:number}[]=[];
 constructor(host:HTMLElement){this.layer.className='rat-name-labels';this.layer.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1';host.append(this.layer);}
 begin(){this.seen.clear();this.occupied=[];}
 show(id:string,name:string,root:T.Object3D,camera:T.Camera,petting=false){
  root.updateWorldMatrix(true,true);camera.updateMatrixWorld();
  const head=root.getObjectByName('head'),scale=root.getWorldScale(new T.Vector3());
  const at=head?head.getWorldPosition(new T.Vector3()):root.localToWorld(new T.Vector3(0,.8,0));at.y+=.48*Math.max(.1,scale.y);
  const view=at.clone().applyMatrix4(camera.matrixWorldInverse);const p=at.project(camera);
  if(view.z>=0||p.z< -1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1)return;
  this.seen.add(id);let label=this.labels.get(id);if(!label){label=document.createElement('span');label.className='rat-name-label';label.dataset.ratId=id;label.style.cssText='position:absolute;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:3px 7px;border:1px solid #ffffff25;border-radius:4px;background:#10141299;color:#f4f1e8cf;font:500 11px/14px system-ui,sans-serif;letter-spacing:.03em;box-shadow:0 2px 8px #0002;transform:translate(-50%,-100%);pointer-events:none';this.layer.append(label);this.labels.set(id,label);}
  label.classList.toggle('is-petting',petting);label.textContent=name;label.title=name;label.hidden=false;
  const width=this.layer.clientWidth,height=this.layer.clientHeight,w=Math.min(164,label.offsetWidth),x=Math.max(w/2,Math.min(width-w/2,(p.x*.5+.5)*width));let y=Math.max(25,Math.min(height,(.5-p.y*.5)*height));
  for(let i=0;i<8&&this.occupied.some(q=>Math.abs(q.x-x)<(q.width+w)/2+4&&Math.abs(q.y-y)<24);i++)y-=24;
  if(y<22){label.hidden=true;return;}this.occupied.push({x,y,width:w});label.style.left=x+'px';label.style.top=y+'px';
 }
 end(){for(const [id,label]of this.labels)if(!this.seen.has(id)){label.remove();this.labels.delete(id);}}
 dispose(){this.layer.remove();this.labels.clear();}
}
