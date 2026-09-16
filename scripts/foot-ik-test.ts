import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {kneeTarget} from '../src/render/FootMotor';
for(const target of [new Vector3(),new Vector3(5,0,0),new Vector3(0,-.25,0),new Vector3(.1,-.3,.1),new Vector3(-.4,0,0)]){
 const hip=new Vector3(),a=.2,b=.17;const result=kneeTarget(hip,target,new Vector3(1,0,0),a,b);
 assert(Math.abs(result.knee.distanceTo(hip)-a)<1e-6);assert(Math.abs(result.knee.distanceTo(result.ankle)-b)<1e-6);assert(result.ankle.toArray().every(Number.isFinite));
}console.log('PASS: two-bone lengths preserved, unreachable targets clamped, pole singularities finite');
