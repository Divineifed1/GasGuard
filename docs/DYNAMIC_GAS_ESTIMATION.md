# Dynamic Gas Estimation Engine for Soroban

## Overview

The Dynamic Gas Estimation Engine replaces GasGuard's static gas pricing with **real-time, network-aware pricing** that adapts to Soroban network conditions. This solves three critical problems:

- ❌ **Failed Transactions**: No more underpricing due to aggressive static estimates
- ✅ **Optimal Pricing**: Users pay competitive rates, not inflated "safety margins"
- 📊 **Predictable UX**: Clear confirmation time estimates based on actual network state

## Architecture

### Core Components

```
gas-estimation/
├── services/
│   ├── NetworkMonitorService        # Tracks real-time network metrics
│   ├── DynamicPricingService        # Calculates adaptive gas prices
│   └── GasPriceHistoryService       # Analyzes trends for optimization
├── interfaces/
│   └── gas-price.interface.ts       # Type definitions
├── dto/
│   └── gas-estimate.dto.ts          # API request/response schemas
├── entities/
│   └── gas-price-history.entity.ts  # Database persistence
└── gas-estimation.controller.ts     # REST endpoints
```

### Data Flow

```
[Block Events] → [NetworkMonitorService] → [Real-time Metrics]
                                              ↓
                                    [DynamicPricingService]
                                              ↓
                     [User Request] → [Gas Quote] ← [Safety Margins]
                                              ↓
                              [GasPriceHistoryService]
                                              ↓
                                    [Historical Analysis]
```

## Key Features

### 1. Real-time Network Monitoring

**NetworkMonitorService** continuously tracks:

```typescript
interface NetworkMetrics {
  congestionLevel: number;           // 0-100%
  gasPoolUtilization: number;        // 0-100%
  averageTransactionTime: number;    // milliseconds
  pendingTransactionCount: number;
  lastBlockGasUsed: number;
  lastBlockGasLimit: number;
  historicalAverageGasPrice: number;
  priceVolatility: number;           // std deviation
}
```

**Updates**: Every 10 seconds via `@Cron(CronExpression.EVERY_10_SECONDS)`

### 2. Adaptive Surge Pricing

Gas prices automatically scale with network congestion:

```
Congestion Level:  0-30%   |  30-60%  |  60-85%  |  85-100%
Surge Multiplier:  1.0x    |  1.0-1.5 |  1.5-2.5 |  2.5-3.5+
                  (baseline | linear   | accel.   | exponential
```

This ensures:
- Low congestion = minimal premium
- High congestion = aggressive pricing to prevent failures
- Critical congestion = exponential scaling

### 3. Multi-Priority Support

Get different price tiers for different urgencies:

```typescript
// Request
{
  "chainId": "soroban-mainnet",
  "estimatedGasUnits": 100000,
  "priority": "normal"  // or "low", "high", "critical"
}

// Response includes all options
{
  "low":      { price: 850 stroops },    // 20% discount, slower
  "normal":   { price: 1000 stroops },   // baseline, avg time
  "high":     { price: 1500 stroops },   // 50% premium, faster
  "critical": { price: 2500 stroops }    // emergency pricing
}
```

### 4. Safety Margins

All quotes include a **15% safety margin** to prevent failures:

```
Dynamic Price = Base Price × Surge Multiplier × 1.15 (safety)
```

This ensures transactions confirm even with minor network fluctuations.

### 5. Historical Analysis

Identifies patterns for optimization:

```typescript
// Find the cheapest times to transact
GET /gas-estimation/best-time-windows/soroban-mainnet

// Response analyzes 7 days and returns:
{
  "bestWindows": [
    {
      "hour": "02:00 UTC",
      "averagePrice": 800,
      "estimatedSavings": "35% vs baseline"
    },
    ...
  ]
}
```

### 6. Price Trend Detection

```typescript
// Get trend analysis
GET /gas-estimation/trend/soroban-mainnet

// Response
{
  "trend": "decreasing",           // increasing | decreasing | stable
  "percentChange": -12.5,
  "recommendation": "✅ Prices falling significantly. Optimal time for transactions."
}
```

## API Endpoints

### 1. Get Dynamic Gas Estimate

```bash
POST /gas-estimation/estimate
```

**Request**:
```json
{
  "chainId": "soroban-mainnet",
  "estimatedGasUnits": 100000,
  "priority": "normal",
  "transactionHash": "abc123" // optional
}
```

**Response**:
```json
{
  "chainId": "soroban-mainnet",
  "estimatedGasUnits": 100000,
  "baseGasPrice": 1000,
  "surgeMultiplier": 1.1,
  "dynamicGasPrice": 1265,
  "totalEstimatedCostStroops": 126500000,
  "totalEstimatedCostXLM": 12.65,
  "priceValidityDurationMs": 45000,
  "expiresAt": "2026-02-22T15:30:45Z",
  "recommendedPriority": "normal",
  "alternativePrices": {
    "low": 1000,
    "medium": 1265,
    "high": 1645
  },
  "confidence": 85
}
```

### 2. Get Multiple Price Options

```bash
POST /gas-estimation/estimate/multi
```

Returns all four priority levels in one request.

### 3. Get Optimal Price Suggestion

```bash
POST /gas-estimation/suggest-optimal
```

**Response**:
```json
{
  "recommendedPrice": 1100,
  "reasoning": "Network is decreasing with 35% load. Confidence: 92%",
  "expectedConfirmationTime": "4-7 seconds"
}
```

### 4. Get Network Metrics

```bash
GET /gas-estimation/network-metrics/soroban-mainnet
```

**Response**:
```json
{
  "chainId": "soroban-mainnet",
  "congestionLevel": 35.2,
  "gasPoolUtilization": 28.1,
  "averageTransactionTime": 4500,
  "volatilityIndex": 18.5,
  "currentGasPriceSnapshot": {
    "basePrice": 1000,
    "surgeMultiplier": 1.1,
    "recommendedPrice": 1265,
    "priceConfidence": 85
  }
}
```

### 5. Get Price History

```bash
GET /gas-estimation/history/soroban-mainnet?hoursBack=24
```

**Response**:
```json
{
  "chainId": "soroban-mainnet",
  "period": "24 hours",
  "dataPoints": 144,
  "statistics": {
    "average": 1150,
    "min": 950,
    "max": 1800,
    "stdDev": 180
  },
  "trend": {
    "trend": "stable",
    "percentChange": 2.3,
    "confidence": 75
  },
  "history": [...]
}
```

### 6. Get Best Time Windows

```bash
GET /gas-estimation/best-time-windows/soroban-mainnet
```

Finds optimal hours based on 7-day analysis.

## Integration with Existing Modules

### OptimizationEngineService

The dynamic engine integrates with cost optimization:

```typescript
// OLD: Static gas price
const gasPrice = 1000; // hardcoded

// NEW: Dynamic gas price
const gasPrice = await dynamicPricingService.estimateGasPrice(
  'soroban-mainnet',
  estimatedUnits
);
```

### Usage in Merchant Cost Optimization

```typescript
// Generate better optimization suggestions with accurate pricing
async generateOptimizationSuggestions(merchantId: string) {
  // Get transactions
  const transactions = await getTransactionHistory(merchantId);

  // Calculate actual dynamic costs
  for (const tx of transactions) {
    const estimate = await dynamicPricingService.estimateGasPrice(
      tx.chainId,
      tx.gasUnits,
      'normal'
    );
    
    tx.actualCost = estimate.totalEstimatedCostXLM;
  }

  // Compare against alternatives with same dynamic pricing
  // Now we get accurate ROI on chain-switching recommendations!
}
```

## Configuration

### Pricing Strategy (Configurable)

Edit in `DynamicPricingService`:

```typescript
private readonly defaultStrategy: PricingStrategy = {
  name: 'soroban-adaptive',
  baseMultiplier: 1.0,
  congestionThresholds: {
    low: 30,      // Adjust congestion levels
    medium: 60,
    high: 85,
  },
  surgeMultipliers: {
    low: 1.0,     // Adjust multipliers per level
    medium: 1.3,
    high: 2.0,
    critical: 3.5,
  },
  safetyMargin: 1.15,  // 15% buffer
};
```

### Update Frequency

Currently set to 10 seconds. Customize via:

```typescript
@Cron(CronExpression.EVERY_10_SECONDS)  // Change this
async updateNetworkMetrics(): Promise<void> { ... }
```

### Historical Data Retention

Default: 30 days. Cleanup runs automatically:

```typescript
// Runs periodically (add @Cron decorator as needed)
await gasPriceHistoryService.cleanupOldRecords(30);
```

## Database Schema

### gas_price_history Table

```sql
CREATE TABLE gas_price_history (
  id UUID PRIMARY KEY,
  chainId VARCHAR(50),
  chainName VARCHAR(100),
  timestamp TIMESTAMP DEFAULT NOW(),
  baseGasPrice NUMERIC(18,6),
  surgeMultiplier NUMERIC(8,4),
  effectiveGasPrice NUMERIC(18,6),
  networkLoad NUMERIC(5,2),
  memoryPoolSize NUMERIC(18,0),
  transactionCount INT,
  blockTime NUMERIC(8,2),
  volatilityIndex NUMERIC(5,2),
  priceConfidence NUMERIC(5,2)
);

CREATE INDEX idx_chainid_timestamp ON gas_price_history(chainId, timestamp);
CREATE INDEX idx_timestamp ON gas_price_history(timestamp);
```

## Performance Considerations

### Cache Strategy

- **PriceSnapshotCache**: In-memory, updated every 10 seconds
- **MetricsCache**: In-memory, TTL-based expiration
- **HistoricalData**: Database-backed for 30-day retention

### Query Optimization

For high-throughput scenarios:

```typescript
// ✅ Fast: Uses index on (chainId, timestamp)
await gasPriceHistoryService.getPriceHistory('soroban-mainnet', 24);

// ✅ Fast: Single point lookup from cache
await networkMonitorService.getGasPriceSnapshot('soroban-mainnet');

// Slower: Full table scan (avoid if possible)
await gasPriceHistoryService.getBestTimeWindowsForLowPrices(chainId, 100);
```

## Future Enhancements

### Phase 2: Mempool Analysis

```typescript
// Watch pending transaction pool for predictive pricing
async monitorMempoolForSurgeSignals(chainId: string) {
  const mempool = await sorobanRpc.getPendingTransactions(chainId);
  
  if (mempool.length > threshold) {
    // Pre-emptively increase surge multiplier
    // Warn users of incoming congestion
  }
}
```

### Phase 3: Machine Learning

```typescript
// Predict prices 1-6 hours ahead
async predictFutureGasPrice(chainId: string, hoursAhead: number) {
  // Train model on historical data
  // Account for time-of-day patterns, day-of-week patterns
  // Return confidence-weighted predictions
}
```

### Phase 4: Cross-Chain Arbitrage

```typescript
// Dynamically recommend cheapest chain
async suggestCheapestChain(operation: TransactionOperation) {
  const estimates = await Promise.all(
    ['soroban-mainnet', 'soroban-testnet'].map(chainId =>
      this.estimateGasPrice(chainId, operation.gasUnits)
    )
  );
  
  return estimates.sort((a, b) => 
    a.totalEstimatedCostXLM - b.totalEstimatedCostXLM
  )[0];
}
```

## Testing

### Unit Tests

```bash
npm run test:watch -- gas-estimation
```

### E2E Tests

```bash
npm run test:e2e
```

Test coverage includes:
- ✅ Surge multiplier calculations
- ✅ Price validity windows
- ✅ Historical trend detection
- ✅ Safety margin application
- ✅ Priority-based pricing
- ✅ API endpoint contracts

## Troubleshooting

### Issue: Prices suddenly spike

**Cause**: Network congestion spike  
**Solution**: Check `GET /gas-estimation/network-metrics/{chainId}` for congestion level

### Issue: Transactions still failing

**Cause**: Safety margin too low or outdated quote  
**Solution**: 
1. Verify `priceValidityDurationMs` - quotes expire
2. Check `priceConfidence` - low confidence = unsafe
3. Use `priority: 'high'` or `'critical'` for important txs

### Issue: Historical data is sparse

**Cause**: Service recently started  
**Solution**: Data accumulates over time. Initial 1-2 hours may show incomplete patterns

## Support

For issues or enhancements:
- Check network metrics at `/gas-estimation/network-metrics/{chainId}`
- Review price history at `/gas-estimation/history/{chainId}`
- Run health check at `/gas-estimation/health`
