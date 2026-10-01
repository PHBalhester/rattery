import { AbiCoder, keccak256, concat, toUtf8Bytes } from 'ethers';
import { addr } from './math.js';
const abi = AbiCoder.defaultAbiCoder();
export function canonical(value: any): string { if (typeof value === 'bigint')
    return JSON.stringify(value.toString()); if (Array.isArray(value))
    return '[' + value.map(canonical).join(',') + ']'; if (value && typeof value === 'object')
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}'; if (value === undefined || typeof value === 'number' && !Number.isSafeInteger(value))
    throw Error('Noncanonical value'); return JSON.stringify(value); }
export const digest = (value: any) => keccak256(toUtf8Bytes(canonical(value)));
export function leaf(chainId: number, distributor: string, index: number, wallet: string, amount: bigint) { if (!Number.isSafeInteger(index) || index < 0 || amount <= 0n)
    throw Error('Invalid leaf'); return keccak256(keccak256(abi.encode(['uint256', 'address', 'uint256', 'address', 'uint256'], [chainId, addr(distributor), index, addr(wallet), amount]))); }
const pair = (a: string, b: string) => keccak256(concat(a < b ? [a, b] : [b, a]));
export function tree(chainId: number, distributor: string, rows: {
    wallet: string;
    amount: bigint;
}[]) { if (![4663, 46630, 31337].includes(chainId) || !rows.length || new Set(rows.map(r => addr(r.wallet))).size !== rows.length)
    throw Error('Invalid distribution'); if (rows.some(r => addr(r.wallet) === '0x' + '0'.repeat(40) || addr(r.wallet) === addr(distributor)))
    throw Error('Invalid recipient'); rows = [...rows].sort((a, b) => addr(a.wallet).localeCompare(addr(b.wallet))); const leaves = rows.map((r, i) => leaf(chainId, distributor, i, r.wallet, r.amount)), levels = [leaves]; while (levels.at(-1)!.length > 1) {
    const prev = levels.at(-1)!, next = [];
    for (let i = 0; i < prev.length; i += 2)
        next.push(i + 1 < prev.length ? pair(prev[i], prev[i + 1]) : prev[i]);
    levels.push(next);
} return { root: levels.at(-1)![0], total: rows.reduce((s, r) => s + r.amount, 0n), payments: rows.map((r, index) => { let i = index; const proof = []; for (const level of levels.slice(0, -1)) {
        const sibling = i ^ 1;
        if (sibling < level.length)
            proof.push(level[sibling]);
        i = Math.floor(i / 2);
    } return { ...r, index, proof }; }) }; }
export function verify(root: string, hash: string, proof: string[]) { for (const p of proof)
    hash = pair(hash, p); return hash === root; }
