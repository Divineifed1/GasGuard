# GasGuard: Automated Optimization Suite

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Ecosystem: Stellar](https://img.shields.io/badge/Ecosystem-Stellar/Soroban-purple.svg)](https://stellar.org)

**GasGuard** is an open-source static analysis tool built to secure and optimize the Stellar ecosystem (Soroban), with extended support for Ethereum and Layer 2 networks. By identifying inefficient storage patterns and redundant operations during development, GasGuard enables developers to ship leaner code, reducing end-user transaction costs by an estimated **15-30%**.

---

### 1. Executive Summary
In the high-stakes world of smart contracts, inefficient code is more than a nuisance—it's an expense. GasGuard analyzes codebases to find "gas-heavy" patterns before they reach the mainnet. Specifically optimized for **Soroban's resource limits**, it ensures that Stellar developers can maximize their contract's efficiency and reach.

### 2. The Problem
As Web3 scales, transaction costs remain a significant barrier to entry.
* **Legacy Patterns:** Many developers use outdated coding patterns that result in "bloated" contracts.
* **Tooling Gap:** Existing tools are often too complex for junior developers or lack native support for modern environments like **Soroban** or **Optimism**.
* **Resource Exhaustion:** On Stellar, exceeding CPU or Ledger limits can cause contract failure; developers need early-warning systems to prevent this.

### 3. Key Features
* **🔍 Static Analysis:** Scans code for common gas-heavy patterns (e.g., inefficient loops, unoptimized storage slots).
* **💡 Auto-Refactor Suggestions:** Provides "Copy-Paste" ready code snippets to replace inefficient logic instantly.
* **🤖 CI/CD Integration:** A dedicated GitHub Action that runs on every push, ensuring no "gas regressions" are introduced.
* **📚 Educational Tooltips:** Every suggestion includes a link to documentation explaining *why* the change saves money, fostering developer growth.

### 4. Roadmap for this Wave
* **Phase 1:** Complete the Core CLI tool for local developer use (Rust/Soroban focus).
* **Phase 2:** Launch the GitHub Action Marketplace integration for automated PR reviews.
* **Phase 3:** Establish a "Community Ruleset" allowing users to contribute new optimization patterns via Pull Requests.

### 5. Why GasGuard belongs in Drips Wave
* **Public Good:** The core engine is 100% free and MIT-licensed to benefit the entire developer community.
* **Scalability:** The modular design allows us to add support for 3 new languages (Rust, Vyper, Move) over the next 6 months.
* **Sustainability:** We use Drips to "pass through" 15% of our funding to the foundational security libraries (like Slither or Cargo-Audit) that power our engine.

---

## 🛠 Project Structure (Monorepo)

```text
GasGuard/
├── apps/
│   ├── api/               # Nest.js backend handling remote scan requests
│   └── api-service/       # Enhanced API service with database and E2E testing
├── libs/
│   └── engine/            # Core logic for parsing Rust, Solidity, and Vyper
├── packages/
│   └── rules/             # Library of optimization rules and logic
├── .gitignore             # Optimized for Node.js and Rust
└── LICENSE                # MIT Licensed
```

---

## 🛡️ Rate Limiting

The public API includes IP-based rate limiting to protect against abuse and ensure fair usage.

| Setting | Value | Description |
|---------|-------|-------------|
| **Limit** | 10 requests | Maximum requests per IP address |
| **Window** | 60 seconds | Time window for rate limit |
| **Response** | HTTP 429 | Returned when limit is exceeded |

Rate limiting is implemented using [`@nestjs/throttler`](https://docs.nestjs.com/security/rate-limiting) and applies globally to all public API endpoints.

### Running the API

```bash
cd apps/api
npm install
npm run start
```

The API will be available at `http://localhost:3000`.

## 🔌 API Versioning

The GasGuard API uses **NestJS built-in versioning** with URI-based versioning strategy. All endpoints require a version prefix.

### Versioning Strategy

- **Type:** URI-based versioning
- **Current Version:** `v1`
- **Format:** All endpoints must include `/v1/` prefix
- **Unversioned Requests:** Return `404 Not Found`

### Example Endpoints

```bash
# ✅ Correct - Versioned endpoint
GET /v1/example

# ❌ Incorrect - Unversioned (returns 404)
GET /example
```

### Adding New Controllers

When creating new controllers, always include the `@Version('1')` decorator:

```typescript
import { Controller, Get, Version } from '@nestjs/common';

@Controller('users')
@Version('1')
export class UsersController {
  @Get()
  findAll() {
    // Accessible at GET /v1/users
  }
}
```

### Configuration

Versioning is configured in `apps/api/src/main.ts`:

```typescript
app.enableVersioning({
  type: VersioningType.URI,
  // No defaultVersion - unversioned requests return 404
});
```

This ensures all API consumers explicitly specify the version, making the API future-proof for version migrations.

## 🧪 End-to-End Testing

GasGuard includes comprehensive end-to-end testing to ensure reliable gasless transaction flows across all services.

### E2E Test Framework

- **Framework:** Jest with Supertest for API testing
- **Blockchain:** Hardhat local network for contract interactions
- **Services:** Dockerized PostgreSQL, Redis, and mock RPC providers
- **Coverage:** Full gasless transaction workflows and failure scenarios

### Running E2E Tests

```bash
# Install dependencies
pnpm install

# Start test environment
docker-compose -f apps/api-service/docker-compose.e2e.yml up -d

# Run E2E tests
cd apps/api-service
pnpm run test:e2e

# Or run from root
pnpm run test:e2e
```

### Test Structure

```
apps/api-service/test/
├── e2e/                    # E2E test suites
│   ├── basic-api.e2e-spec.ts
│   ├── gasless-transaction.e2e-spec.ts
│   ├── failure-scenarios.e2e-spec.ts
│   └── contract-interaction.e2e-spec.ts
├── utils/                  # Test utilities
│   ├── test-helpers.ts
│   └── blockchain-setup.ts
└── fixtures/               # Test data fixtures
```

For detailed information, see:
- [E2E Testing Documentation](./docs/E2E_TESTING.md)
- [E2E Quick Start Guide](./docs/E2E_QUICKSTART.md)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- pnpm package manager
- Rust toolchain (for core engine)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/GasGuard.git
cd GasGuard

# Install dependencies
pnpm install

# Run tests
pnpm run test

# Start the API
cd apps/api
npm run start:dev
```

## 🤝 Contributing

We welcome contributions! Please see our [contributing guidelines](CONTRIBUTING.md) for more details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.