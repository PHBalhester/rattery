// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
interface IPayoutToken {function balanceOf(address) external view returns(uint256);function transfer(address,uint256) external returns(bool);function transferFrom(address,address,uint256) external returns(bool);}
/// @notice Immutable funded distribution; anyone can deliver a proven payment to its fixed wallet.
/// @dev No arbitrary calls, swaps, recipient edits, fee withdrawals or signing keys.
contract SeasonPayout {
 IPayoutToken public immutable token; address public immutable operator; uint64 public immutable closesAt;
 bytes32 public root; bytes32 public manifestHash; uint256 public remaining; bool private busy;
 mapping(uint256=>uint256) private paidWords;
 event Funded(bytes32 indexed manifestHash,bytes32 root,uint256 amount);
 event Paid(uint256 indexed index,address indexed wallet,uint256 amount);
 modifier lock(){require(!busy,"Reentrancy");busy=true;_;busy=false;}
 constructor(address token_,address operator_,uint64 closesAt_){require(token_.code.length>0&&operator_!=address(0)&&closesAt_>0,"Config");token=IPayoutToken(token_);operator=operator_;closesAt=closesAt_;}
 function safe(bytes memory data) private { (bool ok,bytes memory result)=address(token).call(data);require(ok&&(result.length==0||abi.decode(result,(bool))),"Token transfer"); }
 function fund(bytes32 root_,bytes32 manifest_,uint256 amount) external lock {
  require(msg.sender==operator&&block.timestamp>=closesAt&&root==bytes32(0)&&root_!=bytes32(0)&&manifest_!=bytes32(0)&&amount>0,"Funding");
  uint256 beforeBalance=token.balanceOf(address(this));root=root_;manifestHash=manifest_;remaining=amount;
  safe(abi.encodeCall(token.transferFrom,(msg.sender,address(this),amount)));require(token.balanceOf(address(this))==beforeBalance+amount,"Funding mismatch");emit Funded(manifest_,root_,amount);
 }
 function paid(uint256 index) public view returns(bool){return paidWords[index>>8]&(1<<(index&255))!=0;}
 function pay(uint256 index,address wallet,uint256 amount,bytes32[] calldata proof) external lock {
  require(root!=bytes32(0)&&!paid(index)&&wallet!=address(0)&&wallet!=address(this)&&amount>0&&amount<=remaining,"Payment");
  bytes32 hash=keccak256(bytes.concat(keccak256(abi.encode(block.chainid,address(this),index,wallet,amount))));
  for(uint256 i=0;i<proof.length;i++){bytes32 other=proof[i];hash=hash<other?keccak256(abi.encodePacked(hash,other)):keccak256(abi.encodePacked(other,hash));}require(hash==root,"Proof");
  paidWords[index>>8]|=1<<(index&255);remaining-=amount;
  uint256 beforeBalance=token.balanceOf(wallet);uint256 beforeContract=token.balanceOf(address(this));safe(abi.encodeCall(token.transfer,(wallet,amount)));
  require(token.balanceOf(wallet)==beforeBalance+amount&&token.balanceOf(address(this))+amount==beforeContract,"Payment mismatch");emit Paid(index,wallet,amount);
 }
}
