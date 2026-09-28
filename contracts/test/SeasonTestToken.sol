// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
contract SeasonTestToken is ERC20, ERC20Burnable {
    bool public failBurn;
    bool public fakeBurn;
    constructor() ERC20("Local Season Test", "TEST") { _mint(msg.sender, 10**30); }
    function setFailure(bool fail_, bool fake_) external { failBurn = fail_; fakeBurn = fake_; }
    function burn(uint256 amount) public override { require(!failBurn, "burn failed"); if (!fakeBurn) super.burn(amount); }
}
