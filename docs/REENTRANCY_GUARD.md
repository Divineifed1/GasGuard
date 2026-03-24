# Reentrancy Guard Implementation

## Overview

This document describes the implementation of reentrancy guard detection in GasGuard's Solidity analyzer. Reentrancy attacks are one of the most common and dangerous vulnerabilities in smart contracts, allowing attackers to drain funds by repeatedly calling vulnerable functions before the contract state is updated.

## Problem

Reentrancy vulnerabilities occur when a contract makes an external call to another contract before updating its own state. An attacker can exploit this by having their malicious contract call back into the vulnerable contract during the external call, potentially multiple times.

### Example of Vulnerable Code

```solidity
contract VulnerableBank {
    mapping(address => uint256) public balances;

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance");

        // VULNERABLE: External call before state update
        (bool success,) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        balances[msg.sender] = 0; // State update after external call
    }
}
```

### Attack Scenario

1. Attacker deposits funds into the contract
2. Attacker calls `withdraw()`
3. Contract sends ETH to attacker
4. Attacker's `fallback()` or `receive()` function calls `withdraw()` again
5. Contract hasn't updated state yet, so it sends ETH again
6. This can repeat until contract is drained

## Solution

### Reentrancy Guard Pattern

The standard solution is to use a reentrancy guard modifier that prevents reentrant calls:

```solidity
contract SecureBank {
    mapping(address => uint256) public balances;
    bool private locked;

    modifier nonReentrant() {
        require(!locked, "ReentrancyGuard: reentrant call");
        locked = true;
        _;
        locked = false;
    }

    function withdraw() external nonReentrant {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance");

        balances[msg.sender] = 0; // State update before external call

        // SECURE: External call after state update
        (bool success,) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
}
```

### Checks-Effects-Interactions Pattern

Always follow this pattern:
1. **Checks**: Validate inputs and conditions
2. **Effects**: Update contract state
3. **Interactions**: Make external calls

## Implementation Details

### Detection Logic

The GasGuard analyzer detects missing reentrancy guards by:

1. **Identifying Transfer Functions**: Scanning for functions that make external calls with ETH transfers:
   - `.transfer()`
   - `.send()`
   - `.call{value: ...}()`
   - `payable(...).transfer()`
   - `payable(...).send()`

2. **Checking for Guards**: Looking for reentrancy guard modifiers:
   - `nonReentrant`
   - `noReentrancy`
   - `reentrancyGuard`
   - `lock`

3. **Function Body Analysis**: Analyzing the order of operations within functions to detect when external calls happen before state updates.

### Rule Configuration

- **Rule ID**: `sol-006`
- **Severity**: `CRITICAL`
- **Category**: `security`
- **Tags**: `security`, `reentrancy`, `vulnerability`

### Supported Transfer Patterns

The analyzer detects the following transfer patterns:

```solidity
// Direct transfers
payable(addr).transfer(amount);
payable(addr).send(amount);

// Low-level calls with value
(bool success,) = addr.call{value: amount}("");
(bool success,) = payable(addr).call{value: amount}("");

// Address function calls
address(addr).call{value: amount}("");
```

## Usage

### In Code Analysis

```typescript
import { GasGuardEngine } from '@gasguard/engine';

const engine = new GasGuardEngine();
const result = await engine.scan({
  language: 'solidity',
  source: contractSourceCode
});

// Check for reentrancy issues
const reentrancyIssues = result.issues.filter(
  issue => issue.ruleId === 'sol-006'
);
```

### Example Output

```json
{
  "issues": [
    {
      "ruleId": "sol-006",
      "severity": "critical",
      "message": "Function transfers ETH/tokens but lacks reentrancy guard",
      "line": 15,
      "suggestion": "Add reentrancy guard modifier to prevent reentrancy attacks"
    }
  ]
}
```

## Testing

### Test Cases

The implementation includes comprehensive tests covering:

1. **Vulnerable Contracts**: Detection of missing guards in contracts with external calls
2. **Secure Contracts**: No false positives for properly guarded functions
3. **Multiple Patterns**: Detection of various transfer methods
4. **Complex Scenarios**: Multiple vulnerable functions in single contract

### Running Tests

```bash
npm test -- solidity_reentrancy.spec.ts
```

## Best Practices

### Implementing Guards

1. **Use Established Libraries**: Consider using OpenZeppelin's `ReentrancyGuard`
2. **Consistent Naming**: Use `nonReentrant` modifier name consistently
3. **State Updates First**: Always update state before external calls
4. **Minimal External Calls**: Reduce external call surface area

### OpenZeppelin Example

```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SecureContract is ReentrancyGuard {
    function withdraw() external nonReentrant {
        // Implementation
    }
}
```

## Limitations

- **Static Analysis**: Cannot detect all runtime reentrancy scenarios
- **Modifier Detection**: Only detects explicit guard modifiers
- **Complex Logic**: May miss reentrancy in complex control flow
- **Delegate Calls**: Does not detect reentrancy through delegatecall

## Future Enhancements

- **Advanced Pattern Detection**: More sophisticated control flow analysis
- **Delegatecall Support**: Detection of cross-contract reentrancy
- **Gas Estimation**: Impact analysis for reentrancy exploits
- **Automated Fixes**: Code transformation suggestions

## References

- [Ethereum Smart Contract Best Practices - Reentrancy](https://consensys.github.io/smart-contract-best-practices/attacks/reentrancy/)
- [OpenZeppelin ReentrancyGuard](https://docs.openzeppelin.com/contracts/4.x/api/security#ReentrancyGuard)
- [The DAO Hack Analysis](https://blog.openzeppelin.com/15-lines-of-code-that-could-have-prevented-the-dao-hack/)