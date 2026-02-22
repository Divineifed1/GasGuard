# Deployment Guide - Dynamic Gas Estimation Engine

**Target**: GasGuard API Service  
**Component**: Dynamic Gas Estimation Module for Soroban  
**Environment**: Development → Staging → Production

---

## Pre-Deployment Verification

### ✅ File Structure Verification

Verify all files are in place:

```bash
# From workspace root
ls -la apps/api-service/src/gas-estimation/
```

Expected structure:
```
gas-estimation/
├── services/
│   ├── network-monitor.service.ts         ✅
│   ├── dynamic-pricing.service.ts         ✅
│   └── gas-price-history.service.ts       ✅
├── interfaces/
│   └── gas-price.interface.ts             ✅
├── dto/
│   └── gas-estimate.dto.ts                ✅
├── entities/
│   └── gas-price-history.entity.entity.ts ✅
├── __tests__/
│   └── gas-estimation.spec.ts             ✅
├── gas-estimation.controller.ts           ✅
├── gas-estimation.module.ts               ✅
├── index.ts                               ✅
└── README.md                              ✅
```

### ✅ Module Import Verification

Check that `GasEstimationModule` is imported in `AppModule`:

```bash
grep -n "GasEstimationModule" apps/api-service/src/app.module.ts
```

Should see:
```
import { GasEstimationModule } from './gas-estimation/gas-estimation.module';
```

And in imports array:
```
GasEstimationModule
```

---

## Deployment Steps

### Step 1: Database Setup (5 minutes)

#### Option A: Using TypeORM Migration

```bash
cd apps/api-service

# Generate migration based on entity
npm run migration:generate -- -n CreateGasPriceHistory

# Review generated migration
cat src/database/migrations/[TIMESTAMP]-CreateGasPriceHistory.ts

# Run migration
npm run migration:run
```

#### Option B: Manual SQL

Execute this SQL on your target database:

```sql
-- Development/Staging (SQLite/PostgreSQL)
CREATE TABLE IF NOT EXISTS gas_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chainId VARCHAR(50) NOT NULL,
  chainName VARCHAR(100),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

-- Create indexes for performance
CREATE INDEX idx_gas_price_history_chainid_timestamp 
  ON gas_price_history(chainId, timestamp DESC)
  WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '30 days';

CREATE INDEX idx_gas_price_history_timestamp 
  ON gas_price_history(timestamp DESC)
  WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '30 days';
```

#### Verify Database Setup

```bash
# Check table exists
psql -c "\d gas_price_history"

# Should show columns and indexes
```

### Step 2: Environment Configuration (5 minutes)

Add to `.env` file (optional - defaults are sensible):

```env
# Gas Estimation Service Configuration
GAS_ESTIMATION_ENABLED=true
GAS_ESTIMATION_UPDATE_INTERVAL_MS=10000
GAS_ESTIMATION_PRICE_VALIDITY_SECONDS=60
GAS_ESTIMATION_SAFETY_MARGIN=1.15

# Soroban RPC Endpoints
SOROBAN_MAINNET_RPC=https://rpc.stellar.org/soroban/rpc
SOROBAN_TESTNET_RPC=https://soroban-testnet.stellar.org:443

# Optional: Monitoring
GAS_ESTIMATION_LOG_LEVEL=info
GAS_ESTIMATION_CACHE_TTL_SECONDS=10
```

### Step 3: Build Verification (10 minutes)

```bash
cd apps/api-service

# Clean build
npm run build

# Check for compilation errors
# Should complete without errors
```

### Step 4: Run Tests (15 minutes)

```bash
# Unit tests
npm run test -- gas-estimation

# Expected: All tests pass
# Coverage should be > 80%

# Optional: E2E tests
npm run test:e2e -- gas-estimation
```

### Step 5: Local Testing (10 minutes)

#### Start Development Server

```bash
npm run start:dev

# Watch for startup logs
# Should see: "GasGuard API Service is running on: http://localhost:3000"
```

#### Test Health Endpoint

```bash
curl http://localhost:3000/gas-estimation/health

# Response should be:
# {
#   "status": "healthy",
#   "timestamp": "2026-02-22T...",
#   "version": "1.0.0",
#   "supportedChains": ["soroban-mainnet", "soroban-testnet"]
# }
```

#### Test Basic Estimation

```bash
curl -X POST http://localhost:3000/gas-estimation/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": "soroban-mainnet",
    "estimatedGasUnits": 100000,
    "priority": "normal"
  }'

# Should return estimate with:
# - dynamicGasPrice
# - totalEstimatedCostXLM
# - expiresAt
# - priceConfidence
```

#### Test All Endpoints

```bash
# Get network metrics
curl http://localhost:3000/gas-estimation/network-metrics/soroban-mainnet

# Get multiple price options
curl -X POST http://localhost:3000/gas-estimation/estimate/multi \
  -H "Content-Type: application/json" \
  -d '{"chainId": "soroban-mainnet", "estimatedGasUnits": 100000}'

# Get optimal price suggestion
curl -X POST http://localhost:3000/gas-estimation/suggest-optimal \
  -H "Content-Type: application/json" \
  -d '{"chainId": "soroban-mainnet", "estimatedGasUnits": 100000}'

# Get historical data
curl "http://localhost:3000/gas-estimation/history/soroban-mainnet?hoursBack=24"

# Get best times
curl http://localhost:3000/gas-estimation/best-time-windows/soroban-mainnet

# Get trends
curl http://localhost:3000/gas-estimation/trend/soroban-mainnet
```

---

## Environment-Specific Deployment

### Development Environment

```bash
# Database: SQLite or local PostgreSQL
# Log Level: debug
# RPC: Soroban testnet
# Cache TTL: 10 seconds
# Safety Margin: 1.15

npm run start:dev
```

### Staging Environment

```bash
# Database: PostgreSQL (staging)
# Log Level: info
# RPC: Soroban testnet (can switch to mainnet)
# Cache TTL: 10 seconds
# Safety Margin: 1.15

npm run build
npm run start:prod
```

### Production Environment

```bash
# Database: PostgreSQL (production)
# Log Level: warn (info for monitoring)
# RPC: Soroban mainnet
# Cache TTL: 10 seconds (can reduce to 5)
# Safety Margin: 1.15 (monitor and adjust based on failure rates)

npm run build

# Deploy with docker-compose or k8s
docker-compose up -d api-service
```

---

## Monitoring & Verification

### Post-Deployment Checks

#### 1. Service Health

```bash
# Check service is running
curl http://api-service:3000/gas-estimation/health

# Expected: 200 OK, status: "healthy"
```

#### 2. Database Connectivity

```bash
# Verify historical data is being written
SELECT COUNT(*) FROM gas_price_history;

# Should see increasing count over time (every 10 seconds)
```

#### 3. Network Metrics

```bash
curl http://api-service:3000/gas-estimation/network-metrics/soroban-mainnet

# Verify:
# - congestionLevel varies (not stuck)
# - volatilityIndex > 0
# - priceConfidence changes
```

#### 4. Performance Metrics

```bash
# Response time should be < 100ms for most requests
curl -w "@curl-format.txt" -o /dev/null -s \
  http://api-service:3000/gas-estimation/estimate \
  -d '{"chainId": "soroban-mainnet", "estimatedGasUnits": 100000}'

# Check database query performance
EXPLAIN ANALYZE SELECT * FROM gas_price_history 
  WHERE chainId = 'soroban-mainnet' 
  ORDER BY timestamp DESC LIMIT 100;
```

### Monitoring Dashboard Metrics

Set up monitoring for:

1. **API Latency**
   ```
   - p50, p95, p99 response times
   - Target: < 100ms for most requests
   ```

2. **Request Volume**
   ```
   - Requests/second
   - Expected: 10-100 RPS steady
   ```

3. **Error Rate**
   ```
   - 5xx errors should be < 0.1%
   - Price estimation failures should be < 1%
   ```

4. **Data Quality**
   ```
   - priceConfidence > 70% (normal)
   - volatilityIndex < 50 (stable)
   ```

5. **Database**
   ```
   - Table size growth
   - Query execution time
   - Index usage
   ```

---

## Rollback Plan

If critical issues arise:

### Immediate Rollback (5 minutes)

```bash
# Option 1: Stop the service
docker-compose down api-service
docker-compose up -d api-service  # Previous version

# Option 2: Switch DNS/Load Balancer to older instance
# (if deployed side-by-side)

# Option 3: Revert Docker image
docker run -d --name api-service \
  gasguard:api-service-v1.0.0  # Previous stable version
```

### Gradual Rollback (30 minutes)

If issues are not critical:

1. **Disable new endpoints at load balancer**
   - Route `/gas-estimation/*` to old service
   - Keep optimization queries using static pricing

2. **Monitor error rates**
   - Should drop to baseline

3. **Investigate issues offline**
   - Review logs
   - Test fixes in staging

4. **Prepare hotfix**
   - Deploy corrected version
   - Test thoroughly

---

## Performance Baseline

After deployment, establish baseline metrics:

| Metric | Target | Acceptable Range |
|--------|--------|------------------|
| Response Time (p50) | 20ms | 10-50ms |
| Response Time (p95) | 50ms | 30-100ms |
| Response Time (p99) | 100ms | 50-200ms |
| Error Rate | 0.01% | 0-0.1% |
| Database Latency | 10ms | 5-20ms |
| Cache Hit Rate | 85% | 80-95% |
| Uptime | 99.9% | > 99.5% |

---

## Integration Checklist

After deployment, integrate with other modules:

- [ ] Update `OptimizationEngineService` to use dynamic pricing
  - Replace hardcoded gas prices
  - Use `DynamicPricingService.estimateGasPrice()`
  
- [ ] Update `ScannerService` for cost analysis
  - Get accurate costs for scanned contracts
  - Show real-time pricing in reports

- [ ] Update `AnalyticsModule` dashboards
  - Display dynamic gas prices
  - Show historical trends
  - Add network metrics

- [ ] Update `ReportsModule`
  - Include gas estimation in merchant reports
  - Show savings opportunities

---

## Post-Deployment Communication

### Team Notification

```
✅ Dynamic Gas Estimation Engine deployed successfully!

📊 New capabilities:
- Real-time network-aware pricing
- 7 new REST endpoints
- Historical analysis for optimization
- Price confidence scoring

📝 Documentation:
- /docs/DYNAMIC_GAS_ESTIMATION.md (full guide)
- /docs/MIGRATION_STATIC_TO_DYNAMIC_GAS.md (integration)
- /docs/INTEGRATION_EXAMPLES.md (code samples)
- apps/api-service/src/gas-estimation/README.md (API reference)

🚀 Getting started:
1. Read DYNAMIC_GAS_ESTIMATION.md
2. Test endpoints locally
3. Plan migration of your service
4. Follow MIGRATION_STATIC_TO_DYNAMIC_GAS.md

❓ Questions? Check docs or reach out to engineering team.
```

### Merchant Communication (Optional)

```
💡 GasGuard now offers real-time gas pricing!

Before: Fixed gas prices that could fail during congestion
Now: Adaptive prices that save money during calm periods

✨ New features:
- Get current market prices (not estimates)
- Choose your speed/cost tradeoff (low/normal/high)
- Identify best times to transact
- Real-time network monitoring

Get started: Use new /gas-estimation API endpoints
```

---

## Support & Troubleshooting

### Common Issues After Deployment

| Issue | Diagnosis | Solution |
|-------|-----------|----------|
| 404 errors on endpoints | Module not imported | Check AppModule imports |
| Database errors | Migration not run | Execute SQL migration |
| High latency | RPC timeouts | Verify Soroban RPC connectivity |
| Low confidence scores | Normal during congestion | Issue resolves automatically |
| Missing historical data | Normal first 24h | Data accumulates over time |

### Debug Commands

```bash
# Check service logs
docker logs api-service | grep "gas-estimation"

# Test RPC connectivity
curl -X POST https://rpc.stellar.org/soroban/rpc \
  -H "Content-Type: application/json" \
  -d '{"method": "getHealth", "params": [], "jsonrpc": "2.0", "id": 1}'

# Check database table
psql -c "SELECT COUNT(*), MAX(timestamp) FROM gas_price_history;"

# Monitor cache hits
watch -n 1 'psql -c "SELECT COUNT(*) FROM gas_price_history WHERE timestamp > NOW() - INTERVAL 1 minute;"'
```

---

## Success Criteria

Deployment is successful when:

- ✅ All endpoints respond within 100ms
- ✅ Zero critical errors in first 24h
- ✅ Database accumulating price history
- ✅ Price estimates vary with network state
- ✅ Confidence scores > 70% normally
- ✅ Historical data available after 24h
- ✅ Team can call new endpoints
- ✅ Tests pass with > 80% coverage

---

## Timeline

| Phase | Duration | Activities |
|-------|----------|-----------|
| **Prep** | 30 min | Verify files, check imports |
| **Database** | 15 min | Create table, verify schema |
| **Build & Test** | 25 min | Build code, run tests |
| **Deploy Dev** | 15 min | Deploy locally, test endpoints |
| **Deploy Staging** | 20 min | Deploy to staging, verify |
| **Monitor** | 24 hours | Watch metrics, verify data accumulation |
| **Integrate** | 3 days | Integrate with other modules |
| **Production** | 30 min | Deploy to production |

**Total Deployment**: ~2.5 hours active work + 24h monitoring

---

**Ready to deploy? Start with Step 1: Database Setup**

Questions? Check `/docs/DYNAMIC_GAS_ESTIMATION.md` or reach out to the engineering team.
