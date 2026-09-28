import {Interface, TypedDataEncoder, getAddress, verifyTypedData} from 'ethers';
export interface SeasonBurnConfig {chainId:4663|46630;router:string;token:string;quoteSigner:string;}
export interface SeasonQuote {
 season:string;wallet:string;nonce:bigint;membership:bigint;kind:number;nest:number;
 amount:bigint;usdCents:bigint;issuedAt:bigint;expiresAt:bigint;
}
export const SEASON_QUOTE_TYPES={Quote:[
 {name:'season',type:'bytes32'},{name:'wallet',type:'address'},{name:'nonce',type:'uint256'},
 {name:'membership',type:'uint256'},{name:'kind',type:'uint8'},{name:'nest',type:'uint8'},
 {name:'amount',type:'uint256'},{name:'usdCents',type:'uint256'},{name:'issuedAt',type:'uint64'},{name:'expiresAt',type:'uint64'},
]};
export const SEASON_ACTION_ABI=[
 'function execute((bytes32 season,address wallet,uint256 nonce,uint256 membership,uint8 kind,uint8 nest,uint256 amount,uint256 usdCents,uint64 issuedAt,uint64 expiresAt) q,bytes signature)',
 'event ActionExecuted(bytes32 indexed quoteHash,address indexed wallet,uint256 indexed membership,uint256 nonce,uint8 kind,uint8 nest,uint256 amount,uint256 usdCents,uint256 points,uint256 damage,bool blocked)',
];
export const seasonActionInterface=new Interface(SEASON_ACTION_ABI);
const erc20=new Interface(['function approve(address spender,uint256 amount) returns(bool)']);
function address(value:string){const a=getAddress(value);if(/^0x0{40}$/i.test(a))throw Error('Zero address');return a;}
export function seasonQuoteDomain(config:SeasonBurnConfig){
 if(![4663,46630].includes(config.chainId))throw Error('Wrong season chain');
 address(config.token);address(config.quoteSigner);
 return {name:'RATTERY Season Actions',version:'1',chainId:config.chainId,verifyingContract:address(config.router)};
}
export function validateSeasonQuote(q:SeasonQuote){
 address(q.wallet);
 if(!/^0x[0-9a-fA-F]{64}$/.test(q.season)||/^0x0{64}$/i.test(q.season)||!Number.isInteger(q.kind)||q.kind<0||q.kind>3||!Number.isInteger(q.nest)||q.nest<1||q.nest>3)throw Error('Invalid season action');
 for(const value of [q.nonce,q.membership,q.amount,q.usdCents])if(typeof value!=='bigint'||value<0n||value>=1n<<256n)throw Error('Invalid quote units');
 for(const value of [q.issuedAt,q.expiresAt])if(typeof value!=='bigint'||value<0n||value>=1n<<64n)throw Error('Invalid quote time');
 if(q.amount===0n||q.expiresAt<=q.issuedAt||q.expiresAt-q.issuedAt>60n)throw Error('Invalid quote lifetime');
 const prices=q.kind===0?[1000n,1500n,2000n,3000n]:[[200n],[1000n],[2000n]][q.kind-1];
 if(!prices.includes(q.usdCents))throw Error('Invalid action price');
}
export function seasonQuoteHash(config:SeasonBurnConfig,q:SeasonQuote){validateSeasonQuote(q);return TypedDataEncoder.hash(seasonQuoteDomain(config),SEASON_QUOTE_TYPES,q);}
/** Approval is exact amount, never unlimited. No send/sign operation is performed here. */
export function seasonApprovalCall(config:SeasonBurnConfig,q:SeasonQuote){
 seasonQuoteHash(config,q);return {to:address(config.token),data:erc20.encodeFunctionData('approve',[address(config.router),q.amount]),value:'0x0'};
}
/** Only signed router calls qualify for Season actions; never fall back to direct burn. */
export function seasonBurnCall(config:SeasonBurnConfig,q:SeasonQuote,signature:string){
 validateSeasonQuote(q);
 if(getAddress(verifyTypedData(seasonQuoteDomain(config),SEASON_QUOTE_TYPES,q,signature))!==address(config.quoteSigner))throw Error('Wrong quote signer');
 return {to:address(config.router),data:seasonActionInterface.encodeFunctionData('execute',[q,signature]),value:'0x0'};
}
