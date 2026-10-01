/** Immutable Season I identifiers. No payment signer is configured here. */
export const CHAIN = 4663;
export const TREASURY = '0xd40ed0214353b746fd567fa4a57409d1b5709988';
export const ROUTER = '0x2374a8a715f5ca87ae43609c9bdc74691d5b7b57';
export const TOKEN = '0xc322305e79337300b59ff48389f8c9a1d9e0de76';
export const BIRTH_BLOCK = 65848849;
export const SEASON = 'RATTERY-SEASON-1-2026-09-28';
export const STOCKS = [
    '0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec',
    '0xaf3d76f1834a1d425780943c99ea8a608f8a93f9',
    '0x12f190a9f9d7d37a250758b26824b97ce941bf54',
] as const;
export const EXCLUDED = [
    '0x0000000000000000000000000000000000000000',
    '0x000000000000000000000000000000000000dead',
    TREASURY, ROUTER,
    '0xb476efac1611d4e3bc5a01121a15b44676ae496e',
    '0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e',
    '0xe5e702641ea86f4ae6cc3cdaed2b886f976be044',
    '0x267444d099b10fb5ed7c3cc7b7c767adca574952',
    '0x8366a39cc670b4001a1121b8f6a443a643e40951',
    '0x0f5d652f31b1221db5cd71f8b0fe4b9bf3b4736b',
];
export const PAYOUT_ABI = [
    'constructor(address token_,address operator_,uint64 closesAt_)',
    'function token() view returns(address)', 'function operator() view returns(address)',
    'function closesAt() view returns(uint64)', 'function root() view returns(bytes32)',
    'function manifestHash() view returns(bytes32)', 'function remaining() view returns(uint256)',
    'function paid(uint256) view returns(bool)',
    'function fund(bytes32,bytes32,uint256)',
    'function pay(uint256,address,uint256,bytes32[])',
    'event Paid(uint256 indexed index,address indexed wallet,uint256 amount)',
];
