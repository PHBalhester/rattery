import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {SiweMessage} from 'siwe';
import {getAddress} from 'ethers';
import type {Pool} from 'pg';
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export class StagingAuth{
 constructor(readonly pool:Pool,readonly origin:string,readonly clock=Date.now){
  const u=new URL(origin);
  if(u.origin!==origin||!(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname))))throw Error('Invalid auth origin');
 }
 async challenge(address:string){
  const wallet=getAddress(address),now=this.clock(),id=randomUUID();
  const message=new SiweMessage({domain:new URL(this.origin).host,address:wallet,statement:'Sign in to RATTERY staging. This verifies wallet ownership only; no token transfer, approval or mint is authorized.',uri:this.origin,version:'1',chainId:46630,nonce:randomBytes(24).toString('hex'),issuedAt:new Date(now).toISOString(),expirationTime:new Date(now+300000).toISOString()}).prepareMessage();
  await this.pool.query('INSERT INTO auth_challenges(id,wallet,message,expires_at) VALUES($1,$2,$3,$4)',[id,wallet.toLowerCase(),message,now+300000]);
  return {id,message};
 }
 async verify(id:string,message:string,signature:string){
  if(typeof message!=='string'||message.length>4096||typeof signature!=='string'||!/^0x[0-9a-fA-F]{130}$/.test(signature))throw Error('Invalid authentication');
  const client=await this.pool.connect();
  try{
   await client.query('BEGIN');
   const {rows}=await client.query('SELECT * FROM auth_challenges WHERE id=$1 FOR UPDATE',[id]),c=rows[0],now=this.clock();
   if(!c||c.consumed||Number(c.expires_at)<=now||c.message!==message)throw Error('Invalid authentication');
   const parsed=new SiweMessage(message);
   if(parsed.chainId!==46630||parsed.uri!==this.origin||parsed.domain!==new URL(this.origin).host||parsed.address.toLowerCase()!==c.wallet)throw Error('Invalid authentication');
   // EOA only in this staging milestone; no implicit contract-wallet fallback.
   const result=await parsed.verify({signature,domain:new URL(this.origin).host,nonce:parsed.nonce,time:new Date(now).toISOString()});
   if(!result.success)throw Error('Invalid authentication');
   const token=randomBytes(32).toString('hex');
   await client.query('UPDATE auth_challenges SET consumed=true WHERE id=$1',[id]);
   await client.query('INSERT INTO auth_sessions(digest,wallet,expires_at) VALUES($1,$2,$3)',[digest(token),c.wallet,now+3600000]);
   await client.query('COMMIT');return token;
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
 async wallet(token:string){
  if(typeof token!=='string'||! /^[0-9a-f]{64}$/.test(token))throw Error('Unauthorized');
  const {rows}=await this.pool.query('SELECT wallet FROM auth_sessions WHERE digest=$1 AND expires_at>$2',[digest(token),this.clock()]);
  if(!rows[0])throw Error('Unauthorized');return rows[0].wallet as string;
 }
 async logout(token:string){await this.pool.query('DELETE FROM auth_sessions WHERE digest=$1',[digest(token)]);}
}
