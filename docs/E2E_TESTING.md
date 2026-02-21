# End-to-End Integration Testing

## Overview

This document describes the End-to-End (E2E) testing framework for GasGuard, designed to validate complete gasless transaction workflows and ensure system reliability across all components.

## 🎯 Purpose

E2E tests simulate real-world scenarios to verify that:
- Gasless transaction flows work from initiation to completion
- All services (API, workers, blockchain) integrate correctly
- Failure scenarios are handled gracefully
- System behavior remains consistent across deployments

## 🏗️ Architecture

### Test Environment Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Test Runner   │◄──►│   API Service   │◄──►│   Blockchain    │
│   (Jest)        │    │   (NestJS)      │    │   (Hardhat)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │     Redis       │    │   Mock Services │
│   (Test DB)     │    │   (Queue)       │    │   (RPC/Relayer) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Components

1. **Test Framework**: Jest with Supertest for HTTP testing
2. **Blockchain**: Hardhat local network for contract interactions
3. **Database**: PostgreSQL with isolated test schemas
4. **Queue System**: Redis for BullMQ worker testing
5. **Mock Services**: Simulated RPC providers and relayers

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Docker (for containerized services)
- PostgreSQL client
- pnpm package manager

### Installation

```bash
# Install dependencies
pnpm install

# Install Hardhat globally (optional)
npm install -g hardhat
```

### Environment Setup

Create a `.env.test` file in `apps/api-service/`:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gasguard_test

# Redis
REDIS_URL=redis://localhost:6379

# Blockchain
RPC_URL=http://localhost:8545
CHAIN_ID=31337

# Testing
NODE_ENV=test
LOG_LEVEL=error
```

## 🧪 Running Tests

### Local Development

```bash
# Run all E2E tests
pnpm run test:e2e

# Run specific test suite
pnpm run test:e2e --testNamePattern="Basic API"

# Run with verbose output
pnpm run test:e2e --verbose

# Run in watch mode
pnpm run test:e2e --watch
```

### Docker Environment

```bash
# Start test environment
docker-compose -f docker-compose.e2e.yml up -d

# Run tests
pnpm run test:e2e

# Clean up
docker-compose -f docker-compose.e2e.yml down
```

### CI/CD Pipeline

Tests automatically run in GitHub Actions on:
- Pull requests to `main` and `develop` branches
- Push events to `main` and `develop` branches

## 📁 Test Structure

```
apps/api-service/test/
├── e2e/                    # E2E test suites
│   ├── basic-api.e2e-spec.ts
│   ├── gasless-transaction.e2e-spec.ts
│   ├── failure-scenarios.e2e-spec.ts
│   └── contract-interaction.e2e-spec.ts
├── utils/                  # Test utilities
│   ├── test-helpers.ts
│   ├── mock-data.ts
│   └── blockchain-setup.ts
└── fixtures/               # Test data fixtures
    ├── contracts/
    └── transactions/
```

## 🔧 Test Implementation

### Basic Test Structure

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Gasless Transaction E2E', () => {
  let app: INestApplication;
  let testHelpers: TestHelpers;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    
    testHelpers = new TestHelpers();
    await testHelpers.setupTestEnvironment();
  });

  afterAll(async () => {
    await testHelpers.cleanup();
    await app.close();
  });

  it('should complete gasless transaction successfully', async () => {
    // Arrange
    const transactionData = testHelpers.createTransactionRequest();
    
    // Act
    const response = await request(app.getHttpServer())
      .post('/transactions/gasless')
      .send(transactionData)
      .expect(201);

    // Assert
    expect(response.body).toHaveProperty('transactionHash');
    expect(response.body.status).toBe('pending');
  });
});
```

### Test Helpers

Key utilities available in `test/utils/test-helpers.ts`:

- `createTransactionRequest()` - Generate mock transaction data
- `setupTestDatabase()` - Initialize test database schema
- `resetDatabase()` - Clean database between tests
- `deployTestContract()` - Deploy contracts to local blockchain
- `waitForTransaction()` - Wait for blockchain confirmations
- `mockRpcProvider()` - Mock external RPC calls

## 🎯 Test Scenarios

### 1. Basic API Tests
- Health check endpoints
- Rule validation APIs
- Scanner functionality
- Error handling

### 2. Gasless Transaction Flow
- Transaction creation via API
- Queue processing and worker execution
- Signature generation and verification
- Relayer submission
- Transaction confirmation monitoring

### 3. Failure Scenarios
- RPC provider timeouts
- Insufficient gas errors
- Signature expiration
- Contract revert scenarios
- Network connectivity issues

### 4. Contract Interactions
- Smart contract deployment
- Method calls and state changes
- Event emission and listening
- Gas estimation accuracy

## 📊 Test Data Management

### Database Reset Strategy

```typescript
beforeEach(async () => {
  await testHelpers.resetDatabase();
  await testHelpers.seedTestData();
});
```

### Mock Data Generation

```typescript
const mockTransaction = {
  merchantId: 'test-merchant-123',
  to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  value: '1000000000000000000', // 1 ETH
  data: '0x',
  chainId: 1,
  gasLimit: '21000'
};
```

## 🔍 Debugging Tests

### Verbose Logging

```bash
# Enable debug logs
LOG_LEVEL=debug pnpm run test:e2e

# Show database queries
DEBUG=typeorm:* pnpm run test:e2e
```

### Test Isolation

Each test runs in isolation with:
- Fresh database connection
- Clean blockchain state
- Reset mock services
- Isolated Redis instance

## 📈 Performance Considerations

### Test Optimization

1. **Parallel Execution**: Tests run in parallel where possible
2. **Database Pooling**: Connection pooling for faster database operations
3. **Blockchain Snapshots**: Use Hardhat snapshots to reset state quickly
4. **Caching**: Cache expensive setup operations

### Resource Management

```typescript
// Efficient cleanup pattern
afterEach(async () => {
  await Promise.all([
    testHelpers.resetDatabase(),
    testHelpers.resetBlockchain(),
    testHelpers.clearRedis()
  ]);
});
```

## 🛡️ Security Testing

E2E tests include security validation:
- Authentication and authorization
- Input validation and sanitization
- Rate limiting effectiveness
- Signature verification
- Access control enforcement

## 🔄 CI/CD Integration

### GitHub Actions Workflow

The E2E tests run automatically in CI with:
- Service containers (PostgreSQL, Redis)
- Environment variable configuration
- Test result reporting
- Artifact storage for failed tests

### Quality Gates

Tests must pass before:
- Pull request merge
- Deployment to staging
- Production release

## 📋 Best Practices

### Test Design

1. **Clear Test Names**: Use descriptive test names that explain the scenario
2. **AAA Pattern**: Arrange-Act-Assert structure
3. **Isolation**: Each test should be independent
4. **Realistic Data**: Use production-like test data
5. **Comprehensive Coverage**: Test both happy paths and edge cases

### Maintenance

1. **Regular Updates**: Keep tests updated with code changes
2. **Performance Monitoring**: Track test execution times
3. **Flake Detection**: Identify and fix flaky tests
4. **Documentation**: Keep this documentation current

## 🆘 Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Ensure PostgreSQL is running
docker-compose -f docker-compose.e2e.yml up -d postgres
```

**Blockchain Not Responding**
```bash
# Restart Hardhat node
npx hardhat node --port 8545
```

**Tests Timeout**
```bash
# Increase timeout
jest.setTimeout(30000);
```

**Permission Errors**
```bash
# Fix file permissions
chmod 755 apps/api-service/test/
```

### Debug Commands

```bash
# Run single test file
pnpm run test:e2e apps/api-service/test/e2e/basic-api.e2e-spec.ts

# Run with debug output
DEBUG=* pnpm run test:e2e

# Check service status
docker-compose -f docker-compose.e2e.yml ps
```

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Hardhat Testing Guide](https://hardhat.org/tutorial/testing-contracts)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)

## 📞 Support

For issues with E2E tests, please:
1. Check the troubleshooting section above
2. Review recent CI build logs
3. Create an issue with detailed reproduction steps
4. Include relevant test output and logs

---
*Last updated: February 2026*