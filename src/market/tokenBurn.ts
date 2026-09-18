// Native burns reduce totalSupply. Dead-address transfers are not counted.
export const RATTERY_INITIAL_SUPPLY = 1_000_000_000;
const RATTERY = '0xc322305e79337300b59ff48389f8c9a1d9e0de76';
export function tokenBurn(chain: {ok: boolean; chainId: number; token?: {address: string; supply?: number | null}} | null) {
 const supply=chain?.token?.supply;
 if(!chain?.ok || chain.chainId!==4663 || chain.token?.address.toLowerCase()!==RATTERY || typeof supply!=='number' || !Number.isFinite(supply) || supply<0 || supply>RATTERY_INITIAL_SUPPLY) return null;
 const amount=RATTERY_INITIAL_SUPPLY-supply;
 return {amount,percent:amount/RATTERY_INITIAL_SUPPLY*100};
}
