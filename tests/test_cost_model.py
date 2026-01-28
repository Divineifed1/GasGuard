"""
Unit tests for Soroban cost model implementation.

Run with: pytest test_cost_model.py -v
"""

import pytest
import math
from cost_model import (
    SorobanConfig, SimulationResult, SorobanResources, Footprint,
    CPUCost, MemoryCost, LedgerCost,
    compute_cpu_cost, compute_memory_cost, compute_ledger_cost,
    score_dimension, compute_scores, generate_hints, analyze_transaction
)


# ============================================================================
# Fixtures - Base Components
# ============================================================================

@pytest.fixture
def config():
    """Default Soroban mainnet configuration."""
    return SorobanConfig()


@pytest.fixture
def empty_footprint():
    """Empty ledger footprint (no reads or writes)."""
    return Footprint(readOnly=[], readWrite=[])


@pytest.fixture
def read_only_footprint():
    """Footprint with 3 read-only entries."""
    return Footprint(
        readOnly=["entry1", "entry2", "entry3"],
        readWrite=[]
    )


@pytest.fixture
def write_heavy_footprint():
    """Footprint with 1 read and 4 writes."""
    return Footprint(
        readOnly=["entry1"],
        readWrite=["entry2", "entry3", "entry4", "entry5"]
    )


# ============================================================================
# Fixtures - CPU Scenarios
# ============================================================================

@pytest.fixture
def minimal_cpu_sim(empty_footprint):
    """Minimal CPU usage: 1% of tx limit."""
    return SimulationResult(
        instructions=1_000_000,
        memoryBytes=0,
        resources=SorobanResources(
            footprint=empty_footprint,
            instructions=1_000_000,
            readBytes=0,
            writeBytes=0
        ),
        transactionSizeBytes=0
    )


@pytest.fixture
def high_cpu_sim(empty_footprint):
    """High CPU usage: 80% of tx limit."""
    return SimulationResult(
        instructions=80_000_000,
        memoryBytes=0,
        resources=SorobanResources(
            footprint=empty_footprint,
            instructions=80_000_000,
            readBytes=0,
            writeBytes=0
        ),
        transactionSizeBytes=0
    )


@pytest.fixture
def ledger_pressure_10_sim(empty_footprint):
    """CPU usage: 10% of ledger limit."""
    return SimulationResult(
        instructions=100_000_000,
        memoryBytes=0,
        resources=SorobanResources(
            footprint=empty_footprint,
            instructions=100_000_000,
            readBytes=0,
            writeBytes=0
        ),
        transactionSizeBytes=0
    )


@pytest.fixture
def ledger_pressure_20_sim(empty_footprint):
    """CPU usage: 20% of ledger limit."""
    return SimulationResult(
        instructions=200_000_000,
        memoryBytes=0,
        resources=SorobanResources(
            footprint=empty_footprint,
            instructions=200_000_000,
            readBytes=0,
            writeBytes=0
        ),
        transactionSizeBytes=0
    )


# ============================================================================
# Fixtures - Memory Scenarios
# ============================================================================

@pytest.fixture
def low_memory_sim(empty_footprint):
    """Low memory usage: ~10% of limit."""
    return SimulationResult(
        instructions=0,
        memoryBytes=4_194_304,
        resources=SorobanResources(
            footprint=empty_footprint,
            instructions=0,
            readBytes=0,
            writeBytes=0
        ),
        transactionSizeBytes=0
    )


@pytest.fixture
def high_memory_sim(empty_footprint):
    """High memory usage: 80% of limit."""
    return SimulationResult(
        instructions=0,
        memoryBytes=33_554_432,
        resources=SorobanResources(
            footprint=empty_footprint,
            instructions=0,
            readBytes=0,
            writeBytes=0
        ),
        transactionSizeBytes=0
    )


# ============================================================================
# Fixtures - Ledger I/O Scenarios
# ============================================================================

@pytest.fixture
def read_only_sim(read_only_footprint):
    """Read-only transaction: 3 entries, 3KB."""
    return SimulationResult(
        instructions=0,
        memoryBytes=0,
        resources=SorobanResources(
            footprint=read_only_footprint,
            instructions=0,
            readBytes=3000,
            writeBytes=0
        ),
        transactionSizeBytes=1024
    )


@pytest.fixture
def write_heavy_sim(write_heavy_footprint):
    """Write-heavy transaction: 4 writes, 8KB."""
    return SimulationResult(
        instructions=0,
        memoryBytes=0,
        resources=SorobanResources(
            footprint=write_heavy_footprint,
            instructions=0,
            readBytes=1000,
            writeBytes=8000
        ),
        transactionSizeBytes=2048
    )


@pytest.fixture
def large_tx_sim(empty_footprint):
    """Large transaction size: 50KB (50% of limit)."""
    return SimulationResult(
        instructions=0,
        memoryBytes=0,
        resources=SorobanResources(
            footprint=empty_footprint,
            instructions=0,
            readBytes=0,
            writeBytes=0
        ),
        transactionSizeBytes=50_000
    )


# ============================================================================
# Fixtures - Full Analysis Scenarios
# ============================================================================

@pytest.fixture
def simple_token_transfer_sim():
    """Simple token transfer (Example 1 from spec)."""
    return SimulationResult(
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


@pytest.fixture
def complex_marketplace_sim():
    """Complex marketplace transaction (Example 2 from spec)."""
    return SimulationResult(
        instructions=75_000_000,
        memoryBytes=32_000_000,
        resources=SorobanResources(
            footprint=Footprint(
                readOnly=["entry1", "entry2", "entry3", "entry4", "entry5", "entry6"],
                readWrite=["entry7", "entry8", "entry9", "entry10"]
            ),
            instructions=75_000_000,
            readBytes=45_000,
            writeBytes=12_000
        ),
        transactionSizeBytes=18_000
    )


@pytest.fixture
def safety_violation_sim(empty_footprint):
    """Transaction approaching safety limits (96% utilization)."""
    return SimulationResult(
        instructions=96_000_000,
        memoryBytes=40_265_318,
        resources=SorobanResources(
            footprint=empty_footprint,
            instructions=96_000_000,
            readBytes=0,
            writeBytes=0
        ),
        transactionSizeBytes=0
    )


# ============================================================================
# Fixtures - Cost Objects for Hint Testing
# ============================================================================

@pytest.fixture
def efficient_costs():
    """Cost objects for an efficient transaction (5% utilization)."""
    cpu = CPUCost(fee=0.001, normalized=0.05, ledger_pressure=0.0001, total=0.001)
    mem = MemoryCost(bytes_used=1_000_000, normalized=0.05, cost=20)
    ledger = LedgerCost(
        fee=0.0005,
        normalized=0.05,
        breakdown={
            'read_entries': 0.05,
            'read_bytes': 0.05,
            'write_entries': 0.05,
            'write_bytes': 0.05,
            'bandwidth': 0.05
        }
    )
    return cpu, mem, ledger


@pytest.fixture
def cpu_critical_costs():
    """Cost objects with critical CPU usage (85%)."""
    cpu = CPUCost(fee=0.075, normalized=0.85, ledger_pressure=0.01, total=0.076)
    mem = MemoryCost(bytes_used=1_000_000, normalized=0.05, cost=20)
    ledger = LedgerCost(
        fee=0.001,
        normalized=0.05,
        breakdown={
            'read_entries': 0.05,
            'read_bytes': 0.05,
            'write_entries': 0.05,
            'write_bytes': 0.05,
            'bandwidth': 0.05
        }
    )
    return cpu, mem, ledger


@pytest.fixture
def memory_critical_costs():
    """Cost objects with critical memory usage (75%)."""
    cpu = CPUCost(fee=0.01, normalized=0.1, ledger_pressure=0.0001, total=0.01)
    mem = MemoryCost(bytes_used=30_000_000, normalized=0.75, cost=1000)
    ledger = LedgerCost(
        fee=0.001,
        normalized=0.05,
        breakdown={
            'read_entries': 0.05,
            'read_bytes': 0.05,
            'write_entries': 0.05,
            'write_bytes': 0.05,
            'bandwidth': 0.05
        }
    )
    return cpu, mem, ledger


# ============================================================================
# Test Classes
# ============================================================================

class TestCPUCostModel:
    """Test CPU cost computation."""
    
    def test_minimal_cpu(self, config, minimal_cpu_sim):
        """Test CPU cost at minimal usage (1% of limit)."""
        cost = compute_cpu_cost(minimal_cpu_sim, config)
        assert cost.normalized == pytest.approx(0.01, rel=1e-3)
        assert cost.ledger_pressure == pytest.approx(0.000001, rel=1e-3)
        assert cost.fee > 0
    
    def test_high_cpu(self, config, high_cpu_sim):
        """Test CPU cost at 80% of limit."""
        cost = compute_cpu_cost(high_cpu_sim, config)
        assert cost.normalized == pytest.approx(0.8, rel=1e-3)
        assert cost.ledger_pressure > 0
        assert cost.total > cost.fee  # Penalty applied
    
    def test_cpu_ledger_pressure(self, config, ledger_pressure_10_sim, ledger_pressure_20_sim):
        """Test that ledger pressure is quadratic."""
        cost1 = compute_cpu_cost(ledger_pressure_10_sim, config)
        cost2 = compute_cpu_cost(ledger_pressure_20_sim, config)
        
        # Pressure should quadruple when usage doubles
        assert cost2.ledger_pressure == pytest.approx(4 * cost1.ledger_pressure, rel=1e-2)


class TestMemoryCostModel:
    """Test memory cost computation."""
    
    def test_low_memory(self, config, low_memory_sim):
        """Test memory cost at 10% of limit."""
        cost = compute_memory_cost(low_memory_sim, config)
        assert cost.normalized == pytest.approx(0.1, rel=1e-2)
        assert cost.cost > 0
    
    def test_high_memory(self, config, high_memory_sim):
        """Test exponential penalty at 80% of limit."""
        cost = compute_memory_cost(high_memory_sim, config)
        assert cost.normalized == pytest.approx(0.8, rel=1e-2)
        # Exponential: 100 * e^(5 * 0.8) = 100 * e^4
        expected_cost = 100 * math.exp(5 * 0.8)
        assert cost.cost == pytest.approx(expected_cost, rel=1e-2)
    
    def test_memory_exponential_growth(self, config, empty_footprint):
        """Verify memory cost grows exponentially."""
        costs = []
        for pct in [0.1, 0.3, 0.5, 0.7, 0.9]:
            mem = int(config.txMemoryLimit * pct)
            sim = SimulationResult(
                instructions=0,
                memoryBytes=mem,
                resources=SorobanResources(
                    footprint=empty_footprint,
                    instructions=0,
                    readBytes=0,
                    writeBytes=0
                ),
                transactionSizeBytes=0
            )
            cost = compute_memory_cost(sim, config)
            costs.append(cost.cost)
        
        # Each step should grow faster than linear
        for i in range(1, len(costs)):
            growth_rate = costs[i] / costs[i-1]
            assert growth_rate > 1.5  # Exponential growth


class TestLedgerCostModel:
    """Test ledger I/O and bandwidth cost computation."""
    
    def test_read_only_tx(self, config, read_only_sim):
        """Test transaction with only reads."""
        cost = compute_ledger_cost(read_only_sim, config)
        assert cost.breakdown['read_entries'] == pytest.approx(3 / 40, rel=1e-3)
        assert cost.breakdown['write_entries'] == 0
        assert cost.fee > 0
    
    def test_write_heavy_tx(self, config, write_heavy_sim):
        """Test transaction with many writes."""
        cost = compute_ledger_cost(write_heavy_sim, config)
        assert cost.breakdown['write_entries'] == pytest.approx(4 / 25, rel=1e-3)
        assert cost.breakdown['write_bytes'] == pytest.approx(8000 / 100_000, rel=1e-3)
    
    def test_large_tx_size(self, config, large_tx_sim):
        """Test bandwidth cost for large transaction."""
        cost = compute_ledger_cost(large_tx_sim, config)
        assert cost.breakdown['bandwidth'] == pytest.approx(0.5, rel=1e-3)


class TestScoringFunction:
    """Test scoring function behavior."""
    
    def test_excellent_score(self):
        """Test score at 10% utilization (should be ~98)."""
        score = score_dimension(0.1)
        assert 95 <= score <= 100
    
    def test_good_score(self):
        """Test score at 60% utilization (should be ~70)."""
        score = score_dimension(0.6)
        assert 65 <= score <= 75
    
    def test_poor_score(self):
        """Test score at 90% utilization (should be ~25)."""
        score = score_dimension(0.9)
        assert 20 <= score <= 30
    
    def test_critical_score(self):
        """Test score at 100% utilization (should be 0)."""
        score = score_dimension(1.0)
        assert score == 0
    
    def test_score_monotonic(self):
        """Verify score decreases as utilization increases."""
        prev_score = 100
        for util in [0.1, 0.3, 0.5, 0.7, 0.9, 1.0]:
            score = score_dimension(util)
            assert score <= prev_score
            prev_score = score


class TestOptimizationHints:
    """Test hint generation logic."""
    
    def test_no_hints_for_efficient_tx(self, efficient_costs):
        """Test that efficient transactions get positive feedback."""
        cpu, mem, ledger = efficient_costs
        hints = generate_hints(cpu, mem, ledger)
        assert any("Excellent" in h for h in hints)
    
    def test_cpu_critical_hint(self, cpu_critical_costs):
        """Test critical CPU hint at 85% utilization."""
        cpu, mem, ledger = cpu_critical_costs
        hints = generate_hints(cpu, mem, ledger)
        assert any("CRITICAL" in h and "CPU" in h for h in hints)
    
    def test_memory_critical_hint(self, memory_critical_costs):
        """Test critical memory hint at 75% utilization."""
        cpu, mem, ledger = memory_critical_costs
        hints = generate_hints(cpu, mem, ledger)
        assert any("CRITICAL" in h and "Memory" in h for h in hints)


class TestFullAnalysisPipeline:
    """Test complete analysis pipeline."""
    
    def test_simple_token_transfer(self, config, simple_token_transfer_sim):
        """Test analysis of simple token transfer (Example 1 from spec)."""
        analysis = analyze_transaction(simple_token_transfer_sim, config)
        
        # Should score very high (>95)
        assert analysis.scores.total >= 95
        assert analysis.scores.cpu >= 95
        assert analysis.scores.memory >= 95
        assert analysis.scores.ledger >= 90
        
        # Should have no safety violations
        assert len(analysis.safety_violations) == 0
        
        # Should have positive feedback
        assert any("Excellent" in h for h in analysis.hints)
    
    def test_complex_multi_contract_call(self, config, complex_marketplace_sim):
        """Test analysis of complex marketplace tx (Example 2 from spec)."""
        analysis = analyze_transaction(complex_marketplace_sim, config)
        
        # Should score moderate (60-75 range based on spec example)
        assert 60 <= analysis.scores.total <= 75
        
        # CPU and memory should be in good/poor range
        assert 50 <= analysis.scores.cpu <= 60
        assert 50 <= analysis.scores.memory <= 60
        
        # Should have optimization hints
        assert len(analysis.hints) > 1
        assert any("CPU" in h for h in analysis.hints)
        assert any("memory" in h.lower() for h in analysis.hints)
    
    def test_safety_violation_detection(self, config, safety_violation_sim):
        """Test that safety violations are detected at 96% utilization."""
        analysis = analyze_transaction(safety_violation_sim, config)
        
        # Should have safety violations
        assert len(analysis.safety_violations) >= 2
        assert any("CPU" in v for v in analysis.safety_violations)
        assert any("Memory" in v for v in analysis.safety_violations)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
