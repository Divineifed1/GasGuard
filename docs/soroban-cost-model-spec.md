# Soroban Resource Cost Model Specification

**Version:** 1.0  
**Author:** GasGuard Engineering  
**Date:** 2026-01-26

---

## Cost Model Overview

The GasGuard engine implements a **three-dimensional resource cost model** for Soroban smart contracts, tracking:

1. **CPU Cost** – Instruction execution metering
2. **Memory Cost** – Transaction memory consumption
3. **Ledger Cost** – Disk I/O (reads/writes) and bandwidth (transaction size)

Each dimension is modeled with explicit formulas parameterized by Soroban network configuration values. The engine uses these models to:

- Score contract execution efficiency
- Identify optimization opportunities
- Enforce safety margins below network limits
- Generate actionable developer feedback

### Design Principles

- **Traceability**: Every constant maps to a Soroban config field or justified modeling choice
- **Composability**: Per-dimension costs can be combined into aggregate scores
- **Tunability**: Parameters are externalized for network updates without model restructure
- **Precision**: Formulas account for both per-transaction and per-ledger constraints

---

## CPU Cost Model

### Soroban CPU Metering

Soroban meters CPU usage via **instruction counting** – each host function call and WASM instruction increments a counter. CPU resources are constrained at two levels:

| Limit Type | Config Field | Typical Value | Description |
|------------|--------------|---------------|-------------|
| Per-Transaction | `txMaxInstructions` | 100,000,000 | Max instructions per single transaction |
| Per-Ledger | `ledgerMaxInstructions` | 1,000,000,000 | Max aggregate instructions per ledger close |

**Fee Structure**: Soroban charges fees in stroops (1 XLM = 10⁷ stroops) per instruction increment:

```
feeRatePerInstructionsIncrement : int64  // e.g., 1000 instructions per fee unit
```

### CPU Cost Formula

Let:
- **I** = actual instructions consumed by transaction
- **I_tx** = `txMaxInstructions` (per-tx limit)
- **I_ledger** = `ledgerMaxInstructions` (per-ledger limit)
- **R_cpu** = `feeRatePerInstructionsIncrement` (instructions per fee unit)
- **F_cpu** = fee per instruction increment (stroops)

**Base CPU Cost** (fee-based):

```
C_cpu_fee = ⌈I / R_cpu⌉ × F_cpu
```

**Normalized CPU Cost** (for scoring, 0–1 scale):

```
C_cpu_norm = I / I_tx
```

**Ledger Pressure Factor** (optional penalty):

```
P_cpu_ledger = (I / I_ledger)^2  // Quadratic penalty as ledger limit approached
```

**Final CPU Cost**:

```
C_cpu = C_cpu_fee × (1 + w_ledger × P_cpu_ledger)
```

Where `w_ledger` is a configurable weight (default: 0.5) to penalize transactions that consume disproportionate ledger CPU budget.

### Constant Mapping

| Model Constant | Soroban Source | Type | Notes |
|----------------|----------------|------|-------|
| `I_tx` | `ConfigSettingContractComputeV0.txMaxInstructions` | Network config | Per-tx instruction limit |
| `I_ledger` | `ConfigSettingContractComputeV0.ledgerMaxInstructions` | Network config | Per-ledger aggregate limit |
| `R_cpu` | `ConfigSettingContractComputeV0.feeRatePerInstructionsIncrement` | Network config | Granularity of fee charging |
| `F_cpu` | Derived from `resourceFee` and `instructions` | Runtime | Fee per increment (from tx simulation) |
| `w_ledger` | Engine parameter | Internal | Ledger pressure weight (tunable) |

---

## Memory Cost Model

### Soroban Memory Metering

Soroban constrains **transaction memory** (the maximum memory footprint during execution), but does **not** directly charge fees for memory usage—memory is a **limit-only** resource.

| Limit Type | Config Field | Typical Value | Description |
|------------|--------------|---------------|-------------|
| Per-Transaction | `txMemoryLimit` | 41,943,040 bytes (~40 MB) | Max memory per transaction |

**Note**: There is no per-ledger memory limit; memory is scoped to individual transaction execution.

### Memory Cost Formula

Because memory is limit-only, we model cost as **proximity to limit** rather than absolute fee.

Let:
- **M** = actual memory consumed (bytes)
- **M_tx** = `txMemoryLimit` (per-tx limit)
- **k_mem** = memory cost scaling factor (internal parameter)

**Normalized Memory Utilization**:

```
U_mem = M / M_tx
```

**Memory Cost** (exponential penalty near limit):

```
C_mem = k_mem × e^(5 × U_mem)  // Sharp penalty above 80% utilization
```

**Alternative (Linear + Threshold)**:

```
C_mem = k_mem × { U_mem                    if U_mem ≤ 0.7
                  U_mem + 10×(U_mem - 0.7)  if U_mem > 0.7 }
```

The exponential model is preferred for smooth gradient-based optimization; the threshold model is simpler for rule-based analysis.

### Constant Mapping

| Model Constant | Soroban Source | Type | Notes |
|----------------|----------------|------|-------|
| `M_tx` | `ConfigSettingContractComputeV0.txMemoryLimit` | Network config | Per-tx memory limit |
| `k_mem` | Engine parameter | Internal | Scaling factor (default: 100) |

**Design Rationale**: Although Soroban does not charge for memory, contracts approaching `txMemoryLimit` risk tx failure. Our model penalizes high memory usage to incentivize efficiency.

---

## Ledger Cost Model (Reads/Writes/Bandwidth)

### Soroban Ledger I/O Metering

Soroban tracks **ledger entry reads/writes** and **byte volumes** for storage operations, plus **transaction size** for bandwidth.

#### Read/Write Limits

| Limit Type | Config Field | Typical Value |
|------------|--------------|---------------|
| **Reads (per-tx)** | `txMaxReadLedgerEntries` | 40 entries |
| **Reads (per-tx bytes)** | `txMaxReadBytes` | 200,000 bytes |
| **Writes (per-tx)** | `txMaxWriteLedgerEntries` | 25 entries |
| **Writes (per-tx bytes)** | `txMaxWriteBytes` | 100,000 bytes |
| **Reads (per-ledger)** | `ledgerMaxReadLedgerEntries` | 20,000 entries |
| **Reads (per-ledger bytes)** | `ledgerMaxReadBytes` | 100,000,000 bytes |
| **Writes (per-ledger)** | `ledgerMaxWriteLedgerEntries` | 10,000 entries |
| **Writes (per-ledger bytes)** | `ledgerMaxWriteBytes` | 50,000,000 bytes |

**Fee Structure** (from `ConfigSettingContractLedgerCostV0`):

- `feeReadLedgerEntry` – fee per entry read (stroops)
- `feeWriteLedgerEntry` – fee per entry write (stroops)
- `feeRead1KB` – fee per KB read (stroops)
- `feeWrite1KB` – fee per KB written (stroops)

#### Bandwidth Limits

| Limit Type | Config Field | Typical Value |
|------------|--------------|---------------|
| **Tx Size (per-tx)** | `txMaxSizeBytes` | 100,000 bytes |
| **Tx Size (per-ledger)** | `ledgerMaxTxsSizeBytes` | 1,000,000 bytes |

**Fee Structure** (from `ConfigSettingContractBandwidthV0`):

- `feeTxSize1KB` – fee per KB of transaction size (stroops)

### Ledger Cost Formula

Let:
- **E_r**, **E_w** = number of ledger entries read/written
- **B_r**, **B_w** = bytes read/written
- **S_tx** = transaction size (bytes)
- Fee constants: **F_er**, **F_ew**, **F_br**, **F_bw**, **F_bw_tx**
- Limits: **E_r_tx**, **E_w_tx**, **B_r_tx**, **B_w_tx**, **S_tx_max**, etc.

#### Read Cost

```
C_read_entries = E_r × F_er
C_read_bytes   = ⌈B_r / 1024⌉ × F_br
C_read_total   = C_read_entries + C_read_bytes
```

#### Write Cost

```
C_write_entries = E_w × F_ew
C_write_bytes   = ⌈B_w / 1024⌉ × F_bw
C_write_total   = C_write_entries + C_write_bytes
```

#### Bandwidth Cost

```
C_bandwidth = ⌈S_tx / 1024⌉ × F_bw_tx
```

#### Total Ledger Cost

```
C_ledger_fee = C_read_total + C_write_total + C_bandwidth
```

#### Normalized Ledger Cost (Utilization-Based)

```
U_read_entries  = E_r / E_r_tx
U_read_bytes    = B_r / B_r_tx
U_write_entries = E_w / E_w_tx
U_write_bytes   = B_w / B_w_tx
U_bandwidth     = S_tx / S_tx_max

C_ledger_norm = w_re × U_read_entries + w_rb × U_read_bytes +
                w_we × U_write_entries + w_wb × U_write_bytes +
                w_bw × U_bandwidth
```

Where weights `w_*` are tunable (default: all 0.2 for equal weighting).

### Constant Mapping

| Model Constant | Soroban Source | Type |
|----------------|----------------|------|
| `E_r_tx` | `ConfigSettingContractLedgerCostV0.txMaxReadLedgerEntries` | Network config |
| `B_r_tx` | `ConfigSettingContractLedgerCostV0.txMaxReadBytes` | Network config |
| `E_w_tx` | `ConfigSettingContractLedgerCostV0.txMaxWriteLedgerEntries` | Network config |
| `B_w_tx` | `ConfigSettingContractLedgerCostV0.txMaxWriteBytes` | Network config |
| `S_tx_max` | `ConfigSettingContractBandwidthV0.txMaxSizeBytes` | Network config |
| `F_er` | `ConfigSettingContractLedgerCostV0.feeReadLedgerEntry` | Network config |
| `F_ew` | `ConfigSettingContractLedgerCostV0.feeWriteLedgerEntry` | Network config |
| `F_br` | `ConfigSettingContractLedgerCostV0.feeRead1KB` | Network config |
| `F_bw` | `ConfigSettingContractLedgerCostV0.feeWrite1KB` | Network config |
| `F_bw_tx` | `ConfigSettingContractBandwidthV0.feeTxSize1KB` | Network config |
| `w_re`, `w_rb`, etc. | Engine parameter | Internal (default: 0.2 each) |

---

## Constant Mapping to Soroban Limits

### Complete Mapping Table

| **Dimension** | **Constant** | **Soroban Config Field** | **Type** | **Typical Value** | **Notes** |
|---------------|--------------|--------------------------|----------|-------------------|-----------|
| **CPU** | `I_tx` | `ConfigSettingContractComputeV0.txMaxInstructions` | Limit | 100,000,000 | Per-tx instruction cap |
| | `I_ledger` | `ConfigSettingContractComputeV0.ledgerMaxInstructions` | Limit | 1,000,000,000 | Per-ledger instruction cap |
| | `R_cpu` | `ConfigSettingContractComputeV0.feeRatePerInstructionsIncrement` | Fee | 10,000 | Instructions per fee unit |
| | `F_cpu` | Derived from network fees | Fee | ~0.00001 XLM | Per-increment fee |
| | `w_ledger` | **Engine internal** | Weight | 0.5 | Ledger pressure penalty |
| **Memory** | `M_tx` | `ConfigSettingContractComputeV0.txMemoryLimit` | Limit | 41,943,040 | Per-tx memory cap (bytes) |
| | `k_mem` | **Engine internal** | Scaling | 100 | Memory cost scaling |
| **Ledger (Reads)** | `E_r_tx` | `ConfigSettingContractLedgerCostV0.txMaxReadLedgerEntries` | Limit | 40 | Per-tx read entry limit |
| | `B_r_tx` | `ConfigSettingContractLedgerCostV0.txMaxReadBytes` | Limit | 200,000 | Per-tx read bytes limit |
| | `E_r_ledger` | `ConfigSettingContractLedgerCostV0.ledgerMaxReadLedgerEntries` | Limit | 20,000 | Per-ledger read entry limit |
| | `B_r_ledger` | `ConfigSettingContractLedgerCostV0.ledgerMaxReadBytes` | Limit | 100,000,000 | Per-ledger read bytes limit |
| | `F_er` | `ConfigSettingContractLedgerCostV0.feeReadLedgerEntry` | Fee | Variable | Fee per entry read |
| | `F_br` | `ConfigSettingContractLedgerCostV0.feeRead1KB` | Fee | Variable | Fee per KB read |
| **Ledger (Writes)** | `E_w_tx` | `ConfigSettingContractLedgerCostV0.txMaxWriteLedgerEntries` | Limit | 25 | Per-tx write entry limit |
| | `B_w_tx` | `ConfigSettingContractLedgerCostV0.txMaxWriteBytes` | Limit | 100,000 | Per-tx write bytes limit |
| | `E_w_ledger` | `ConfigSettingContractLedgerCostV0.ledgerMaxWriteLedgerEntries` | Limit | 10,000 | Per-ledger write entry limit |
| | `B_w_ledger` | `ConfigSettingContractLedgerCostV0.ledgerMaxWriteBytes` | Limit | 50,000,000 | Per-ledger write bytes limit |
| | `F_ew` | `ConfigSettingContractLedgerCostV0.feeWriteLedgerEntry` | Fee | Variable | Fee per entry write |
| | `F_bw` | `ConfigSettingContractLedgerCostV0.feeWrite1KB` | Fee | Variable | Fee per KB write |
| **Bandwidth** | `S_tx_max` | `ConfigSettingContractBandwidthV0.txMaxSizeBytes` | Limit | 100,000 | Per-tx size limit (bytes) |
| | `S_ledger_max` | `ConfigSettingContractBandwidthV0.ledgerMaxTxsSizeBytes` | Limit | 1,000,000 | Per-ledger aggregate tx size |
| | `F_bw_tx` | `ConfigSettingContractBandwidthV0.feeTxSize1KB` | Fee | Variable | Fee per KB tx size |

### Limit Approach Behavior

As resource usage approaches limits, the model exhibits different behaviors:

1. **CPU**: 
   - Linear cost up to 70% of `I_tx`
   - Quadratic ledger pressure penalty above 70% of `I_ledger`
   - Triggers optimization hint: "Reduce instruction count" when `U_cpu > 0.8`

2. **Memory**:
   - Exponential penalty above 70% of `M_tx`
   - Hard cutoff at 95% (tx will likely fail)
   - Triggers hint: "Optimize memory allocations" when `U_mem > 0.7`

3. **Ledger**:
   - Linear cost based on fee structure
   - Composite utilization penalty when any dimension exceeds 75%
   - Triggers hints: "Reduce reads", "Batch writes", "Compress data" based on which dimension is highest

---

## Engine Scoring Function & Pseudocode

### Scoring Function Design

The engine computes **multi-dimensional resource scores** to enable:

1. **Efficiency ranking** – Compare contracts/transactions by resource consumption
2. **Optimization targeting** – Identify highest-impact improvement areas
3. **Regression detection** – Flag cost increases between versions

Each transaction receives:
- **Per-Dimension Scores**: `S_cpu`, `S_mem`, `S_ledger` ∈ [0, 100]
- **Aggregate Score**: `S_total` ∈ [0, 100]
- **Optimization Hints**: List of actionable suggestions

### Scoring Algorithm

#### Step 1: Ingest Simulation Data

The engine receives metering data from Soroban RPC simulation response (`simulateTransaction`):

```typescript
interface SorobanSimulationResult {
  instructions: number;           // CPU instructions
  memoryBytes: number;            // Peak memory (custom tracking)
  resources: {
    footprint: Footprint;         // Ledger entries accessed
    instructions: number;         // Same as above
    readBytes: number;            // Bytes read
    writeBytes: number;           // Bytes written
  };
  transactionSizeBytes: number;   // Serialized tx size
}
```

**Note**: Soroban RPC does not natively report `memoryBytes`. The engine must:
- Instrument contracts with memory profiling (e.g., via custom host functions), or
- Estimate memory from footprint size and known contract patterns

#### Step 2: Compute Per-Dimension Costs

```python
def compute_cpu_cost(sim: SimulationResult, config: SorobanConfig) -> CPUCost:
    I = sim.instructions
    I_tx = config.txMaxInstructions
    I_ledger = config.ledgerMaxInstructions
    R_cpu = config.feeRatePerInstructionsIncrement
    
    # Fee-based cost
    C_cpu_fee = math.ceil(I / R_cpu) * config.feeCPUPerIncrement
    
    # Normalized utilization
    U_cpu_tx = I / I_tx
    U_cpu_ledger = I / I_ledger
    
    # Ledger pressure penalty (quadratic)
    P_cpu_ledger = (U_cpu_ledger) ** 2
    
    # Final cost
    w_ledger = 0.5  # Configurable weight
    C_cpu = C_cpu_fee * (1 + w_ledger * P_cpu_ledger)
    
    return CPUCost(
        fee=C_cpu_fee,
        normalized=U_cpu_tx,
        ledger_pressure=P_cpu_ledger,
        total=C_cpu
    )

def compute_memory_cost(sim: SimulationResult, config: SorobanConfig) -> MemoryCost:
    M = sim.memoryBytes
    M_tx = config.txMemoryLimit
    k_mem = 100  # Scaling factor
    
    # Normalized utilization
    U_mem = M / M_tx
    
    # Exponential penalty (sharp near limit)
    C_mem = k_mem * math.exp(5 * U_mem)
    
    return MemoryCost(
        bytes_used=M,
        normalized=U_mem,
        cost=C_mem
    )

def compute_ledger_cost(sim: SimulationResult, config: SorobanConfig) -> LedgerCost:
    # Extract metrics
    E_r = len([e for e in sim.resources.footprint.readOnly])
    E_w = len([e for e in sim.resources.footprint.readWrite])
    B_r = sim.resources.readBytes
    B_w = sim.resources.writeBytes
    S_tx = sim.transactionSizeBytes
    
    # Fee-based costs
    C_read_entries = E_r * config.feeReadLedgerEntry
    C_read_bytes = math.ceil(B_r / 1024) * config.feeRead1KB
    C_write_entries = E_w * config.feeWriteLedgerEntry
    C_write_bytes = math.ceil(B_w / 1024) * config.feeWrite1KB
    C_bandwidth = math.ceil(S_tx / 1024) * config.feeTxSize1KB
    
    C_ledger_fee = (C_read_entries + C_read_bytes + 
                    C_write_entries + C_write_bytes + C_bandwidth)
    
    # Normalized utilizations
    U_read_entries = E_r / config.txMaxReadLedgerEntries
    U_read_bytes = B_r / config.txMaxReadBytes
    U_write_entries = E_w / config.txMaxWriteLedgerEntries
    U_write_bytes = B_w / config.txMaxWriteBytes
    U_bandwidth = S_tx / config.txMaxSizeBytes
    
    # Composite normalized cost (weighted average)
    weights = [0.2, 0.2, 0.2, 0.2, 0.2]  # Equal weights
    C_ledger_norm = (weights[0] * U_read_entries +
                     weights[1] * U_read_bytes +
                     weights[2] * U_write_entries +
                     weights[3] * U_write_bytes +
                     weights[4] * U_bandwidth)
    
    return LedgerCost(
        fee=C_ledger_fee,
        normalized=C_ledger_norm,
        breakdown={
            'read_entries': U_read_entries,
            'read_bytes': U_read_bytes,
            'write_entries': U_write_entries,
            'write_bytes': U_write_bytes,
            'bandwidth': U_bandwidth
        }
    )
```

#### Step 3: Compute Dimension Scores (0–100 scale)

```python
def score_dimension(normalized_cost: float, threshold_low: float = 0.5, 
                    threshold_high: float = 0.8) -> int:
    """
    Convert normalized cost (0–1) to score (0–100).
    Lower cost → higher score (better).
    
    Scoring bands:
    - [0, threshold_low): Score 100–80 (excellent)
    - [threshold_low, threshold_high): Score 80–50 (good)
    - [threshold_high, 1.0): Score 50–0 (poor, approaching limit)
    """
    if normalized_cost < threshold_low:
        # Linear interpolation: 0→100, threshold_low→80
        return int(100 - (normalized_cost / threshold_low) * 20)
    elif normalized_cost < threshold_high:
        # Linear interpolation: threshold_low→80, threshold_high→50
        range_size = threshold_high - threshold_low
        offset = normalized_cost - threshold_low
        return int(80 - (offset / range_size) * 30)
    else:
        # Linear interpolation: threshold_high→50, 1.0→0
        range_size = 1.0 - threshold_high
        offset = normalized_cost - threshold_high
        return int(50 - (offset / range_size) * 50)

def compute_scores(cpu: CPUCost, mem: MemoryCost, ledger: LedgerCost) -> Scores:
    S_cpu = score_dimension(cpu.normalized)
    S_mem = score_dimension(mem.normalized)
    S_ledger = score_dimension(ledger.normalized)
    
    # Aggregate score (weighted average, CPU/ledger are typically more critical)
    weights = {'cpu': 0.4, 'mem': 0.2, 'ledger': 0.4}
    S_total = int(weights['cpu'] * S_cpu + 
                  weights['mem'] * S_mem + 
                  weights['ledger'] * S_ledger)
    
    return Scores(
        cpu=S_cpu,
        memory=S_mem,
        ledger=S_ledger,
        total=S_total
    )
```

#### Step 4: Generate Optimization Hints

```python
def generate_hints(cpu: CPUCost, mem: MemoryCost, ledger: LedgerCost) -> List[str]:
    hints = []
    
    # CPU hints
    if cpu.normalized > 0.8:
        hints.append("🔴 CRITICAL: CPU usage at {:.0%}. Reduce instruction count.".format(cpu.normalized))
    elif cpu.normalized > 0.6:
        hints.append("🟡 HIGH CPU: Consider optimizing hot loops and reducing host function calls.")
    
    if cpu.ledger_pressure > 0.5:
        hints.append("⚠️  High ledger CPU pressure. This tx consumes {:.1%} of per-ledger budget.".format(
            cpu.ledger_pressure ** 0.5))
    
    # Memory hints
    if mem.normalized > 0.7:
        hints.append("🔴 CRITICAL: Memory usage at {:.0%}. Optimize allocations or batch operations.".format(
            mem.normalized))
    elif mem.normalized > 0.5:
        hints.append("🟡 MODERATE memory usage. Review data structure sizes.")
    
    # Ledger hints
    breakdown = ledger.breakdown
    if breakdown['read_entries'] > 0.75:
        hints.append("🔴 HIGH read entry count. Consider caching or batching reads.")
    if breakdown['write_entries'] > 0.75:
        hints.append("🔴 HIGH write entry count. Batch writes or reduce state updates.")
    if breakdown['read_bytes'] > 0.75:
        hints.append("⚠️  High read byte volume. Compress data or reduce footprint.")
    if breakdown['write_bytes'] > 0.75:
        hints.append("⚠️  High write byte volume. Minimize data serialization size.")
    if breakdown['bandwidth'] > 0.75:
        hints.append("⚠️  Large transaction size. Remove unnecessary metadata or compress payloads.")
    
    # Cross-dimension hints
    if cpu.normalized > 0.7 and ledger.breakdown['read_entries'] > 0.5:
        hints.append("💡 TIP: High CPU + reads detected. Investigate redundant storage accesses.")
    
    if len(hints) == 0:
        hints.append("✅ Excellent resource efficiency!")
    
    return hints
```

#### Step 5: Full Scoring Pipeline

```python
def analyze_transaction(sim: SimulationResult, config: SorobanConfig) -> Analysis:
    """
    Complete analysis pipeline for a Soroban transaction.
    
    Args:
        sim: Simulation result from Soroban RPC
        config: Current network configuration constants
    
    Returns:
        Analysis object with costs, scores, and optimization hints
    """
    # Compute per-dimension costs
    cpu_cost = compute_cpu_cost(sim, config)
    mem_cost = compute_memory_cost(sim, config)
    ledger_cost = compute_ledger_cost(sim, config)
    
    # Compute scores
    scores = compute_scores(cpu_cost, mem_cost, ledger_cost)
    
    # Generate hints
    hints = generate_hints(cpu_cost, mem_cost, ledger_cost)
    
    # Safety margin check (fail if within 5% of any hard limit)
    safety_violations = []
    if cpu_cost.normalized > 0.95:
        safety_violations.append("CPU exceeds 95% safety margin")
    if mem_cost.normalized > 0.95:
        safety_violations.append("Memory exceeds 95% safety margin")
    for dim, util in ledger_cost.breakdown.items():
        if util > 0.95:
            safety_violations.append(f"Ledger {dim} exceeds 95% safety margin")
    
    return Analysis(
        costs={
            'cpu': cpu_cost,
            'memory': mem_cost,
            'ledger': ledger_cost
        },
        scores=scores,
        hints=hints,
        safety_violations=safety_violations,
        timestamp=datetime.utcnow(),
        config_version=config.version
    )
```

### Integration with Optimization Workflows

The engine uses analysis results to:

1. **Ranking**: Sort contracts by `S_total` to identify least efficient implementations
2. **Regression Detection**: Store historical scores and alert when `S_total` drops >10 points
3. **Targeted Optimization**: Sort `hints` by severity (🔴 > 🟡 > ⚠️ > 💡) and surface top 3
4. **Batch Analysis**: Run analysis on contract test suites, aggregate statistics (p50/p95 scores)
5. **Pre-Deployment Gating**: Block deploys if any `safety_violations` present

---

## Worked Examples

### Example 1: Simple Token Transfer

**Scenario**: ERC-20 style token transfer from Alice to Bob (100 tokens).

#### Simulated Metering Data

```json
{
  "instructions": 1_250_000,
  "memoryBytes": 2_097_152,
  "resources": {
    "footprint": {
      "readOnly": ["ContractData(token_balance_alice)", "ContractData(token_metadata)"],
      "readWrite": ["ContractData(token_balance_bob)"]
    },
    "instructions": 1_250_000,
    "readBytes": 512,
    "writeBytes": 256
  },
  "transactionSizeBytes": 4096
}
```

#### Cost Breakdown

**CPU Cost**:
```
I = 1,250,000
I_tx = 100,000,000
R_cpu = 10,000
F_cpu = 0.00001 XLM

C_cpu_fee = ⌈1,250,000 / 10,000⌉ × 0.00001 = 125 × 0.00001 = 0.00125 XLM
U_cpu_tx = 1,250,000 / 100,000,000 = 0.0125 (1.25%)
U_cpu_ledger = 1,250,000 / 1,000,000,000 = 0.00125 (0.125%)
P_cpu_ledger = 0.00125^2 ≈ 0.0000016
C_cpu = 0.00125 × (1 + 0.5 × 0.0000016) ≈ 0.00125 XLM
```

**Memory Cost**:
```
M = 2,097,152 bytes
M_tx = 41,943,040 bytes
k_mem = 100

U_mem = 2,097,152 / 41,943,040 = 0.05 (5%)
C_mem = 100 × e^(5 × 0.05) = 100 × e^0.25 ≈ 128.4
```

**Ledger Cost**:
```
E_r = 2 entries (alice balance, metadata)
E_w = 1 entry (bob balance)
B_r = 512 bytes
B_w = 256 bytes
S_tx = 4096 bytes

Assume fees:
F_er = 0.0001 XLM, F_ew = 0.0002 XLM
F_br = 0.00005 XLM/KB, F_bw = 0.0001 XLM/KB
F_bw_tx = 0.00001 XLM/KB

C_read_entries = 2 × 0.0001 = 0.0002 XLM
C_read_bytes = ⌈512/1024⌉ × 0.00005 = 1 × 0.00005 = 0.00005 XLM
C_write_entries = 1 × 0.0002 = 0.0002 XLM
C_write_bytes = ⌈256/1024⌉ × 0.0001 = 1 × 0.0001 = 0.0001 XLM
C_bandwidth = ⌈4096/1024⌉ × 0.00001 = 4 × 0.00001 = 0.00004 XLM

C_ledger_fee = 0.0002 + 0.00005 + 0.0002 + 0.0001 + 0.00004 = 0.00059 XLM

U_read_entries = 2 / 40 = 0.05 (5%)
U_read_bytes = 512 / 200,000 = 0.0026 (0.26%)
U_write_entries = 1 / 25 = 0.04 (4%)
U_write_bytes = 256 / 100,000 = 0.0026 (0.26%)
U_bandwidth = 4096 / 100,000 = 0.041 (4.1%)

C_ledger_norm = 0.2×0.05 + 0.2×0.0026 + 0.2×0.04 + 0.2×0.0026 + 0.2×0.041
              = 0.01 + 0.00052 + 0.008 + 0.00052 + 0.0082
              = 0.02744 (2.74%)
```

#### Scores

```
S_cpu = score_dimension(0.0125) = 100 - (0.0125/0.5)×20 = 100 - 0.5 = 99
S_mem = score_dimension(0.05) = 100 - (0.05/0.5)×20 = 100 - 2 = 98
S_ledger = score_dimension(0.02744) = 100 - (0.02744/0.5)×20 ≈ 99

S_total = 0.4×99 + 0.2×98 + 0.4×99 = 39.6 + 19.6 + 39.6 = 98.8 ≈ 99
```

#### Optimization Hints

```
✅ Excellent resource efficiency!
```

**Total Resource Fee**: `0.00125 + 0.00059 = 0.00184 XLM` (~$0.0002 at $0.11/XLM)

---

### Example 2: Complex Multi-Contract Call (NFT Marketplace)

**Scenario**: User purchases NFT from marketplace contract, which:
1. Reads marketplace listing
2. Transfers payment token from buyer to seller
3. Transfers NFT from seller to buyer
4. Updates marketplace state (removes listing)
5. Emits purchase event

#### Simulated Metering Data

```json
{
  "instructions": 75_000_000,
  "memoryBytes": 32_000_000,
  "resources": {
    "footprint": {
      "readOnly": [
        "ContractData(marketplace_listing_123)",
        "ContractData(payment_token_balance_buyer)",
        "ContractData(nft_owner_map_item_456)",
        "ContractData(marketplace_config)",
        "ContractCode(payment_token_contract)",
        "ContractCode(nft_contract)"
      ],
      "readWrite": [
        "ContractData(payment_token_balance_seller)",
        "ContractData(nft_owner_map_item_456)",
        "ContractData(marketplace_active_listings)",
        "ContractData(marketplace_stats)"
      ]
    },
    "instructions": 75_000_000,
    "readBytes": 45_000,
    "writeBytes": 12_000
  },
  "transactionSizeBytes": 18_000
}
```

#### Cost Breakdown

**CPU Cost**:
```
I = 75,000,000
U_cpu_tx = 75,000,000 / 100,000,000 = 0.75 (75%)
U_cpu_ledger = 75,000,000 / 1,000,000,000 = 0.075 (7.5%)
P_cpu_ledger = 0.075^2 = 0.005625

C_cpu_fee = ⌈75,000,000 / 10,000⌉ × 0.00001 = 7,500 × 0.00001 = 0.075 XLM
C_cpu = 0.075 × (1 + 0.5 × 0.005625) = 0.075 × 1.0028 ≈ 0.0752 XLM
```

**Memory Cost**:
```
M = 32,000,000 bytes
U_mem = 32,000,000 / 41,943,040 = 0.763 (76.3%)

C_mem = 100 × e^(5 × 0.763) = 100 × e^3.815 ≈ 4,536
```

**Ledger Cost**:
```
E_r = 6 entries
E_w = 4 entries
B_r = 45,000 bytes
B_w = 12,000 bytes
S_tx = 18,000 bytes

C_read_entries = 6 × 0.0001 = 0.0006 XLM
C_read_bytes = ⌈45,000/1024⌉ × 0.00005 = 44 × 0.00005 = 0.0022 XLM
C_write_entries = 4 × 0.0002 = 0.0008 XLM
C_write_bytes = ⌈12,000/1024⌉ × 0.0001 = 12 × 0.0001 = 0.0012 XLM
C_bandwidth = ⌈18,000/1024⌉ × 0.00001 = 18 × 0.00001 = 0.00018 XLM

C_ledger_fee = 0.0006 + 0.0022 + 0.0008 + 0.0012 + 0.00018 = 0.00498 XLM

U_read_entries = 6 / 40 = 0.15 (15%)
U_read_bytes = 45,000 / 200,000 = 0.225 (22.5%)
U_write_entries = 4 / 25 = 0.16 (16%)
U_write_bytes = 12,000 / 100,000 = 0.12 (12%)
U_bandwidth = 18,000 / 100,000 = 0.18 (18%)

C_ledger_norm = 0.2×0.15 + 0.2×0.225 + 0.2×0.16 + 0.2×0.12 + 0.2×0.18
              = 0.03 + 0.045 + 0.032 + 0.024 + 0.036
              = 0.167 (16.7%)
```

#### Scores

```
S_cpu = score_dimension(0.75)
      // 0.75 is in [0.5, 0.8) range
      = 80 - ((0.75 - 0.5) / (0.8 - 0.5)) × 30
      = 80 - (0.25 / 0.3) × 30
      = 80 - 25 = 55

S_mem = score_dimension(0.763)
      // 0.763 is in [0.5, 0.8) range
      = 80 - ((0.763 - 0.5) / (0.8 - 0.5)) × 30
      = 80 - (0.263 / 0.3) × 30
      = 80 - 26.3 = 54

S_ledger = score_dimension(0.167)
         // 0.167 is in [0, 0.5) range
         = 100 - (0.167 / 0.5) × 20
         = 100 - 6.68 = 93

S_total = 0.4×55 + 0.2×54 + 0.4×93 = 22 + 10.8 + 37.2 = 70
```

#### Optimization Hints

```
🟡 HIGH CPU: Consider optimizing hot loops and reducing host function calls.
⚠️  High ledger CPU pressure. This tx consumes 7.5% of per-ledger budget.
🔴 CRITICAL: Memory usage at 76%. Optimize allocations or batch operations.
```

**Total Resource Fee**: `0.0752 + 0.00498 = 0.08018 XLM` (~$0.0088 at $0.11/XLM)

---

## Summary & Implementation Checklist

### What We've Defined

✅ **CPU Cost Model**: Instruction-based with ledger pressure penalties  
✅ **Memory Cost Model**: Limit-proximity exponential penalty  
✅ **Ledger Cost Model**: Multi-dimensional (reads/writes/bandwidth) with fees  
✅ **Constant Mapping**: All parameters traced to Soroban config or justified internally  
✅ **Scoring Function**: 0–100 scale with threshold-based bands  
✅ **Optimization Hints**: Severity-based actionable feedback  
✅ **Worked Examples**: Simple and complex transaction breakdowns

### Implementation Steps

For developers implementing this spec:

1. **Load Soroban Network Config**
   - Fetch current config from RPC: `getLedgerEntries` for `ConfigSetting` entries
   - Parse `ConfigSettingContractComputeV0`, `ConfigSettingContractLedgerCostV0`, `ConfigSettingContractBandwidthV0`
   - Cache config with TTL (refresh every 100 ledgers, ~8 min at 5s/ledger)

2. **Simulate Transactions**
   - Call `simulateTransaction` RPC method for each tx to analyze
   - Extract: `instructions`, `readBytes`, `writeBytes`, `footprint`
   - **Custom instrumentation** for `memoryBytes` (not natively reported):
     - Option A: Deploy profiling wrapper contract that tracks allocations
     - Option B: Estimate from footprint size (conservative upper bound)

3. **Compute Costs**
   - Implement `compute_cpu_cost`, `compute_memory_cost`, `compute_ledger_cost` functions
   - Use current config constants
   - Return structured cost objects (see pseudocode)

4. **Score & Generate Hints**
   - Implement `score_dimension` and `compute_scores`
   - Implement `generate_hints` with severity thresholds
   - Store scores in analytics database for historical tracking

5. **Integrate into CI/CD**
   - Run analysis on all contract test suites
   - Gate deploys if `S_total < 50` or `safety_violations` present
   - Auto-comment on PRs with optimization hints

6. **Unit Tests**
   - Test each cost formula with boundary values (0%, 50%, 95%, 100% utilization)
   - Verify scoring bands (expect score 100 at 0%, score 0 at 100%)
   - Mock Soroban config for reproducible tests

### Tunable Parameters

The following are **internal engine parameters** that can be tuned without changing model structure:

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `w_ledger` | 0.5 | Weight for CPU ledger pressure penalty |
| `k_mem` | 100 | Memory cost scaling factor |
| Ledger weights (`w_re`, `w_rb`, etc.) | 0.2 each | Ledger dimension importance |
| Scoring thresholds | `low=0.5, high=0.8` | Boundaries for score bands |
| Aggregate score weights | `cpu=0.4, mem=0.2, ledger=0.4` | Relative dimension importance |
| Safety margin | 0.95 (95%) | Hard limit violation threshold |

Adjust these based on:
- Network congestion patterns (increase `w_ledger` if ledgers frequently max out)
- Developer feedback (tune scoring thresholds for UX)
- Deployment risk tolerance (tighten safety margin)

---

**End of Specification**

*For questions or clarifications, contact GasGuard Engineering.*
