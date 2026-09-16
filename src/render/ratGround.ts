import {CONFIG} from '../config';
import {NEST_POS} from '../sim/colony';
import {habitatRoutes,platformHeight} from '../sim/habitatLayout';
import {MathUtils} from 'three';
export function ratGround(x:number,z:number){const sx=x*30+CONFIG.colony.burrowWidth/2,sy=z*30+CONFIG.colony.burrowHeight/2;
 let h=-.1+.25*(1-MathUtils.smoothstep(Math.hypot(sx-NEST_POS.x,sy-NEST_POS.y)/30,2.55,3));
 for(const route of habitatRoutes){const d=Math.hypot(sx-route[81].x,sy-route[81].z)/30;h=Math.max(h,-.1+.21*(1-MathUtils.smoothstep(d,2.1,2.4)),d<.65?.11+.035*(1-MathUtils.smoothstep(d,.55,.65)):-.1);}
 return Math.max(h,-.1+platformHeight(sx,sy)/30);
}
