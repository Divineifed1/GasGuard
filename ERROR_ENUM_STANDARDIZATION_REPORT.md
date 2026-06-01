# Error Enum Standardization Detection Report

**Date**: June 1, 2026  
**Status**: ⚠️ **INCONSISTENCIES DETECTED**  
**Scope**: `rules/stellar/errors/` & Cross-module error definitions

---

## Executive Summary

Detected **6 major inconsistencies** in error enum and error class definitions across TypeScript and Rust code. Multiple incompatible `ValidationError` definitions and inconsistent error class patterns reduce maintainability and debugging quality.

**Impact**: 
- Duplicate type definitions causing potential type conflicts
- Inconsistent error handling patterns across modules
- Reduced API contract clarity

---

## 🔴 Critical Inconsistencies

### 1. ValidationError Interface Fragmentation

**Problem**: Three incompatible definitions of `ValidationError` interface exist in separate modules.

#### Definition A: Config-Based (Path-Oriented)
**File**: [src/config/validator.ts](src/config/validator.ts#L25)
```typescript
export interface ValidationError {
  path: string;        // Dot notation: "system.environment"
  message: string;
  code: string;        // Machine-readable code
}
```
**Usage**: Config file validation, JSON path-based errors  
**Modules Importing**: `config/validator.ts`

---

#### Definition B: Field-Based (Request-Oriented)
**File**: [apps/api/src/validation/base.validator.ts](apps/api/src/validation/base.validator.ts#L3)
```typescript
export interface ValidationError {
  field: string;       // Form field name
  message: string;
  value?: any;         // Actual value that failed
  constraint: string;  // Constraint name (e.g., "max_length")
}
```
**Usage**: HTTP request validation  
**Modules Importing**: Analysis validator, Schema definitions

---

#### Definition C: Duplicate of B
**File**: [apps/api/src/schemas/analysis.schema.ts](apps/api/src/schemas/analysis.schema.ts#L153)
```typescript
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  constraint: string;
}
```
**Status**: ⚠️ **Duplicate** of Definition B  
**Problem**: Redundant definition increases confusion

---

### 2. Custom Error Classes - Inconsistent Patterns

**Problem**: Three different patterns for custom error classes

| Pattern | File | Class | Implementation | Issues |
|---------|------|-------|-----------------|--------|
| **Constructor-Only** | [stellar/errors.ts](apps/api/src/validation/rpc/stellar/errors.ts) | `RpcValidationError` | Minimal, only name | No structured error data |
| **Rich Constructor** | [config/validator.ts](src/config/validator.ts#L100) | `ConfigValidationError` | Errors array + summary message | Good but unique pattern |
| **Interface** | [error.middleware.ts](apps/api/src/middleware/error.middleware.ts#L4) | `CustomError` | Optional statusCode, code, details | Not a class - interface only |

#### RpcValidationError (Minimal)
[apps/api/src/validation/rpc/stellar/errors.ts](apps/api/src/validation/rpc/stellar/errors.ts)
```typescript
export class RpcValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RpcValidationError";
  }
}
// ❌ Cannot access structured error info, no code, no timestamp
```

#### ConfigValidationError (Rich)
[src/config/validator.ts](src/config/validator.ts#L100)
```typescript
export class ConfigValidationError extends Error {
  constructor(
    public readonly errors: ValidationError[],
    public readonly warnings: ValidationWarning[],
  ) {
    const summary = errors.map((e) => `  [${e.code}] ${e.path}: ${e.message}`).join('\n');
    super(`Config validation failed with ${errors.length} error(s):\n${summary}`);
    this.name = 'ConfigValidationError';
  }
}
// ✅ Rich error data, but unique pattern
```

#### CustomError (Interface)
[apps/api/src/middleware/error.middleware.ts](apps/api/src/middleware/error.middleware.ts#L4)
```typescript
export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}
// ❌ Interface (not class) - cannot enforce constructor
```

---

### 3. Error Response Envelope Inconsistencies

**Problem**: Two slightly different response structures in different schemas

#### Format A: Base Error Response
[apps/api/src/middleware/error.middleware.ts](apps/api/src/middleware/error.middleware.ts#L24)
```typescript
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
  };
}
```

#### Format B: Extended with Validation Errors
[apps/api/src/schemas/analysis.schema.ts](apps/api/src/schemas/analysis.schema.ts#L160)
```typescript
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
  };
  validationErrors?: ValidationError[];  // Different structure
}
```

**Problem**: Same interface name, different shapes → Type confusion at runtime

---

### 4. Rust Error Enum Inconsistencies

#### SorobanParseError (Using thiserror)
[packages/rules/src/soroban/mod.rs](packages/rules/src/soroban/mod.rs#L115)
```rust
#[derive(Debug, thiserror::Error)]
pub enum SorobanParseError {
    #[error("Failed to parse Soroban contract: {0}")]
    ParseError(String),
    
    #[error("Missing required Soroban macro: {0}")]
    MissingMacro(String),
    
    #[error("Invalid contract structure: {0}")]
    InvalidStructure(String),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}
```
**Pattern**: `thiserror::Error` with descriptive variants  
**Strength**: Automatic Display implementation

---

#### PipelineError (Manual Implementation)
[libs/rule-engine/src/lib.rs](libs/rule-engine/src/lib.rs#L39)
```rust
#[derive(Debug, Clone)]
pub enum PipelineError {
    CircularDependency(Vec<String>),
    MissingDependency(String),
    RuleExecutionFailed(String),
}

impl std::fmt::Display for PipelineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PipelineError::CircularDependency(cycle) => {
                write!(f, "Circular dependency detected: {}", cycle.join(" -> "))
            }
            // ...
        }
    }
}
```
**Pattern**: Manual Display + Clone trait  
**Problem**: More boilerplate, inconsistent with SorobanParseError

---

## 📊 Inconsistency Matrix

```
Module                          | ValidationError | Error Class      | Response Format
--------------------------------|-----------------|-----------------|-----------------
config/validator.ts             | ✅ V1 (path)    | ConfigError     | Custom
api/validation/base.validator   | ❌ V2 (field)   | None (interface)| None
api/schemas/analysis.schema     | ❌ V2 (field)   | AnalysisError   | V1 + extras
api/middleware/error.middleware | ❌ None         | CustomError     | V1
api/validation/rpc/stellar      | ❌ None         | RpcError        | None
```

---

## ✅ Standardization Checklist

### Phase 1: Create Unified Error Types Module

- [ ] Create `src/common/errors/` directory structure
- [ ] Define canonical `ValidationError` interface (unified)
- [ ] Define base `GasGuardError` class
- [ ] Define specialized error classes (extends GasGuardError):
  - `ValidationError`
  - `ConfigurationError`
  - `RpcError`
  - `PipelineError`
  - `AnalysisError`

### Phase 2: Standardize TypeScript

- [ ] Create [src/common/errors/index.ts](src/common/errors/index.ts)
- [ ] Update [src/config/validator.ts](src/config/validator.ts) to use unified types
- [ ] Update [apps/api/src/validation/rpc/stellar/errors.ts](apps/api/src/validation/rpc/stellar/errors.ts)
- [ ] Update [apps/api/src/middleware/error.middleware.ts](apps/api/src/middleware/error.middleware.ts)
- [ ] Update [apps/api/src/validation/base.validator.ts](apps/api/src/validation/base.validator.ts)
- [ ] Update [apps/api/src/schemas/analysis.schema.ts](apps/api/src/schemas/analysis.schema.ts)

### Phase 3: Standardize Rust

- [ ] Update [packages/rules/src/soroban/mod.rs](packages/rules/src/soroban/mod.rs) to use `thiserror`
- [ ] Update [libs/rule-engine/src/lib.rs](libs/rule-engine/src/lib.rs) to use `thiserror`
- [ ] Define common error module in Rust (packages/rules/src/errors/)

### Phase 4: Update Consumers

- [ ] Audit all imports of ValidationError
- [ ] Audit all error class catches/throws
- [ ] Update error handling in middleware
- [ ] Update error handling in validators
- [ ] Add integration tests for error standardization

---

## 🎯 Standardization Goals

### TypeScript Standard

```typescript
// Base error class
export abstract class GasGuardError extends Error {
  abstract readonly code: string;
  readonly timestamp: Date = new Date();
  readonly details?: Record<string, any>;

  constructor(
    message: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// Unified validation error
export interface ValidationErrorDetail {
  path?: string;        // For config errors (dot notation)
  field?: string;       // For request errors
  code: string;         // Machine-readable error code
  message: string;      // Human-readable message
  value?: any;          // Actual value that failed validation
  constraint?: string;  // Constraint that failed
}

// Specialized error classes
export class ValidationError extends GasGuardError {
  code = 'VALIDATION_ERROR';
  constructor(
    message: string,
    public errors: ValidationErrorDetail[],
    details?: Record<string, any>
  ) {
    super(message, details);
  }
}
```

### Rust Standard

```rust
// Standard error enum with thiserror
#[derive(Debug, thiserror::Error)]
pub enum GasGuardError {
    #[error("Validation failed: {message}")]
    Validation {
        message: String,
        code: String,
        #[source]
        source: Option<Box<dyn std::error::Error>>,
    },
    
    #[error("Configuration error: {0}")]
    Configuration(String),
    
    #[error("RPC error: {0}")]
    Rpc(String),
    
    #[error(transparent)]
    Io(#[from] std::io::Error),
}
```

---

## 📈 Expected Benefits

| Metric | Before | After |
|--------|--------|-------|
| **Error Type Definitions** | 6 conflicting | 1 unified |
| **Error Class Patterns** | 4 different | 1 standard |
| **Response Formats** | 2 variants | 1 canonical |
| **Maintainability** | Low | High |
| **Type Safety** | Medium | High |
| **Debugging Speed** | Slow | Fast |

---

## 🔗 References

- [Error Handling Best Practices](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)
- [Rust Error Handling](https://doc.rust-lang.org/book/ch09-00-error-handling.html)
- [thiserror Crate Docs](https://docs.rs/thiserror/latest/thiserror/)

---

**Report Generated**: 2026-06-01  
**Status**: Ready for implementation
