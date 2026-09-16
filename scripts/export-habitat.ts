import {writeFileSync} from 'node:fs';
import {CONFIG} from '../src/config';
import {NEST_POS} from '../src/sim/colony';
import {tunnelRoutes,lateralRoutes,platformPaths,platformHeight,toyApproaches} from '../src/sim/habitatLayout';
const points=(path:any[])=>path.map(p=>[p.x,p.z]);
writeFileSync('art/habitat/layout.json',JSON.stringify({width:CONFIG.colony.burrowWidth,height:CONFIG.colony.burrowHeight,nest:NEST_POS,tunnels:tunnelRoutes.map(points),lateral:lateralRoutes.map(points),platforms:platformPaths.map(p=>p.points.slice(1).map((b,k)=>Array.from({length:33},(_,i)=>{const a=p.points[k];const q=a.clone().lerp(b,i/32);return [q.x,q.z,-.1+platformHeight(q.x,q.z)/30]}))),toys:toyApproaches.map(a=>({id:a.toy,contact:[a.contact.x,a.contact.z]}))},null,2));
