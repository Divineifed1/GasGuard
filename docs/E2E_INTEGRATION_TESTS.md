# End-to-End Integration Tests

## 🎯 Overview

This document describes the End-to-End (E2E) integration testing framework for GasGuard, designed to validate the complete transaction pipeline and ensure reliability across all services.

## 🏗️ Architecture

### Test Environment Components

1. **GasGuard API Service** - Main application under test
2. **PostgreSQL Database** - Test database instance
3. **Redis** - Queue and caching service
4. **Hardhat Node** - Local blockchain for smart contract testing
5. **Test Runner** - Jest with Supertest for HTTP testing

### Directory Structure

```
apps/api-service/
├── test/
│   ├── e2e/                    # E2E test files
│   │   ├── simple-transaction.e2e-spec.ts
│   │   ├── failure-scenarios.e2e-spec.ts
│   │   └── gasless-transaction.e2e-spec.ts
│   ├── utils/                  # Test utilities and helpers
│   │   └── test-helpers.ts
│   └── jest-e2e.json          # E2E test configuration
├── docker-compose.e2e.yml     # Docker test environment
├── Dockerfile.e2e             # Test container build
├── hardhat.config.ts          # Blockchain test configuration
└── package.json               # Updated test scripts
```

## 🚀 Quick Start

### Running Tests Locally

```bash
# Navigate to the API service directory
cd apps/api-service

# Install dependencies
npm install

# Run E2E tests
npm run test:e2e

# Run tests in watch mode
npm run test:e2e:watch

# Run tests with coverage
npm run test:e2e:cov
```

### Running Tests with Docker

```bash
# Start the complete test environment
docker-compose -f docker-compose.e2e.yml up

# Run tests against the Docker environment
npm run test:e2e

# Clean up
docker-compose -f docker-compose.e2e.yml down -v
```

## 🧪 Test Categories

### 1. Basic Transaction Flow Tests

Validates core functionality:
- Transaction creation via API endpoints
- Health check and monitoring endpoints
- Analytics dashboard functionality
- Batch processing capabilities

### 2. Failure Scenario Tests

Tests error handling and resilience:
- Invalid transaction data
- Malformed requests
- Rate limiting behavior
- Service timeout handling
- Stress testing under load

### 3. Gasless Transaction Flow Tests

Complete end-to-end workflow validation:
- Transaction initiation
- Queue processing (BullMQ)
- Worker execution
- Blockchain interaction
- Signature verification
- Transaction completion monitoring

## 🛠️ Test Utilities

### Test Helpers (`test/utils/test-helpers.ts`)

```typescript
// Create test application environment
const app = await createTestApp();

// Generate test contract code
const contractCode = generateTestContract('MyTestContract');

// Measure performance metrics
const performance = await measurePerformance(async () => {
  // operation to measure
}, 10);

// Generate mock data
const mockTx = generateMockTransaction();
const mockBatch = generateMockBatch(5);
```

### Test Environment Management

```typescript
// Setup complete test environment
const testEnv = new TestEnvironment();
const app = await testEnv.setup();

// Cleanup
await testEnv.teardown();
```

## 📊 Test Configuration

### Jest Configuration (`test/jest-e2e.json`)

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "testTimeout": 30000
}
```

### Hardhat Configuration (`hardhat.config.ts`)

Configured for local testing with:
- Auto-mining enabled
- 20 test accounts with 10,000 ETH each
- Chain ID 1337
- Optimized compiler settings

## 🔧 Docker Environment

### Services

1. **postgres** - Test database on port 5433
2. **redis** - Test cache on port 6380
3. **hardhat** - Local blockchain node on port 8546
4. **gasguard-api** - Application service on port 3001

### Health Checks

All services include health checks to ensure proper startup:
- PostgreSQL: `pg_isready`
- Redis: `redis-cli ping`
- Hardhat: Process startup verification
- API: Health endpoint availability

## 🎯 Test Coverage

### Currently Covered

✅ Basic API endpoints
✅ Health monitoring
✅ Rate limiting
✅ Batch processing
✅ Error handling
✅ Performance under load

### Future Enhancements

🔄 Gasless transaction pipeline
🔄 Smart contract interaction
🔄 Queue worker processing
🔄 Database transaction testing
🔄 Cross-service integration

## 📈 Performance Metrics

Tests include performance validation:
- Response time measurements
- Throughput testing
- Concurrent request handling
- Memory usage monitoring
- Database query performance

## 🛡️ Best Practices

### Test Design

1. **Isolation** - Each test runs in isolation
2. **Cleanup** - Proper resource cleanup after tests
3. **Mocking** - Minimal external dependencies
4. **Realistic Data** - Use production-like test data
5. **Clear Assertions** - Specific, meaningful expectations

### Running in CI/CD

```yaml
# GitHub Actions example
- name: Run E2E Tests
  run: |
    cd apps/api-service
    npm run test:e2e
  env:
    CI: true
```

## 🚨 Troubleshooting

### Common Issues

1. **Port Conflicts** - Ensure test ports are available
2. **Database Connection** - Check PostgreSQL health
3. **Docker Resources** - Allocate sufficient memory/CPU
4. **Timeout Issues** - Adjust test timeouts as needed

### Debugging

```bash
# Enable verbose logging
DEBUG=express:* npm run test:e2e

# Run specific test file
npm run test:e2e -- test/e2e/simple-transaction.e2e-spec.ts

# Debug with inspector
npm run test:debug -- --testNamePattern="specific test"
```

## 📝 Contributing

### Adding New Tests

1. Create test file in `test/e2e/` directory
2. Follow existing naming convention
3. Use provided test helpers
4. Include proper cleanup
5. Add to test documentation

### Test Structure

```typescript
describe('Feature Name', () => {
  let app: INestApplication;
  
  beforeAll(async () => {
    // Setup
  });
  
  afterAll(async () => {
    // Cleanup
  });
  
  it('should handle specific scenario', async () => {
    // Test implementation
    // Assertions
  });
});
```

## 📊 Monitoring and Reporting

### Test Results

- Pass/Fail statistics
- Performance metrics
- Coverage reports
- Failure analysis

### Integration with Monitoring

Future enhancements will include:
- Integration with observability tools
- Performance trend analysis
- Automated alerting for test failures
- Historical performance tracking

## 🔄 CI/CD Integration

Tests are designed to run in continuous integration pipelines:
- Fast feedback on pull requests
- Automated deployment blocking
- Performance regression detection
- Test result reporting