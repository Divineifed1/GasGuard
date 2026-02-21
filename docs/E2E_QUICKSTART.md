# E2E Testing Quick Start Guide

## 🚀 5-Minute Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Test Services

```bash
# In one terminal, start the test environment
docker-compose -f apps/api-service/docker-compose.e2e.yml up -d

# Wait for services to be ready (30-60 seconds)
```

### 3. Run Tests

```bash
# Run all E2E tests
pnpm run test:e2e

# Or run from api-service directory
cd apps/api-service
pnpm run test:e2e
```

## 🎯 Quick Test Examples

### Run Specific Test Suites

```bash
# Test basic API functionality
pnpm run test:e2e --testNamePattern="Basic API"

# Test gasless transactions
pnpm run test:e2e --testNamePattern="Gasless Transaction"

# Test failure scenarios
pnpm run test:e2e --testNamePattern="Failure"
```

### Watch Mode for Development

```bash
# Run tests in watch mode
pnpm run test:e2e --watch

# Run only failed tests
pnpm run test:e2e --onlyFailures
```

## 🛠️ Common Tasks

### Reset Test Environment

```bash
# Stop all services
docker-compose -f apps/api-service/docker-compose.e2e.yml down -v

# Start fresh
docker-compose -f apps/api-service/docker-compose.e2e.yml up -d
```

### Check Service Status

```bash
# View running containers
docker-compose -f apps/api-service/docker-compose.e2e.yml ps

# View logs
docker-compose -f apps/api-service/docker-compose.e2e.yml logs api-service
```

### Debug Test Issues

```bash
# Run with verbose output
pnpm run test:e2e --verbose

# Enable debug logging
LOG_LEVEL=debug pnpm run test:e2e

# Run single test file
pnpm run test:e2e apps/api-service/test/e2e/basic-api.e2e-spec.ts
```

## 📋 Prerequisites Checklist

Before running E2E tests, ensure you have:

- [ ] Node.js 18+ installed
- [ ] Docker and Docker Compose installed
- [ ] pnpm package manager installed
- [ ] Dependencies installed (`pnpm install`)
- [ ] Test services running (`docker-compose up -d`)
- [ ] Environment variables configured

## 🆘 Quick Troubleshooting

### "Connection refused" errors

```bash
# Check if services are running
docker-compose -f apps/api-service/docker-compose.e2e.yml ps

# Restart services if needed
docker-compose -f apps/api-service/docker-compose.e2e.yml restart
```

### "Database connection failed"

```bash
# Check PostgreSQL logs
docker-compose -f apps/api-service/docker-compose.e2e.yml logs postgres

# Restart database
docker-compose -f apps/api-service/docker-compose.e2e.yml restart postgres
```

### Tests timing out

```bash
# Increase Jest timeout
pnpm run test:e2e --testTimeout=30000
```

## 📚 Next Steps

1. Read the full [E2E Testing Documentation](./E2E_TESTING.md)
2. Explore [test implementation examples](../apps/api-service/test/e2e/)
3. Review [CI/CD integration](../.github/workflows/ci.yml)
4. Check [test utilities](../apps/api-service/test/utils/)

---
*Need help? Check the full documentation or create an issue*