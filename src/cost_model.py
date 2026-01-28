"""
Soroban Cost Model Implementation Reference
============================================

This module provides reference implementations of the cost models, scoring functions,
and analysis pipeline defined in ../docs/soroban-cost-model-spec.md

Author: GasGuard Engineering
Version: 1.0
"""

from dataclasses import dataclass
from datetime import datetime, timezone
import math

# ============================================================================
# Constants
# ============================================================================

SCORE_WEIGHTS = {'cpu': 0.4, 'memory': 0.2, 'ledger': 0.4}
LEDGER_WEIGHTS = [0.2, 0.2, 0.2, 0.2, 0.2]  # r_entries, r_bytes, w_entries, w_bytes, bw
SCALING_FACTOR_MEMORY = 100

# ============================================================================
# Data Structures
# ============================================================================

@dataclass
class SorobanConfig:
    """Soroban network configuration constants."""
    
    # CPU/Compute limits
    txMaxInstructions: int = 100_000_000
    ledgerMaxInstructions: int = 1_000_000_000
    feeRatePerInstructionsIncrement: int = 10_000
    feeCPUPerIncrement: float = 0.00001  # XLM
    txMemoryLimit: int = 41_943_040  # bytes
    
    # Ledger I/O limits
    txMaxReadLedgerEntries: int = 40
    txMaxReadBytes: int = 200_000
    txMaxWriteLedgerEntries: int = 25
    txMaxWriteBytes: int = 100_000
    ledgerMaxReadLedgerEntries: int = 20_000
    ledgerMaxReadBytes: int = 100_000_000
    ledgerMaxWriteLedgerEntries: int = 10_000
    ledgerMaxWriteBytes: int = 50_000_000
    
    # Ledger I/O fees
    feeReadLedgerEntry: float = 0.0001  # XLM
    feeWriteLedgerEntry: float = 0.0002  # XLM
    feeRead1KB: float = 0.00005  # XLM
    feeWrite1KB: float = 0.0001  # XLM
    
    # Bandwidth limits
    txMaxSizeBytes: int = 100_000
    ledgerMaxTxsSizeBytes: int = 1_000_000
    feeTxSize1KB: float = 0.00001  # XLM
    
    version: str = "mainnet-v20"


@dataclass
class Footprint:
    """Ledger entry footprint."""
    readOnly: list[str]
    readWrite: list[str]


@dataclass
class SorobanResources:
    """Soroban transaction resources."""
    footprint: Footprint
    instructions: int
    readBytes: int
    writeBytes: int


@dataclass
class SimulationResult:
    """Result from Soroban RPC simulateTransaction call."""
    instructions: int
    memoryBytes: int
    resources: SorobanResources
    transactionSizeBytes: int


@dataclass
class CPUCost:
    """CPU cost breakdown."""
    fee: float  # XLM
    normalized: float  # [0, 1]
    ledger_pressure: float  # [0, 1]
    total: float  # XLM


@dataclass
class MemoryCost:
    """Memory cost breakdown."""
    bytes_used: int
    normalized: float  # [0, 1]
    cost: float  # Penalty score


@dataclass
class LedgerCost:
    """Ledger I/O and bandwidth cost breakdown."""
    fee: float  # XLM
    normalized: float  # [0, 1]
    breakdown: dict[str, float]


@dataclass
class Scores:
    """Resource efficiency scores (0-100 scale)."""
    cpu: int
    memory: int
    ledger: int
    total: int


@dataclass
class Analysis:
    """Complete transaction analysis result."""
    costs: dict[str, any]
    scores: Scores
    hints: list[str]
    safety_violations: list[str]
    timestamp: datetime
    config_version: str


# ============================================================================
# Helpers
# ============================================================================

def _interpolate(val: float, in_min: float, in_max: float, out_min: float, out_max: float) -> float:
    """Linear interpolation helper."""
    if in_max == in_min:
        return out_min
    ratio = (val - in_min) / (in_max - in_min)
    return out_min + ratio * (out_max - out_min)


# ============================================================================
# Cost Computation Functions
# ============================================================================

def compute_cpu_cost(sim: SimulationResult, config: SorobanConfig) -> CPUCost:
    """Compute CPU cost from instruction count."""
    instructions = sim.instructions
    limit_tx = config.txMaxInstructions
    limit_ledger = config.ledgerMaxInstructions
    
    # Fee calculation
    fee_increments = math.ceil(instructions / config.feeRatePerInstructionsIncrement)
    fee = fee_increments * config.feeCPUPerIncrement
    
    # Utilization
    util_tx = instructions / limit_tx
    util_ledger = instructions / limit_ledger
    
    # Quadratic penalty for disproportionate ledger usage
    ledger_pressure = util_ledger ** 2
    
    # Final cost adjusted for pressure
    pressure_weight = 0.5
    total_cost = fee * (1 + pressure_weight * ledger_pressure)
    
    return CPUCost(
        fee=fee,
        normalized=util_tx,
        ledger_pressure=ledger_pressure,
        total=total_cost
    )


def compute_memory_cost(sim: SimulationResult, config: SorobanConfig) -> MemoryCost:
    """Compute memory cost from peak memory usage (limit-only, no direct fees)."""
    mem_used = sim.memoryBytes
    limit = config.txMemoryLimit
    
    utilization = mem_used / limit
    
    # Exponential penalty prevents approaching hard limit
    # Formula: k * e^(5 * util)
    cost_score = SCALING_FACTOR_MEMORY * math.exp(5 * utilization)
    
    return MemoryCost(
        bytes_used=mem_used,
        normalized=utilization,
        cost=cost_score
    )


def compute_ledger_cost(sim: SimulationResult, config: SorobanConfig) -> LedgerCost:
    """Compute ledger I/O and bandwidth cost."""
    # usage counts
    reads = len(sim.resources.footprint.readOnly)
    writes = len(sim.resources.footprint.readWrite)
    read_bytes = sim.resources.readBytes
    write_bytes = sim.resources.writeBytes
    tx_size = sim.transactionSizeBytes
    
    # Fee components
    cost_reads = (reads * config.feeReadLedgerEntry + 
                  math.ceil(read_bytes / 1024) * config.feeRead1KB)
    
    cost_writes = (writes * config.feeWriteLedgerEntry + 
                   math.ceil(write_bytes / 1024) * config.feeWrite1KB)
                   
    cost_bandwidth = math.ceil(tx_size / 1024) * config.feeTxSize1KB
    
    total_fee = cost_reads + cost_writes + cost_bandwidth
    
    # Normalized utilization per dimension
    utils = {
        'read_entries': reads / config.txMaxReadLedgerEntries,
        'read_bytes': read_bytes / config.txMaxReadBytes,
        'write_entries': writes / config.txMaxWriteLedgerEntries,
        'write_bytes': write_bytes / config.txMaxWriteBytes,
        'bandwidth': tx_size / config.txMaxSizeBytes
    }
    
    # Composite score
    composite_norm = sum(u * w for u, w in zip(utils.values(), LEDGER_WEIGHTS))
    
    return LedgerCost(
        fee=total_fee,
        normalized=composite_norm,
        breakdown=utils
    )


# ============================================================================
# Scoring Functions
# ============================================================================

def score_dimension(utilization: float, threshold_low: float = 0.5, threshold_high: float = 0.8) -> int:
    """
    Convert utilization (0-1) to score (100-0).
    
    Bands:
    - Excellent (100-80): 0% -> 50% utilization
    - Good (80-50):      50% -> 80% utilization
    - Poor (50-0):       80% -> 100% utilization
    """
    if utilization < threshold_low:
        score = _interpolate(utilization, 0, threshold_low, 100, 80)
    elif utilization < threshold_high:
        score = _interpolate(utilization, threshold_low, threshold_high, 80, 50)
    else:
        score = _interpolate(utilization, threshold_high, 1.0, 50, 0)
        
    return int(max(0, min(100, score)))


def compute_scores(cpu: CPUCost, mem: MemoryCost, ledger: LedgerCost) -> Scores:
    """Compute per-dimension and aggregate scores."""
    s_cpu = score_dimension(cpu.normalized)
    s_mem = score_dimension(mem.normalized)
    s_ledger = score_dimension(ledger.normalized)
    
    s_total = int(
        SCORE_WEIGHTS['cpu'] * s_cpu + 
        SCORE_WEIGHTS['memory'] * s_mem + 
        SCORE_WEIGHTS['ledger'] * s_ledger
    )
    
    return Scores(
        cpu=s_cpu,
        memory=s_mem,
        ledger=s_ledger,
        total=s_total
    )


# ============================================================================
# Optimization Hints
# ============================================================================

def generate_hints(cpu: CPUCost, mem: MemoryCost, ledger: LedgerCost) -> list[str]:
    """Generate actionable optimization hints based on resource usage."""
    hints = []
    
    # CPU hints
    if cpu.normalized > 0.8:
        hints.append(f"CRITICAL: CPU usage at {cpu.normalized:.0%}. Reduce instruction count.")
    elif cpu.normalized > 0.6:
        hints.append("HIGH CPU: Optimize hot loops and host function calls.")
    
    if cpu.ledger_pressure > 0.5:
        pressure_pct = math.sqrt(cpu.ledger_pressure)
        hints.append(f"High ledger CPU pressure ({pressure_pct:.1%}).")
    
    # Memory hints
    if mem.normalized > 0.7:
        hints.append(f"CRITICAL: Memory usage at {mem.normalized:.0%}. Optimize allocations.")
    elif mem.normalized > 0.5:
        hints.append("MODERATE memory usage. Review data structure sizes.")
    
    # Ledger hints
    ledger_labels = {
        'read_entries': 'read entry count',
        'write_entries': 'write entry count',
        'read_bytes': 'read byte volume',
        'write_bytes': 'write byte volume',
        'bandwidth': 'transaction size'
    }
    
    for key, util in ledger.breakdown.items():
        if util > 0.75:
            hints.append(f"HIGH {ledger_labels[key]}. Consider batching or compression.")
            
    # Cross-dimension hints
    if cpu.normalized > 0.7 and ledger.breakdown['read_entries'] > 0.5:
        hints.append("TIP: High CPU + reads. Check for redundant storage accesses.")
    
    if not hints:
        hints.append("Excellent resource efficiency!")
    
    return hints


# ============================================================================
# Analysis Pipeline
# ============================================================================

def analyze_transaction(sim: SimulationResult, config: SorobanConfig) -> Analysis:
    """
    Complete analysis pipeline for a Soroban transaction.
    """
    # Compute costs
    cpu = compute_cpu_cost(sim, config)
    mem = compute_memory_cost(sim, config)
    ledger = compute_ledger_cost(sim, config)
    
    # Score
    scores = compute_scores(cpu, mem, ledger)
    
    # Generate hints
    hints = generate_hints(cpu, mem, ledger)
    
    # Safety Check (95% hard limit)
    safety_violations = []
    
    if cpu.normalized > 0.95:
        safety_violations.append("CPU exceeds 95% safety margin")
    
    if mem.normalized > 0.95:
        safety_violations.append("Memory exceeds 95% safety margin")
        
    for dim, util in ledger.breakdown.items():
        if util > 0.95:
            safety_violations.append(f"Ledger {dim} exceeds 95% safety margin")
    
    return Analysis(
        costs={'cpu': cpu, 'memory': mem, 'ledger': ledger},
        scores=scores,
        hints=hints,
        safety_violations=safety_violations,
        timestamp=datetime.now(timezone.utc),
        config_version=config.version
    )


# ============================================================================
# Example Usage
# ============================================================================

if __name__ == "__main__":
    # Example 1: Simple token transfer
    print("=" * 60)
    print("Example 1: Simple Token Transfer")
    print("=" * 60)
    
    config = SorobanConfig()
    
    sim1 = SimulationResult(
        instructions=1_250_000,
        memoryBytes=2_097_152,
        resources=SorobanResources(
            footprint=Footprint(
                readOnly=["ContractData(token_balance_alice)", "ContractData(token_metadata)"],
                readWrite=["ContractData(token_balance_bob)"]
            ),
            instructions=1_250_000,
            readBytes=512,
            writeBytes=256
        ),
        transactionSizeBytes=4096
    )
    
    analysis = analyze_transaction(sim1, config)
    
    print(f"\nScores: CPU={analysis.scores.cpu} Mem={analysis.scores.memory} Ledger={analysis.scores.ledger}")
    print(f"Total Score: {analysis.scores.total}/100")
    print(f"Total Fee: {analysis.costs['cpu'].fee + analysis.costs['ledger'].fee:.6f} XLM")
    
    print("\nHints:")
    for hint in analysis.hints:
        print(f"  {hint}")

