// Direct holder burn on the Pons ERC20Burnable token. No approval or spender.
export const BURN_SELECTOR='0x42966c68';
export function burnCall(token:string,amount:bigint){
 if(!/^0x[0-9a-fA-F]{40}$/.test(token)||/^0x0{40}$/i.test(token)||amount<=0n||amount>=1n<<256n)throw new Error('Invalid burn request');
 return {to:token.toLowerCase(),data:BURN_SELECTOR+amount.toString(16).padStart(64,'0'),value:'0x0'};
}
export function tokenUnits(tokens:number,decimals:number){
 if(!Number.isSafeInteger(tokens)||tokens<=0||!Number.isInteger(decimals)||decimals<0||decimals>77)throw new Error('Invalid token amount');
 const amount=BigInt(tokens)*10n**BigInt(decimals);
 if(amount>=1n<<256n)throw new Error('Token amount overflow');
 return amount;
}
