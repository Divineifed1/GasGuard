# GasGuard Gas-Wasting Patterns Library

A comprehensive guide to the **10 most common gas-wasting patterns** in Solidity and Rust smart contracts. Each pattern includes bad code examples, optimized versions, and estimated gas savings.

---

## Table of Contents

1. [Inefficient Storage Access](#1-inefficient-storage-access)
2. [Redundant State Variable Reads](#2-redundant-state-variable-reads)
3. [Unused State Variables](#3-unused-state-variables)
4. [Redundant External Function Visibility](#4-redundant-external-function-visibility)
5. [Inefficient Loop Operations](#5-inefficient-loop-operations)
6. [Unchecked Math Operations](#6-unchecked-math-operations)
7. [Excessive Event Logging](#7-excessive-event-logging)
8. [String Concatenation in Loops](#8-string-concatenation-in-loops)
9. [Dead Code and Unreachable Branches](#9-dead-code-and-unreachable-branches)
10. [Inefficient Type Casting](#10-inefficient-type-casting)

---

## 1. Inefficient Storage Access

**Pattern Description**: Reading from storage (state variables) multiple times instead of caching values in memory.

### Solidity - Bad Code ❌

```solidity
pragma solidity ^0.8.0;

contract BadStorage {
    uint256 public counter;
    address public owner;

    function addMultiple(uint256[] calldata values) external {
        for (uint256 i = 0; i < values.length; i++) {
            counter += values[i];  // SLOAD each iteration
            if (counter > 1000) {
                owner = msg.sender; // SSTORE each iteration
            }
        }
    }
}
```

**Gas Cost**: ~2,100 gas per SLOAD + ~20,000 gas per SSTORE

### Solidity - Optimized Code ✅

```solidity
pragma solidity ^0.8.0;

contract OptimizedStorage {
    uint256 public counter;
    address public owner;

    function addMultiple(uint256[] calldata values) external {
        uint256 _counter = counter; // Cache in memory
        address _owner = owner;
        
        for (uint256 i = 0; i < values.length; i++) {
            _counter += values[i]; // Use memory variable
        }
        
        if (_counter > 1000) {
            _owner = msg.sender;
        }
        
        counter = _counter;
        owner = _owner;
    }
}
```

**Gas Savings**: ~50-70% reduction for loops with 10+ iterations

---

### Rust (Soroban) - Bad Code ❌

```rust
use soroban_sdk::contract;

#[contract]
pub struct BadStorageContract;

#[contract]
impl BadStorageContract {
    pub fn bad_update(env: Env, values: Vec<i128>) {
        let mut counter: i128 = 0;
        
        for val in &values {
            counter += val;
            // Hypothetical: Writing to ledger on each iteration
            env.storage().persistent().set(&counter);
        }
    }
}
```

### Rust (Soroban) - Optimized Code ✅

```rust
use soroban_sdk::contract;

#[contract]
pub struct OptimizedStorageContract;

#[contract]
impl OptimizedStorageContract {
    pub fn optimized_update(env: Env, values: Vec<i128>) {
        let mut counter: i128 = 0;
        
        // All operations in memory
        for val in &values {
            counter += val;
        }
        
        // Single write to storage
        env.storage().persistent().set(&counter);
    }
}
```

**Gas Savings**: ~40-60% reduction (fewer resource units consumed)

---

## 2. Redundant State Variable Reads

**Pattern Description**: Reading the same state variable multiple times in a single function when it could be read once and reused.

### Solidity - Bad Code ❌

```solidity
pragma solidity ^0.8.0;

contract BadRedundantReads {
    uint256 public totalSupply;

    function complexCalculation(uint256 amount) external view returns (uint256) {
        require(amount <= totalSupply, "Exceeds supply"); // SLOAD #1
        uint256 burnt = (totalSupply * 10) / 100; // SLOAD #2
        uint256 available = totalSupply - burnt; // SLOAD #3
        return amount <= available ? amount : available;
    }
}
```

### Solidity - Optimized Code ✅

```solidity
pragma solidity ^0.8.0;

contract OptimizedRedundantReads {
    uint256 public totalSupply;

    function complexCalculation(uint256 amount) external view returns (uint256) {
        uint256 _supply = totalSupply; // SLOAD once
        require(amount <= _supply, "Exceeds supply");
        
        uint256 burnt = (_supply * 10) / 100;
        uint256 available = _supply - burnt;
        return amount <= available ? amount : available;
    }
}
```

**Gas Savings**: ~2,100 gas per redundant SLOAD (2-3 SLOADS eliminated = 4,200-6,300 gas)

---

### Rust (Soroban) - Bad Code ❌

```rust
#[soroban_sdk::contract]
pub struct BadRedundant;

#[soroban_sdk::contractimpl]
impl BadRedundant {
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        let balance = env.storage().persistent().get::<_, i128>(&from); // Read
        if balance < amount { return; }
        
        let new_balance = balance - amount; // Using first read
        let total = env.storage().persistent().get::<_, i128>(&from) + amount; // Read again!
    }
}
```

### Rust (Soroban) - Optimized Code ✅

```rust
#[soroban_sdk::contract]
pub struct OptimizedRedundant;

#[soroban_sdk::contractimpl]
impl OptimizedRedundant {
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        let balance = env.storage().persistent().get::<_, i128>(&from);
        if balance < amount { return; }
        
        let new_balance = balance - amount;
        let total = balance + amount; // Reuse cached value
        env.storage().persistent().set(&new_balance);
    }
}
```

**Gas Savings**: ~1,000-2,000 resource units

---

## 3. Unused State Variables

**Pattern Description**: Declaring state variables that are never read after initialization, wasting storage space.

### Solidity - Bad Code ❌

```solidity
pragma solidity ^0.8.0;

contract BadUnused {
    address public owner;
    address public previousOwner; // Never used after set
    uint256 public deploymentTime; // Never referenced
    bool public isActive;
    
    constructor() {
        owner = msg.sender;
        previousOwner = address(0);
        deploymentTime = block.timestamp;
        isActive = true;
    }

    function updateOwner(address newOwner) external {
        owner = newOwner;
    }
}
```

### Solidity - Optimized Code ✅

```solidity
pragma solidity ^0.8.0;

contract OptimizedUnused {
    address public owner;
    bool public isActive;
    
    constructor() {
        owner = msg.sender;
        isActive = true;
    }

    function updateOwner(address newOwner) external {
        owner = newOwner;
    }
}
```

**Gas Savings**: 
- Initial deployment: ~20,000 gas per unused state variable
- Runtime: ~2,100 gas saved per unused SLOAD

---

### Rust (Soroban) - Bad Code ❌

```rust
#[soroban_sdk::contract]
pub struct BadUnusedVars;

#[soroban_sdk::contractimpl]
impl BadUnusedVars {
    pub fn init(env: Env) {
        env.storage().persistent().set(&"owner", &Address::from_string(&"AAA...")); // OK
        env.storage().persistent().set(&"created_by", &Address::from_string(&"BBB...")); // Never read
        env.storage().persistent().set(&"creation_timestamp", &env.ledger().timestamp()); // Never read
    }
}
```

### Rust (Soroban) - Optimized Code ✅

```rust
#[soroban_sdk::contract]
pub struct OptimizedUnusedVars;

#[soroban_sdk::contractimpl]
impl OptimizedUnusedVars {
    pub fn init(env: Env) {
        env.storage().persistent().set(&"owner", &Address::from_string(&"AAA..."));
    }
}
```

**Gas Savings**: ~1,000-5,000 resource units per unused variable

---

## 4. Redundant External Function Visibility

**Pattern Description**: Using `public` for functions that could be `internal` or `external`, causing unnecessary overhead in some cases.

### Solidity - Bad Code ❌

```solidity
pragma solidity ^0.8.0;

contract BadVisibility {
    uint256 public storedValue;

    // This function is only called internally
    // but declared as public
    function internalCalculation(uint256 x) public view returns (uint256) {
        return x * 2 + storedValue;
    }

    function execute(uint256 input) external {
        uint256 result = this.internalCalculation(input); // Expensive external call
    }
}
```

### Solidity - Optimized Code ✅

```solidity
pragma solidity ^0.8.0;

contract OptimizedVisibility {
    uint256 public storedValue;

    // Changed to internal - no function selector overhead
    function internalCalculation(uint256 x) internal view returns (uint256) {
        return x * 2 + storedValue;
    }

    function execute(uint256 input) external {
        uint256 result = internalCalculation(input); // Direct internal call
    }
}
```

**Gas Savings**: ~700-2,000 gas per internal call made via external dispatch

---

### Rust (Soroban) - Bad Code ❌

```rust
#[soroban_sdk::contract]
pub struct BadVisibility;

#[soroban_sdk::contractimpl]
impl BadVisibility {
    // Exposed as contract function unnecessarily
    pub fn helper_calculation(value: i128) -> i128 {
        value * 2 + 100
    }

    pub fn main_function(input: i128) -> i128 {
        // Calls helper as if it's external
        Self::helper_calculation(input)
    }
}
```

### Rust (Soroban) - Optimized Code ✅

```rust
#[soroban_sdk::contract]
pub struct OptimizedVisibility;

#[soroban_sdk::contractimpl]
impl OptimizedVisibility {
    // Helper is truly internal, not exported
    fn helper_calculation(value: i128) -> i128 {
        value * 2 + 100
    }

    pub fn main_function(input: i128) -> i128 {
        Self::helper_calculation(input)
    }
}
```

**Gas Savings**: ~500-1,500 resource units per function call

---

## 5. Inefficient Loop Operations

**Pattern Description**: Performing expensive operations inside loops that could be done once outside, or using inefficient loop patterns.

### Solidity - Bad Code ❌

```solidity
pragma solidity ^0.8.0;

contract BadLoops {
    address[] public users;

    function processUsers() external {
        for (uint256 i = 0; i < users.length; i++) { // SLOAD on each iteration!
            if (users[i] != address(0)) {
                // Process user
            }
        }
    }

    function sumArray(uint256[] calldata data) external pure returns (uint256) {
        uint256 sum = 0;
        for (uint256 i = 0; i < data.length; i++) { // Repeat length checks
            sum = sum + data[i];
        }
        return sum;
    }
}
```

### Solidity - Optimized Code ✅

```solidity
pragma solidity ^0.8.0;

contract OptimizedLoops {
    address[] public users;

    function processUsers() external {
        address[] memory _users = users; // Cache to memory
        uint256 len = _users.length;
        
        for (uint256 i = 0; i < len; i++) { // No SLOAD
            if (_users[i] != address(0)) {
                // Process user
            }
        }
    }

    function sumArray(uint256[] calldata data) external pure returns (uint256) {
        uint256 sum = 0;
        uint256 len = data.length; // Cache length
        
        for (uint256 i = 0; i < len; ++i) { // Unchecked increment
            sum = sum + data[i];
        }
        return sum;
    }
}
```

**Gas Savings**: ~100-300 gas per iteration in large loops (compounded)

---

### Rust (Soroban) - Bad Code ❌

```rust
#[soroban_sdk::contract]
pub struct BadLoops;

#[soroban_sdk::contractimpl]
impl BadLoops {
    pub fn process_vec(env: Env, data: Vec<i128>) -> i128 {
        let mut sum: i128 = 0;
        
        for i in 0..data.len() {
            // Expensive operations in loop
            sum += data.get(i).unwrap_or(0); // Redundant bounds checks
            // More computation...
        }
        sum
    }
}
```

### Rust (Soroban) - Optimized Code ✅

```rust
#[soroban_sdk::contract]
pub struct OptimizedLoops;

#[soroban_sdk::contractimpl]
impl OptimizedLoops {
    pub fn process_vec(env: Env, data: Vec<i128>) -> i128 {
        let mut sum: i128 = 0;
        
        for item in data.iter() {
            // Iterator eliminates bounds checks
            sum += item;
        }
        sum
    }
}
```

**Gas Savings**: ~2-5% per loop iteration

---

## 6. Unchecked Math Operations

**Pattern Description**: Not using unchecked arithmetic in Solidity when overflow/underflow is impossible, resulting in unnecessary safety checks.

### Solidity - Bad Code ❌

```solidity
pragma solidity ^0.8.0;

contract BadUnchecked {
    function increment(uint256 start) external pure returns (uint256) {
        uint256 count = start;
        
        for (uint256 i = 0; i < 100; i++) {
            count++; // Checked arithmetic, costs extra gas
        }
        
        return count;
    }
}
```

### Solidity - Optimized Code ✅

```solidity
pragma solidity ^0.8.0;

contract OptimizedUnchecked {
    function increment(uint256 start) external pure returns (uint256) {
        uint256 count = start;
        
        for (uint256 i = 0; i < 100; i++) {
            unchecked { count++; } // Skip safety checks we don't need
        }
        
        return count;
    }
}
```

**Gas Savings**: ~100-200 gas per `unchecked` operation

---

### Rust (Soroban) - Bad Code ❌

```rust
#[soroban_sdk::contract]
pub struct BadCheckedMath;

#[soroban_sdk::contractimpl]
impl BadCheckedMath {
    pub fn safe_add(a: i128, b: i128) -> Option<i128> {
        // All additions are checked
        Some(a.checked_add(b).unwrap_or(0))
    }
}
```

### Rust (Soroban) - Optimized Code ✅

```rust
#[soroban_sdk::contract]
pub struct OptimizedCheckedMath;

#[soroban_sdk::contractimpl]
impl OptimizedCheckedMath {
    pub fn safe_add(a: i128, b: i128) -> Option<i128> {
        // Only check when necessary
        a.checked_add(b)
    }
}
```

**Gas Savings**: ~50-150 resource units per operation

---

## 7. Excessive Event Logging

**Pattern Description**: Emitting events with too much data or in loops, when selective logging would suffice.

### Solidity - Bad Code ❌

```solidity
pragma solidity ^0.8.0;

contract BadEvents {
    event Transfer(address indexed from, address indexed to, uint256 amount, 
                   string memo, uint256 timestamp, bool success, bytes data);

    function batchTransfer(address[] calldata recipients, uint256[] calldata amounts) external {
        for (uint256 i = 0; i < recipients.length; i++) {
            // Expensive event with 7 indexed/unindexed parameters
            emit Transfer(msg.sender, recipients[i], amounts[i], 
                         "Batch transfer", block.timestamp, true, msg.data);
        }
    }
}
```

### Solidity - Optimized Code ✅

```solidity
pragma solidity ^0.8.0;

contract OptimizedEvents {
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event BatchTransferCompleted(uint256 count, uint256 totalAmount);

    function batchTransfer(address[] calldata recipients, uint256[] calldata amounts) external {
        uint256 totalAmount = 0;
        
        for (uint256 i = 0; i < recipients.length; i++) {
            // Minimal event data
            emit Transfer(msg.sender, recipients[i], amounts[i]);
            totalAmount += amounts[i];
        }
        
        // Summary event instead of per-item
        emit BatchTransferCompleted(recipients.length, totalAmount);
    }
}
```

**Gas Savings**: ~375 gas per large event eliminated, ~8 gas per small event

---

### Rust (Soroban) - Bad Code ❌

```rust
#[soroban_sdk::contractimpl]
impl BadEvents {
    pub fn batch_process(env: Env, items: Vec<String>) {
        for item in &items {
            // Emits event for every item
            env.events().publish(("process", item.clone()), ());
        }
    }
}
```

### Rust (Soroban) - Optimized Code ✅

```rust
#[soroban_sdk::contractimpl]
impl OptimizedEvents {
    pub fn batch_process(env: Env, items: Vec<String>) {
        let count = items.len();
        
        // Single summary event
        env.events().publish(("batch_completed", count), ());
    }
}
```

**Gas Savings**: ~500-1,000 resource units per suppressed event

---

## 8. String Concatenation in Loops

**Pattern Description**: Building strings by concatenation within loops, causing quadratic complexity.

### Solidity - Bad Code ❌

```solidity
pragma solidity ^0.8.0;

contract BadStringConcat {
    function buildList(string[] calldata items) external pure returns (string memory) {
        string memory result = "";
        
        for (uint256 i = 0; i < items.length; i++) {
            result = string(abi.encodePacked(result, items[i], ",")); // Quadratic!
        }
        
        return result;
    }
}
```

### Solidity - Optimized Code ✅

```solidity
pragma solidity ^0.8.0;

contract OptimizedStringConcat {
    function buildList(string[] calldata items) external pure returns (string memory) {
        bytes[] memory parts = new bytes[](items.length);
        
        for (uint256 i = 0; i < items.length; i++) {
            parts[i] = bytes(items[i]);
        }
        
        return string(abi.encodePacked(parts)); // Linear operation
    }
}
```

**Gas Savings**: ~O(n²) → O(n) complexity, 50-80% reduction for large arrays

---

### Rust (Soroban) - Bad Code ❌

```rust
pub fn build_list(items: Vec<String>) -> String {
    let mut result = String::new();
    
    for item in items {
        result.push_str(&item);
        result.push(','); // Repeated allocations
    }
    
    result
}
```

### Rust (Soroban) - Optimized Code ✅

```rust
pub fn build_list(items: Vec<String>) -> String {
    items.join(",") // Single allocation
}
```

**Gas Savings**: ~60-70% for moderate sizes

---

## 9. Dead Code and Unreachable Branches

**Pattern Description**: Including code paths that are never executed or can be eliminated by constant folding.

### Solidity - Bad Code ❌

```solidity
pragma solidity ^0.8.0;

contract BadDeadCode {
    bool public constant IS_PRODUCTION = false; // Always false, but code exists
    
    function deploy() external {
        if (IS_PRODUCTION) {
            // This code is never executed but still compiled
            require(msg.sender == 0x0, "Not owner");
            require(false, "Unreachable");
        }
    }
    
    function unusedHelper(uint256 x) private pure returns (uint256) {
        return x * 2; // Never called
    }
}
```

### Solidity - Optimized Code ✅

```solidity
pragma solidity ^0.8.0;

contract OptimizedDeadCode {
    // Remove IS_PRODUCTION constant check entirely
    
    function deploy() external {
        // Unreachable code removed
    }
    
    // Remove unusedHelper entirely
}
```

**Gas Savings**: ~100-500 bytes of bytecode reduction, cheaper deployment

---

### Rust (Soroban) - Bad Code ❌

```rust
pub fn process(value: i128) -> i128 {
    if cfg!(debug_assertions) {
        println!("Debug: {}", value); // Won't run in production
    }
    
    let unreachable_var = value * 100; // Computed but never used
    
    value * 2
}
```

### Rust (Soroban) - Optimized Code ✅

```rust
pub fn process(value: i128) -> i128 {
    value * 2
}
```

**Gas Savings**: ~200-1,000 resource units depending on dead code volume

---

## 10. Inefficient Type Casting

**Pattern Description**: Unnecessary type conversions or casting to smaller types that require masking operations.

### Solidity - Bad Code ❌

```solidity
pragma solidity ^0.8.0;

contract BadCasting {
    function processData(bytes memory data) external pure returns (uint256) {
        uint256 value = 0;
        
        for (uint256 i = 0; i < data.length; i++) {
            // Converting bytes to uint256 repeatedly
            uint256 byteVal = uint256(uint8(data[i]));
            value += byteVal;
        }
        
        return value;
    }
}
```

### Solidity - Optimized Code ✅

```solidity
pragma solidity ^0.8.0;

contract OptimizedCasting {
    function processData(bytes memory data) external pure returns (uint256) {
        uint256 value = 0;
        
        assembly {
            // Direct memory read, no conversion overhead
            let ptr := add(data, 32)
            let end := add(ptr, mload(data))
            
            for {} lt(ptr, end) {} {
                value := add(value, mload(ptr))
                ptr := add(ptr, 1)
            }
        }
        
        return value;
    }
}
```

**Gas Savings**: ~10-50 gas per cast eliminated

---

### Rust (Soroban) - Bad Code ❌

```rust
pub fn process_amounts(values: Vec<i128>) -> i64 {
    let mut total: i64 = 0;
    
    for val in values {
        // Repeated casting from i128 to i64
        total += val as i64;
    }
    
    total
}
```

### Rust (Soroban) - Optimized Code ✅

```rust
pub fn process_amounts(values: Vec<i64>) -> i64 {
    // Accept correct type from start
    values.iter().sum()
}
```

**Gas Savings**: ~5-15 resource units per cast avoided

---

## Summary Table

| Pattern | Solidity Savings | Rust Savings | Difficulty |
|---------|------------------|--------------|-----------|
| Inefficient Storage Access | 50-70% | 40-60% | Medium |
| Redundant State Reads | 4,200-6,300 gas | 1-2K units | Easy |
| Unused Variables | 20K+ (deploy) | 1-5K units | Easy |
| External Visibility | 700-2,000 gas | 500-1.5K units | Easy |
| Loop Operations | 100-300 per iter | 2-5% | Medium |
| Unchecked Math | 100-200 per op | 50-150 units | Easy |
| Event Logging | 375+ per event | 500-1K units | Medium |
| String Concat | 50-80% | 60-70% | Hard |
| Dead Code | 100-500 bytes | 200-1K units | Easy |
| Type Casting | 10-50 gas | 5-15 units | Easy |

---

## Reference for Future Rules

When adding new scanner rules to GasGuard, reference this library to:
- ✅ Understand the cost breakdown of each pattern
- ✅ Validate estimated gas savings figures
- ✅ Provide users with educational context
- ✅ Create sample code for test cases

---

## Contributing

Found a new gas-wasting pattern? Submit a PR to expand this library with:
1. Clear description of the anti-pattern
2. Bad code example (both Solidity and Rust)
3. Optimized version with explanation
4. Estimated gas savings
5. Difficulty level for scanner implementation

