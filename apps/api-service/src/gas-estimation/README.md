# Gas Estimation Module - Quick Reference

## Installation & Setup

### 1. Module is Already Imported

The `GasEstimationModule` is automatically imported in `AppModule`:

```typescript
// apps/api-service/src/app.module.ts
imports: [
  // ... other modules
  GasEstimationModule  // ✅ Already added
]
```

### 2. Database Migration Required

Create TypeORM migration for `gas_price_history` table:

```bash
# From apps/api-service directory
npm run migration:generate -- -n CreateGasPriceHistory
npm run migration:run
```

Or manually create the table:

```sql
CREATE TABLE gas_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chainId VARCHAR(50) NOT NULL,
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

CREATE INDEX idx_gas_price_history_chainid_timestamp 
  ON gas_price_history(chainId, timestamp);
CREATE INDEX idx_gas_price_history_timestamp 
  ON gas_price_history(timestamp);
```

### 3. Environment Variables (Optional)

Add to `.env`:

```env
# Gas Estimation Configuration
GAS_ESTIMATION_UPDATE_INTERVAL_MS=10000
GAS_ESTIMATION_PRICE_VALIDITY_SECONDS=60
GAS_ESTIMATION_SAFETY_MARGIN=1.15
GAS_ESTIMATION_SOROBAN_RPC_URL=https://rpc.stellar.org/soroban/rpc
```

## API Usage Examples

### Basic Usage

#### Get Current Gas Price

```bash
curl -X POST http://localhost:3000/gas-estimation/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": "soroban-mainnet",
    "estimatedGasUnits": 100000,
    "priority": "normal"
  }'
```

**Response:**
```json
{
  "chainId": "soroban-mainnet",
  "estimatedGasUnits": 100000,
  "baseGasPrice": 1000,
  "surgeMultiplier": 1.08,
  "dynamicGasPrice": 1242,
  "totalEstimatedCostStroops": 124200000,
  "totalEstimatedCostXLM": 12.42,
  "priceValidityDurationMs": 47000,
  "expiresAt": "2026-02-22T15:31:00Z",
  "recommendedPriority": "normal",
  "alternativePrices": {
    "low": 993.60,
    "medium": 1242,
    "high": 1614.60
  },
  "confidence": 85
}
```

#### Get All Price Tiers

```bash
curl -X POST http://localhost:3000/gas-estimation/estimate/multi \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": "soroban-mainnet",
    "estimatedGasUnits": 100000
  }'
```

**Response includes low, normal, high, and critical options**

#### Get Optimal Price

```bash
curl -X POST http://localhost:3000/gas-estimation/suggest-optimal \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": "soroban-mainnet",
    "estimatedGasUnits": 100000
  }'
```

### Monitoring

#### Network Status

```bash
curl http://localhost:3000/gas-estimation/network-metrics/soroban-mainnet
```

#### Price History

```bash
# Last 24 hours
curl http://localhost:3000/gas-estimation/history/soroban-mainnet?hoursBack=24

# Last 7 days
curl http://localhost:3000/gas-estimation/history/soroban-mainnet?hoursBack=168
```

#### Best Times to Transact

```bash
curl http://localhost:3000/gas-estimation/best-time-windows/soroban-mainnet
```

#### Price Trends

```bash
curl http://localhost:3000/gas-estimation/trend/soroban-mainnet
```

#### Health Check

```bash
curl http://localhost:3000/gas-estimation/health
```

## Code Integration

### In a NestJS Service

```typescript
import { Injectable } from '@nestjs/common';
import { DynamicPricingService } from 'src/gas-estimation/services/dynamic-pricing.service';

@Injectable()
export class MyService {
  constructor(private dynamicPricing: DynamicPricingService) {}

  async estimateTransaction() {
    const estimate = await this.dynamicPricing.estimateGasPrice(
      'soroban-mainnet',
      100000,
      'normal'
    );

    return {
      estimatedCost: estimate.totalEstimatedCostXLM,
      currency: 'XLM',
      validUntil: estimate.expiresAt
    };
  }
}
```

### Handle Price Expiry

```typescript
async executeTransaction(chainId: string, gasUnits: number) {
  let estimate = await this.dynamicPricing.estimateGasPrice(
    chainId,
    gasUnits,
    'normal'
  );

  // Check if price is still valid
  if (estimate.expiresAt < new Date()) {
    // Refresh price
    estimate = await this.dynamicPricing.estimateGasPrice(
      chainId,
      gasUnits,
      'normal'
    );
  }

  // Use the price
  return submitTransaction(estimate.dynamicGasPrice);
}
```

### With Priority Levels

```typescript
// Get all priority options
const options = await this.dynamicPricing.getMultiplePriceOptions(
  'soroban-mainnet',
  100000
);

// Choose based on urgency
const priority = isUrgent ? options.high : options.normal;
```

## Common Scenarios

### Scenario 1: Batch Multiple Transactions

```typescript
const transactions = [
  { chainId: 'soroban-mainnet', gasUnits: 50000 },
  { chainId: 'soroban-mainnet', gasUnits: 75000 },
  { chainId: 'soroban-testnet', gasUnits: 60000 }
];

const estimates = await Promise.all(
  transactions.map(tx =>
    this.dynamicPricing.estimateGasPrice(
      tx.chainId,
      tx.gasUnits,
      'normal'
    )
  )
);

const totalCost = estimates.reduce(
  (sum, e) => sum + e.totalEstimatedCostXLM,
  0
);
```

### Scenario 2: Find Cheapest Chain

```typescript
const chains = ['soroban-mainnet', 'soroban-testnet'];
const gasUnits = 100000;

const estimates = await Promise.all(
  chains.map(chainId =>
    this.dynamicPricing.estimateGasPrice(chainId, gasUnits, 'normal')
  )
);

const cheapest = estimates.reduce((prev, current) =>
  current.totalEstimatedCostXLM < prev.totalEstimatedCostXLM ? current : prev
);

console.log(`Execute on ${cheapest.chainId}`);
```

### Scenario 3: Schedule for Low Prices

```typescript
const windows = await this.gasPriceHistory.getBestTimeWindowsForLowPrices(
  'soroban-mainnet',
  5
);

const bestHour = windows[0].hour; // e.g., 3 (UTC)

// Schedule for next occurrence of that hour
const scheduled = new Date();
scheduled.setUTCHours(bestHour, 0, 0, 0);

if (scheduled < new Date()) {
  scheduled.setUTCDate(scheduled.getUTCDate() + 1); // Tomorrow
}

console.log(`Best to execute at ${scheduled.toUTCString()}`);
```

## File Structure

```
gas-estimation/
├── services/
│   ├── network-monitor.service.ts      # Real-time metrics collection
│   ├── dynamic-pricing.service.ts      # Core pricing engine
│   └── gas-price-history.service.ts    # Historical analysis
├── interfaces/
│   └── gas-price.interface.ts          # Type definitions
├── dto/
│   └── gas-estimate.dto.ts             # API schemas
├── entities/
│   └── gas-price-history.entity.ts     # Database entity
├── __tests__/
│   └── gas-estimation.spec.ts          # Unit tests
├── gas-estimation.controller.ts        # REST endpoints
├── gas-estimation.module.ts            # NestJS module
└── index.ts                            # Exports
```

## Performance Tips

### Caching

- **Metrics Cache**: Updated every 10 seconds automatically
- **Price Snapshot Cache**: In-memory, expires with TTL
- **Request within 10s**: Get same cached snapshot

### Batch Operations

```typescript
// ✅ Good: Parallel requests
await Promise.all(
  transactions.map(tx =>
    this.dynamicPricing.estimateGasPrice(tx.chainId, tx.gasUnits, 'normal')
  )
);

// ❌ Avoid: Sequential requests
for (const tx of transactions) {
  await this.dynamicPricing.estimateGasPrice(tx.chainId, tx.gasUnits, 'normal');
}
```

### Database Queries

Use the provided indexed fields:

```typescript
// ✅ Fast: Uses index
await gasPriceHistoryService.getPriceHistory('soroban-mainnet', 24);

// ✅ Indexed fields
// - (chainId, timestamp) - for period queries
// - (timestamp) - for recent data
```

## Troubleshooting

### Issue: "Gas price estimation failed"

**Check**:
1. Is Soroban RPC accessible?
2. Chain ID is correct?
3. Valid gas units (> 0)?

**Fix**:
```bash
# Test RPC connectivity
curl https://rpc.stellar.org/soroban/rpc

# Check service health
curl http://localhost:3000/gas-estimation/health
```

### Issue: "Price confidence is low"

**Means**: Network conditions are volatile  
**Action**: Use `priority: 'high'` for safer pricing

### Issue: Old prices being returned

**Check**: Is price still within `priceValidityDurationMs`?  
**Fix**: Re-fetch fresh price after expiration

## Support & Documentation

- **Full Guide**: [DYNAMIC_GAS_ESTIMATION.md](/docs/DYNAMIC_GAS_ESTIMATION.md)
- **Migration Guide**: [MIGRATION_STATIC_TO_DYNAMIC_GAS.md](/docs/MIGRATION_STATIC_TO_DYNAMIC_GAS.md)
- **Integration Examples**: [INTEGRATION_EXAMPLES.md](/docs/INTEGRATION_EXAMPLES.md)
- **Tests**: See `__tests__/gas-estimation.spec.ts`
