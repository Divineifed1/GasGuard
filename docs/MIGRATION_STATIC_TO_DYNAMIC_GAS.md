# Migration Guide: Static → Dynamic Gas Estimation

## Overview

This guide helps developers migrate from GasGuard's static gas pricing to the new dynamic gas estimation engine.

## Before & After

### Static Approach (Old)

```typescript
// Hard-coded gas price estimation
const STATIC_GAS_PRICE = 1000; // stroops per instruction

async estimateTransactionCost(gasUnits: number): Promise<number> {
  return gasUnits * STATIC_GAS_PRICE;
}

// Risk: Fails during congestion, overpays during calm periods
```

### Dynamic Approach (New)

```typescript
// Network-aware gas price estimation
async estimateTransactionCost(
  chainId: string,
  gasUnits: number,
  priority: 'low' | 'normal' | 'high' = 'normal'
): Promise<DynamicGasEstimate> {
  return await this.dynamicPricingService.estimateGasPrice(
    chainId,
    gasUnits,
    priority
  );
}

// Benefit: Always accurate, adapts to network conditions
```

## Step-by-Step Migration

### Step 1: Update Imports

**Before**:
```typescript
import { OptimizationEngineService } from './optimization-engine.service';

constructor(
  private optimizationEngine: OptimizationEngineService
) {}
```

**After**:
```typescript
import { OptimizationEngineService } from './optimization-engine.service';
import { DynamicPricingService } from '../gas-estimation/services/dynamic-pricing.service';

constructor(
  private optimizationEngine: OptimizationEngineService,
  private dynamicPricing: DynamicPricingService
) {}
```

### Step 2: Replace Static Constants

**Before**:
```typescript
private readonly BASE_GAS_PRICE = 1000;
private readonly SAFETY_MARGIN = 1.2; // 20% hardcoded
```

**After**:
```typescript
// Remove constants - they're now dynamic
// Get prices on-demand from DynamicPricingService
// Safety margin is built-in (1.15 = 15%)
```

### Step 3: Update API Call Sites

#### Example: Cost Optimization Suggestions

**Before**:
```typescript
async generateGasPriceSuggestion(analysis: any): Promise<OptimizationSuggestionDto> {
  // Using static price leads to inaccurate comparisons
  const currentPrice = 1000;
  const currentCost = analysis.avgGasUnits * currentPrice;
  const alternativeCost = analysis.avgGasUnits * 800; // Assumption
  
  return {
    description: 'Switch to cheaper chain',
    estimatedSavings: currentCost - alternativeCost, // Wrong!
  };
}
```

**After**:
```typescript
async generateGasPriceSuggestion(analysis: any): Promise<OptimizationSuggestionDto> {
  // Get actual dynamic prices for accurate comparison
  const currentEstimate = await this.dynamicPricing.estimateGasPrice(
    analysis.chainId,
    analysis.avgGasUnits,
    'normal'
  );
  
  const alternativeEstimate = await this.dynamicPricing.estimateGasPrice(
    alternativeChainId,
    analysis.avgGasUnits,
    'normal'
  );
  
  return {
    description: 'Switch to cheaper chain',
    estimatedSavings: 
      currentEstimate.totalEstimatedCostXLM - 
      alternativeEstimate.totalEstimatedCostXLM,
  };
}
```

### Step 4: Handle Price Expiry

**New Responsibility**: Track price validity

**Before**:
```typescript
// Price was static - no expiry concern
const gasPrice = this.BASE_GAS_PRICE;
submitTransaction(gasPrice);
```

**After**:
```typescript
// Get price with expiry time
const estimate = await this.dynamicPricing.estimateGasPrice(
  chainId,
  gasUnits,
  'normal'
);

// Check if price is still valid before using
if (estimate.expiresAt < new Date()) {
  // Re-fetch price
  const freshEstimate = await this.dynamicPricing.estimateGasPrice(
    chainId,
    gasUnits,
    'normal'
  );
  submitTransaction(freshEstimate.dynamicGasPrice);
} else {
  submitTransaction(estimate.dynamicGasPrice);
}
```

### Step 5: Update Database Queries

**Before**:
```sql
-- Calculating costs with static price
SELECT 
  transaction_id,
  gas_units * 1000 as estimated_cost
FROM transactions;
```

**After**:
```sql
-- Join with historical gas prices for accurate cost
SELECT 
  t.transaction_id,
  t.gas_units * gph.effectiveGasPrice as actual_cost
FROM transactions t
JOIN gas_price_history gph ON 
  t.chain_id = gph.chainId 
  AND t.created_at BETWEEN gph.timestamp - '1 minute'::interval 
                       AND gph.timestamp + '1 minute'::interval
ORDER BY gph.timestamp DESC
LIMIT 1; -- Get closest time match
```

## Common Migration Patterns

### Pattern 1: Single Transaction Estimation

```typescript
// Estimate cost for a single transaction
async getTransactionCost(tx: Transaction): Promise<number> {
  const estimate = await this.dynamicPricing.estimateGasPrice(
    tx.chainId,
    tx.estimatedGasUnits,
    'normal'
  );
  
  return estimate.totalEstimatedCostXLM;
}
```

### Pattern 2: Batch Operations with Priority

```typescript
// Get prices for multiple transactions with different priorities
async estimateBatchCosts(
  transactions: Transaction[]
): Promise<Map<string, number>> {
  const costMap = new Map();
  
  for (const tx of transactions) {
    const priority = tx.urgent ? 'high' : 'normal';
    const estimate = await this.dynamicPricing.estimateGasPrice(
      tx.chainId,
      tx.estimatedGasUnits,
      priority
    );
    
    costMap.set(tx.id, estimate.totalEstimatedCostXLM);
  }
  
  return costMap;
}
```

### Pattern 3: Finding Optimal Execution Time

```typescript
// Find best time to execute (lowest gas price)
async findOptimalExecutionTime(
  chainId: string,
  gasUnits: number
): Promise<Date> {
  const timeWindows = 
    await this.gasPriceHistory.getBestTimeWindowsForLowPrices(chainId);
  
  // timeWindows[0] has the lowest average price
  const bestHour = timeWindows[0].hour;
  const now = new Date();
  
  // Schedule for next occurrence of that hour (UTC)
  const scheduled = new Date(now);
  scheduled.setUTCHours(bestHour, 0, 0, 0);
  
  if (scheduled < now) {
    scheduled.setUTCDate(scheduled.getUTCDate() + 1); // Next day
  }
  
  return scheduled;
}
```

### Pattern 4: Confidence-Based Decision Making

```typescript
// Adjust strategy based on price confidence
async shouldProceedWithTransaction(
  txData: TransactionData
): Promise<{ proceed: boolean; reason: string }> {
  const estimate = await this.dynamicPricing.estimateGasPrice(
    txData.chainId,
    txData.gasUnits,
    'normal'
  );
  
  if (estimate.alternativePrices.high * 1.05 < txData.maxPrice) {
    // Confident we'll stay under budget with margin
    return { 
      proceed: true, 
      reason: `Price confidence: ${estimate.priceConfidence}%` 
    };
  } else if (txData.urgent) {
    // Proceed anyway if urgent, but warn
    return { 
      proceed: true, 
      reason: `Proceeding despite ${100 - estimate.priceConfidence}% uncertainty - tx is urgent` 
    };
  } else {
    return { 
      proceed: false, 
      reason: `Wait for better prices. Current confidence: ${estimate.priceConfidence}%` 
    };
  }
}
```

## Checklist for Migration

- [ ] **Update imports** across all affected files
- [ ] **Remove static constants** for gas prices
- [ ] **Inject DynamicPricingService** where needed
- [ ] **Replace hardcoded prices** with dynamic estimates
- [ ] **Handle price expiry** - reload if `expiresAt` passed
- [ ] **Update database queries** to join with gas_price_history
- [ ] **Test with priority levels** - low, normal, high, critical
- [ ] **Monitor price confidence** - fallback for low confidence
- [ ] **Update documentation** - link to DYNAMIC_GAS_ESTIMATION.md
- [ ] **Run E2E tests** - ensure cost calculations are accurate
- [ ] **Deploy migration steps**:
  1. Deploy new GasEstimationModule (backwards compatible)
  2. Update services to use dynamic pricing
  3. Monitor for 24 hours for any anomalies
  4. Remove old static pricing code

## Verification Steps

### Verify Dynamic Pricing is Working

```bash
# Test the health endpoint
curl http://localhost:3000/gas-estimation/health

# Get current network metrics
curl http://localhost:3000/gas-estimation/network-metrics/soroban-mainnet

# Request gas estimate
curl -X POST http://localhost:3000/gas-estimation/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": "soroban-mainnet",
    "estimatedGasUnits": 100000,
    "priority": "normal"
  }'

# Check comparison with historical data
curl 'http://localhost:3000/gas-estimation/history/soroban-mainnet?hoursBack=24'
```

### Compare Old vs New

```typescript
// Verify accuracy of migration
async verifyMigration() {
  const estimate = await this.dynamicPricing.estimateGasPrice(
    'soroban-mainnet',
    100000,
    'normal'
  );

  console.log('Old static approach:');
  console.log(`  Price: 1000 stroops/instruction`);
  console.log(`  Cost for 100k units: ${100000 * 1000} stroops = 1 XLM`);

  console.log('\nNew dynamic approach:');
  console.log(`  Base price: ${estimate.baseGasPrice} stroops/instruction`);
  console.log(`  Surge multiplier: ${estimate.surgeMultiplier.toFixed(2)}x`);
  console.log(`  Dynamic price: ${estimate.dynamicGasPrice.toFixed(0)} stroops/instruction`);
  console.log(`  Total cost: ${estimate.totalEstimatedCostStroops} stroops = ${estimate.totalEstimatedCostXLM.toFixed(6)} XLM`);
  console.log(`  Price valid until: ${estimate.expiresAt.toISOString()}`);
  console.log(`  Confidence: ${estimate.confidence}%`);
}
```

## Rollback Plan

If issues arise during migration:

1. **Stop using dynamic pricing** - revert imports to use static values
2. **Keep gas_price_history data** - may be valuable for analysis later
3. **Verify static prices work** - temporary fallback
4. **Debug and redeploy** - fix issues, test again

```typescript
// Fallback pattern during migration
async getCurrentGasPrice(chainId: string): Promise<number> {
  try {
    const estimate = await this.dynamicPricing.estimateGasPrice(
      chainId,
      100000, // Reference unit
      'normal'
    );
    return estimate.dynamicGasPrice;
  } catch (error) {
    this.logger.error('Dynamic pricing failed, using static fallback', error);
    return 1000; // Static fallback
  }
}
```

## Support

For migration questions:
- Read: [DYNAMIC_GAS_ESTIMATION.md](/docs/DYNAMIC_GAS_ESTIMATION.md)
- Test: Run integration tests in `test/e2e/gas-estimation.e2e-spec.ts`
- Ask: Create GitHub issue with `[migration]` tag
