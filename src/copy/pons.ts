export function truncateCA(address: string) {
  if (!address) return "CA pending";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Compact ETH amount for the tape: 0.0123, 0.45, 2.1 */
export function fmtEth(v: number) {
  if (!Number.isFinite(v) || v <= 0) return "0";
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.01) return v.toFixed(3);
  return v.toPrecision(2);
}
