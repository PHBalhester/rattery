// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
contract PayoutTestToken {
 mapping(address=>uint256) public balanceOf;
 mapping(address=>mapping(address=>uint256)) public allowance;
 mapping(address=>bool) public blocked;
 address public reentryTarget; bytes public reentryData;
 function setReentry(address target,bytes calldata data) external {reentryTarget=target;reentryData=data;}
 uint256 public totalSupply; bool public fee; bool public returnsFalse;
 function decimals() external pure returns(uint8){return 18;}
 function mint(address w,uint256 n) external {balanceOf[w]+=n;totalSupply+=n;}
 function setBlocked(address w,bool b) external {blocked[w]=b;}
 function setFailure(bool fee_,bool false_) external {fee=fee_;returnsFalse=false_;}
 function approve(address spender,uint256 n) external returns(bool){allowance[msg.sender][spender]=n;return true;}
 function transfer(address w,uint256 n) external returns(bool){if(returnsFalse)return false;move(msg.sender,w,n);return true;}
 function transferFrom(address a,address b,uint256 n) external returns(bool){if(returnsFalse)return false;require(allowance[a][msg.sender]>=n);allowance[a][msg.sender]-=n;move(a,b,n);return true;}
 function move(address a,address b,uint256 n) private {require(!blocked[b]&&balanceOf[a]>=n);balanceOf[a]-=n;balanceOf[b]+=fee?n-1:n;if(fee)totalSupply--;if(reentryTarget!=address(0)){(bool ok,)=reentryTarget.call(reentryData);require(!ok,"Reentry unexpectedly succeeded");}}
}
contract PayoutActionMock {function colonySlot() external pure returns(uint32){return 930;}}
