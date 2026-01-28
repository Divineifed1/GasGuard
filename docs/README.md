# Soroban Cost Model - GasGuard Engine

> **Status**: Complete and Ready for Integration  
> **Version**: 1.0  
> **Author**: GasGuard Engineering

---

##  Overview

This cost model enables the **GasGuard engine** to analyze Soroban smart contract resource consumption across three dimensions:

1. **CPU** – Instruction execution metering
2. **Memory** – Transaction memory limits
3. **Ledger** – Disk I/O (reads/writes) and bandwidth

The model provides:
- **Fee estimation** based on Soroban network configuration
- **Efficiency scoring** (0–100 scale)
- **Optimization hints** with severity levels
- **Safety violation detection** (95% limit threshold)

---

## Documentation

### Primary Documents

| Document | Description | Location |
|----------|-------------|----------|
| **Specification** | Complete cost model formulas, constant mappings, scoring functions | [`docs/soroban-cost-model-spec.md`](docs/soroban-cost-model-spec.md) |
| **Walkthrough** | Implementation summary, verification results, next steps | [Brain: walkthrough.md](../.gemini/antigravity/brain/582bc740-fa6d-4da6-864f-c6c06bc76032/walkthrough.md) |
| **Task Plan** | Development checklist (all tasks complete) | [Brain: task.md](../.gemini/antigravity/brain/582bc740-fa6d-4da6-864f-c6c06bc76032/task.md) |

### Quick Links

- **[Cost Model Formulas →](docs/soroban-cost-model-spec.md#cpu-cost-model)**
- **[Constant Mapping Table →](docs/soroban-cost-model-spec.md#constant-mapping-to-soroban-limits)**
- **[Scoring Function →](docs/soroban-cost-model-spec.md#engine-scoring-function--pseudocode)**
- **[Worked Examples →](docs/soroban-cost-model-spec.md#worked-examples)**

---

## Quick Start

### Run Examples

```bash
cd /home/misty-waters/Gas-guard/GasGuard-1
python3 src/cost_model.py
```

**Output**: Analyzes two transactions (simple token transfer + complex marketplace call) with full cost breakdown and scores.

### Run Tests

```bash
python3 -m pytest tests/test_cost_model.py -v
```

**Coverage**: 25+ test cases covering CPU, memory, ledger costs, scoring, and hints.

### Analyze a Transaction

```python
from src.cost_model import SorobanConfig, SimulationResult, analyze_transaction

# 1. Load network config (or use defaults)
config = SorobanConfig()

# 2. Get simulation data from Soroban RPC
sim = SimulationResult(
    instructions=10_000_000,
    memoryBytes=5_000_000,
    resources=SorobanResources(...),
    transactionSizeBytes=8192
)

# 3. Analyze
analysis = analyze_transaction(sim, config)

# 4. Use results
print(f"Score: {analysis.scores.total}/100")
print(f"Fee: {analysis.costs['cpu'].fee + analysis.costs['ledger'].fee:.6f} XLM")
for hint in analysis.hints:
    print(hint)
```

---

## Cost Model Summary

### CPU Cost

**Formula**:
```
C_cpu = ⌈I / R_cpu⌉ × F_cpu × (1 + w_ledger × (I / I_ledger)^2)
```

**Limits**:
- Per-tx: 100M instructions
- Per-ledger: 1B instructions

**Scoring**: Linear up to 50% utilization, then penalized.

---

### Memory Cost

**Formula**:
```
C_mem = k_mem × e^(5 × M / M_tx)
```

**Limit**: 41,943,040 bytes per transaction

**Scoring**: Exponential penalty above 70% (no direct fees, limit-only).

---

### Ledger Cost

**Dimensions**:
1. **Read entries** (limit: 40/tx, 20K/ledger)
2. **Read bytes** (limit: 200KB/tx, 100MB/ledger)
3. **Write entries** (limit: 25/tx, 10K/ledger)
4. **Write bytes** (limit: 100KB/tx, 50MB/ledger)
5. **Bandwidth** (limit: 100KB/tx, 1MB/ledger)

**Formula**: Sum of per-entry fees + per-KB fees for each dimension.

**Scoring**: Composite weighted average of all five dimensions.

---

## 🔧 Configuration

### Default Constants

Loaded from `SorobanConfig` class (matches Soroban mainnet v20):

```python
config = SorobanConfig(
    txMaxInstructions=100_000_000,
    ledgerMaxInstructions=1_000_000_000,
    feeRatePerInstructionsIncrement=10_000,
    txMemoryLimit=41_943_040,
    txMaxReadLedgerEntries=40,
    txMaxWriteLedgerEntries=25,
    # ... (see src/cost_model.py for full list)
)
```

### Tunable Parameters

| Parameter | Default | Adjust For |
|-----------|---------|------------|
| `w_ledger` | 0.5 | Ledger congestion sensitivity |
| `k_mem` | 100 | Memory penalty severity |
| Score thresholds | 50%, 80% | UX sensitivity |
| Safety margin | 95% | Deployment risk tolerance |

---

##Example Results

### Simple Token Transfer

```
Instructions: 1.25M (1.25% of limit)
Memory: 2MB (5% of limit)
Score: 99/100 
Fee: 0.00184 XLM (~$0.0002)
```

### Complex Multi-Contract Call

```
Instructions: 75M (75% of limit)
Memory: 32MB (76% of limit)
Score: 70/100 
Fee: 0.08018 XLM (~$0.0088)

Hints:
HIGH CPU: Optimize loops and host function calls
CRITICAL: Memory usage at 76%. Optimize allocations
```

---

## Testing

**Test Suite**: [`tests/test_cost_model.py`](tests/test_cost_model.py)

### Test Categories

- CPU cost (minimal, high, ledger pressure)
- Memory cost (low, high, exponential growth)
- Ledger cost (reads, writes, bandwidth)
- Scoring function (all bands, monotonicity)
- Optimization hints (efficient, critical)
- Full pipeline (simple tx, complex tx, safety violations)

**Run with**: `pytest tests/test_cost_model.py -v`

---

## Integration Checklist

For integrating this model into your GasGuard engine:

- [ ] **Fetch Network Config** – Load from Soroban RPC `getLedgerEntries`
- [ ] **Simulate Transactions** – Call `simulateTransaction` RPC method
- [ ] **Track Memory** – Implement custom profiling or footprint estimation
- [ ] **Compute Costs** – Use `analyze_transaction()` function
- [ ] **Store Scores** – Save to analytics DB for historical tracking
- [ ] **CI/CD Integration** – Gate deploys on score <50 or safety violations
- [ ] **PR Comments** – Auto-post optimization hints

See [Walkthrough: Implementation Checklist](../.gemini/antigravity/brain/582bc740-fa6d-4da6-864f-c6c06bc76032/walkthrough.md#implementation-checklist-for-developers) for details.

---

##Files Structure

```
GasGuard-1/
├── docs/
│   ├── soroban-cost-model-spec.md    # Complete specification (600+ lines)
│   └── README.md                      # This file
├── src/
│   └── cost_model.py                  # Reference implementation (700+ lines)
└── tests/
    └── test_cost_model.py             # Test suite (400+ lines)
```

---

##Key Concepts

### Soroban Resource Metering

Soroban tracks resources at two levels:

1. **Per-Transaction**: Hard limits that cannot be exceeded
2. **Per-Ledger**: Aggregate limits across all txs in a ledger close

**Configuration Sources**:
- `ConfigSettingContractComputeV0` – CPU and memory
- `ConfigSettingContractLedgerCostV0` – Ledger I/O
- `ConfigSettingContractBandwidthV0` – Tx size

### Scoring Philosophy

**Lower resource usage → Higher score → Better efficiency**

- **100–80**: Excellent (0–50% utilization)
- **80–50**: Good (50–80% utilization)
- **50–0**: Poor (80–100% utilization)

Aggregate score weights critical resources (CPU, ledger) higher than memory.

### Safety Margins

Transactions approaching **95% of any limit** trigger safety violations and should be blocked from deployment to prevent on-chain failures due to:
- Network config changes
- Simulation imprecision
- Concurrent ledger congestion

---

## 🔗 References

- **Soroban Docs**: [Resource Limits & Fees](https://soroban.stellar.org/docs/fundamentals-and-concepts/fees-and-metering)
- **Stellar Configuration**: [CAP-46 Smart Contract Standardized Asset](https://stellar.org/protocol/cap-46)
- **Soroban RPC**: [`simulateTransaction` API](https://soroban.stellar.org/api/methods/simulateTransaction)

---

## License

MIT License - GasGuard Engineering

---

**Questions?** See the [full specification](docs/soroban-cost-model-spec.md) or contact GasGuard Engineering.
