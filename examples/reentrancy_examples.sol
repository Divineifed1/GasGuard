// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ReentrancyExamples {
    mapping(address => uint256) public balances;
    bool private locked;

    // Reentrancy Guard Modifier
    modifier nonReentrant() {
        require(!locked, "ReentrancyGuard: reentrant call");
        locked = true;
        _;
        locked = false;
    }

    // VULNERABLE: Direct transfer without guard
    function vulnerableWithdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0);

        // VULNERABLE: External call before state update
        payable(msg.sender).transfer(amount);
        balances[msg.sender] = 0;
    }

    // VULNERABLE: send() without guard
    function vulnerableSend() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0);

        // VULNERABLE: External call before state update
        bool success = payable(msg.sender).send(amount);
        require(success);
        balances[msg.sender] = 0;
    }

    // VULNERABLE: call() without guard
    function vulnerableCall() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0);

        // VULNERABLE: External call before state update
        (bool success,) = payable(msg.sender).call{value: amount}("");
        require(success);
        balances[msg.sender] = 0;
    }

    // SECURE: Direct transfer with guard
    function secureWithdraw() external nonReentrant {
        uint256 amount = balances[msg.sender];
        require(amount > 0);

        balances[msg.sender] = 0;
        // SECURE: State update before external call
        payable(msg.sender).transfer(amount);
    }

    // SECURE: send() with guard
    function secureSend() external nonReentrant {
        uint256 amount = balances[msg.sender];
        require(amount > 0);

        balances[msg.sender] = 0;
        // SECURE: State update before external call
        bool success = payable(msg.sender).send(amount);
        require(success);
    }

    // SECURE: call() with guard
    function secureCall() external nonReentrant {
        uint256 amount = balances[msg.sender];
        require(amount > 0);

        balances[msg.sender] = 0;
        // SECURE: State update before external call
        (bool success,) = payable(msg.sender).call{value: amount}("");
        require(success);
    }

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }
}