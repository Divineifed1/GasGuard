# Error Enum Standardization Implementation Plan

**Date**: June 1, 2026  
**Issue**: Detect Missing Error Enum Standardization  
**Status**: Planning Phase  
**Priority**: Medium (Maintainability & Debugging)

---

## Overview

This document provides a step-by-step implementation plan to standardize error enums and error classes across the GasGuard codebase, addressing 6 critical inconsistencies identified in the detection report.

---

## Phase 1: Create Unified Error Types Module (Non-Breaking)

### 1.1 Create New Error Module Structure

**File**: [src/common/errors/index.ts](src/common/errors/index.ts)

```
src/
  common/
    errors/
      index.ts              # Main export file
      base.error.ts         # Base error class
      validation.error.ts   # Validation-specific errors
      configuration.error.ts # Config-specific errors
      rpc.error.ts          # RPC-specific errors
      pipeline.error.ts     # Pipeline-specific errors
      types.ts              # Shared interfaces
```

### 1.2 Create Base Error Class

**File**: `src/common/errors/base.error.ts`

```typescript
/**
 * Base error class for all GasGuard errors
 * Provides standardized error structure with code, timestamp, and details
 */
export abstract class GasGuardError extends Error {
  abstract readonly code: string;
  readonly timestamp: Date = new Date();
  
  constructor(
    message: string,
    public readonly details?: Record<string, any>,
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Serialize error to JSON for logging/responses
   */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      name: this.name,
      timestamp: this.timestamp,
      details: this.details,
      stack: process.env.NODE_ENV !== 'production' ? this.stack : undefined,
    };
  }
}
```

### 1.3 Create Unified Validation Error Interface

**File**: `src/common/errors/types.ts`

```typescript
/**
 * Unified validation error detail format
 * Supports both config validation (path-based) and request validation (field-based)
 */
export interface ValidationErrorDetail {
  // Config validation (path-based)
  path?: string;           // Dot notation: "system.environment"
  
  // Request validation (field-based)
  field?: string;          // Form field: "email"
  
  // Common fields
  code: string;            // Machine-readable: "INVALID_EMAIL_FORMAT"
  message: string;         // Human-readable
  value?: any;             // The value that failed validation
  constraint?: string;     // The constraint that failed: "email_format"
  timestamp?: Date;        // When error occurred
}

/**
 * Validation warning detail (non-fatal issues)
 */
export interface ValidationWarningDetail {
  path?: string;
  field?: string;
  code: string;
  message: string;
  suggestion?: string;     // How to fix it
}

/**
 * Standard API error response format
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    timestamp: string;
    requestId?: string;
    details?: Record<string, any>;
  };
  validationErrors?: ValidationErrorDetail[];
  warnings?: ValidationWarningDetail[];
  stack?: string;          // Only in non-production
}
```

### 1.4 Create Validation Error Class

**File**: `src/common/errors/validation.error.ts`

```typescript
import { GasGuardError } from './base.error';
import { ValidationErrorDetail, ValidationWarningDetail } from './types';

export class ValidationError extends GasGuardError {
  readonly code = 'VALIDATION_ERROR';

  constructor(
    message: string,
    public readonly errors: ValidationErrorDetail[],
    public readonly warnings: ValidationWarningDetail[] = [],
    details?: Record<string, any>,
  ) {
    super(message, details);
  }

  /**
   * Create from config validation errors
   */
  static fromConfigValidation(
    errors: ValidationErrorDetail[],
    warnings: ValidationWarningDetail[] = [],
  ) {
    const message = `Config validation failed with ${errors.length} error(s)`;
    return new ValidationError(message, errors, warnings);
  }

  /**
   * Create from field validation errors
   */
  static fromFieldValidation(
    errors: ValidationErrorDetail[],
    warnings: ValidationWarningDetail[] = [],
  ) {
    const message = `Request validation failed with ${errors.length} error(s)`;
    return new ValidationError(message, errors, warnings);
  }

  /**
   * Get summary string for logging
   */
  getSummary(): string {
    return this.errors
      .map((e) => `  [${e.code}] ${e.path || e.field}: ${e.message}`)
      .join('\n');
  }
}
```

### 1.5 Create Configuration Error Class

**File**: `src/common/errors/configuration.error.ts`

```typescript
import { GasGuardError } from './base.error';

export class ConfigurationError extends GasGuardError {
  readonly code = 'CONFIGURATION_ERROR';

  constructor(
    message: string,
    public readonly filePath?: string,
    public readonly lineNumber?: number,
    details?: Record<string, any>,
  ) {
    super(message, details);
  }
}
```

### 1.6 Create RPC Error Class

**File**: `src/common/errors/rpc.error.ts`

```typescript
import { GasGuardError } from './base.error';

export class RpcError extends GasGuardError {
  readonly code = 'RPC_ERROR';

  constructor(
    message: string,
    public readonly rpcMethod?: string,
    public readonly chainId?: number,
    details?: Record<string, any>,
  ) {
    super(message, details);
  }
}
```

### 1.7 Create Pipeline Error Class

**File**: `src/common/errors/pipeline.error.ts`

```typescript
import { GasGuardError } from './base.error';

export class PipelineError extends GasGuardError {
  readonly code = 'PIPELINE_ERROR';

  constructor(
    message: string,
    public readonly ruleId?: string,
    public readonly stageId?: string,
    details?: Record<string, any>,
  ) {
    super(message, details);
  }
}
```

### 1.8 Create Main Export File

**File**: `src/common/errors/index.ts`

```typescript
export { GasGuardError } from './base.error';
export { ValidationError } from './validation.error';
export { ConfigurationError } from './configuration.error';
export { RpcError } from './rpc.error';
export { PipelineError } from './pipeline.error';
export type {
  ValidationErrorDetail,
  ValidationWarningDetail,
  ApiErrorResponse,
} from './types';
```

---

## Phase 2: Migrate Existing Error Definitions

### 2.1 Update [config/validator.ts](src/config/validator.ts)

**Change**: Replace custom `ValidationError` interface with unified type

```typescript
// OLD: Multiple exports
export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export class ConfigValidationError extends Error {
  constructor(
    public readonly errors: ValidationError[],
    public readonly warnings: ValidationWarning[],
  ) {
    // ...
  }
}

// NEW: Use unified types
import {
  ValidationError as GasGuardValidationError,
  ValidationErrorDetail,
  ValidationWarningDetail,
} from '../common/errors';

// Use ValidationErrorDetail for config validation
export type ConfigValidationError = ValidationErrorDetail;

// Use GasGuardValidationError for class
export { GasGuardValidationError };
```

### 2.2 Update [stellar/errors.ts](apps/api/src/validation/rpc/stellar/errors.ts)

**Change**: Extend new RpcError class instead of Error

```typescript
// OLD
export class RpcValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RpcValidationError";
  }
}

// NEW
import { RpcError } from '../../../common/errors';

export class RpcValidationError extends RpcError {
  constructor(
    message: string,
    rpcMethod?: string,
    chainId?: number,
    details?: Record<string, any>,
  ) {
    super(message, rpcMethod, chainId, details);
  }
}
```

### 2.3 Update [error.middleware.ts](apps/api/src/middleware/error.middleware.ts)

**Change**: Use unified error response format

```typescript
// OLD
export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

// NEW
import { GasGuardError, ApiErrorResponse } from '../common/errors';

export function errorHandler(
  error: Error | GasGuardError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = 
    error instanceof GasGuardError ? 
      getStatusCodeForError(error) : 
      500;

  const response: ApiErrorResponse = {
    error: {
      code: error instanceof GasGuardError ? error.code : 'INTERNAL_SERVER_ERROR',
      message: error.message,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] as string,
      details: error instanceof GasGuardError ? error.details : undefined,
    },
    ...(error instanceof ValidationError && {
      validationErrors: error.errors,
      warnings: error.warnings,
    }),
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
  };

  res.status(statusCode).json(response);
}
```

### 2.4 Update [base.validator.ts](apps/api/src/validation/base.validator.ts)

**Change**: Use unified ValidationErrorDetail interface

```typescript
// OLD
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  constraint: string;
}

// NEW
import { ValidationErrorDetail } from '../../../common/errors';

// No need to redefine - use the import
export type ValidationError = ValidationErrorDetail;
```

### 2.5 Update [analysis.schema.ts](apps/api/src/schemas/analysis.schema.ts)

**Change**: Import unified error types

```typescript
// OLD
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  constraint: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
  };
  validationErrors?: ValidationError[];
}

// NEW
import {
  ValidationErrorDetail,
  ApiErrorResponse as GasGuardApiErrorResponse,
} from '../../../common/errors';

// Re-export with type alias for compatibility
export type ValidationError = ValidationErrorDetail;
export type ApiErrorResponse = GasGuardApiErrorResponse;
```

---

## Phase 3: Standardize Rust Error Handling

### 3.1 Create Rust Error Module

**File**: `packages/rules/src/errors.rs`

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum GasGuardError {
    #[error("Validation error: {message}")]
    Validation {
        code: String,
        message: String,
    },

    #[error("Configuration error: {0}")]
    Configuration(String),

    #[error("RPC error: {0}")]
    Rpc(String),

    #[error("Pipeline error: {0}")]
    Pipeline(String),

    #[error("Parse error: {0}")]
    Parse(String),

    #[error(transparent)]
    Io(#[from] std::io::Error),
}

impl GasGuardError {
    pub fn code(&self) -> &str {
        match self {
            GasGuardError::Validation { code, .. } => code,
            GasGuardError::Configuration(_) => "CONFIGURATION_ERROR",
            GasGuardError::Rpc(_) => "RPC_ERROR",
            GasGuardError::Pipeline(_) => "PIPELINE_ERROR",
            GasGuardError::Parse(_) => "PARSE_ERROR",
            GasGuardError::Io(_) => "IO_ERROR",
        }
    }
}

pub type Result<T> = std::result::Result<T, GasGuardError>;
```

### 3.2 Update [soroban/mod.rs](packages/rules/src/soroban/mod.rs)

**Change**: Use unified GasGuardError

```rust
// OLD
#[derive(Debug, thiserror::Error)]
pub enum SorobanParseError {
    #[error("Failed to parse Soroban contract: {0}")]
    ParseError(String),
    // ...
}

// NEW
use crate::errors::{GasGuardError, Result};

// Replace SorobanParseError with GasGuardError
pub type SorobanResult<T> = Result<T>;

// Use in functions:
pub fn parse_contract(source: &str) -> SorobanResult<Contract> {
    // ...
    if !source.contains("contract") {
        return Err(GasGuardError::Parse(
            "Invalid contract structure".into()
        ));
    }
    Ok(contract)
}
```

### 3.3 Update [lib.rs](libs/rule-engine/src/lib.rs)

**Change**: Use thiserror + unified error enum

```rust
// OLD
#[derive(Debug, Clone)]
pub enum PipelineError {
    CircularDependency(Vec<String>),
    // ...
}

impl std::fmt::Display for PipelineError {
    // Manual implementation
}

// NEW
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PipelineError {
    #[error("Circular dependency detected: {}", .0.join(" -> "))]
    CircularDependency(Vec<String>),

    #[error("Missing dependency: {0}")]
    MissingDependency(String),

    #[error("Rule execution failed: {0}")]
    RuleExecutionFailed(String),
}

pub type PipelineResult<T> = std::result::Result<T, PipelineError>;
```

---

## Phase 4: Integration Testing

### 4.1 Create Error Standardization Tests

**File**: `tests/error-standardization.spec.ts`

```typescript
import {
  ValidationError,
  ConfigurationError,
  RpcError,
  PipelineError,
} from '../src/common/errors';

describe('Error Standardization', () => {
  describe('ValidationError', () => {
    it('should serialize to JSON with code and timestamp', () => {
      const error = new ValidationError(
        'Test error',
        [{ code: 'TEST', message: 'Test message' }]
      );
      const json = error.toJSON();
      expect(json.code).toBe('VALIDATION_ERROR');
      expect(json.timestamp).toBeDefined();
    });

    it('should support config validation factory', () => {
      const error = ValidationError.fromConfigValidation([
        {
          path: 'system.environment',
          code: 'INVALID_ENV',
          message: 'Invalid environment',
        },
      ]);
      expect(error.errors[0].path).toBe('system.environment');
    });

    it('should support field validation factory', () => {
      const error = ValidationError.fromFieldValidation([
        {
          field: 'email',
          code: 'INVALID_EMAIL',
          message: 'Invalid email format',
        },
      ]);
      expect(error.errors[0].field).toBe('email');
    });
  });

  describe('Error Response Format', () => {
    it('should match ApiErrorResponse interface', () => {
      const error = new ValidationError('Test', []);
      const response: ApiErrorResponse = {
        error: {
          code: error.code,
          message: error.message,
          timestamp: error.timestamp.toISOString(),
        },
      };
      expect(response.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
```

### 4.2 Add Backwards Compatibility Tests

```typescript
describe('Backwards Compatibility', () => {
  it('should accept old ValidationError format from config', () => {
    const oldFormat = {
      path: 'system.environment',
      code: 'INVALID_ENV',
      message: 'Invalid environment',
    };
    // Should work with new ValidationErrorDetail
    const error = new ValidationError('Test', [oldFormat]);
    expect(error.errors[0].path).toBe(oldFormat.path);
  });

  it('should accept old ValidationError format from fields', () => {
    const oldFormat = {
      field: 'email',
      constraint: 'email_format',
      message: 'Invalid email',
      code: 'INVALID_EMAIL',
    };
    // Should work with new ValidationErrorDetail
    const error = new ValidationError('Test', [oldFormat]);
    expect(error.errors[0].field).toBe(oldFormat.field);
  });
});
```

---

## Phase 5: Migration Checklist

### Preparation
- [ ] Create feature branch: `feat/errors-381-standardization`
- [ ] Run current tests to establish baseline
- [ ] Document current error behavior in each module

### Implementation
- [ ] Create `src/common/errors/` module (Phase 1)
- [ ] Update TypeScript error definitions (Phase 2)
- [ ] Update Rust error definitions (Phase 3)
- [ ] Add comprehensive tests (Phase 4)
- [ ] Update error middleware to use new types
- [ ] Update all validators to use new types

### Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Error middleware tests pass
- [ ] Backwards compatibility tests pass
- [ ] E2E tests pass

### Validation
- [ ] Code review
- [ ] Manual testing of error responses
- [ ] Verify error codes in logs
- [ ] Verify timestamps are present
- [ ] Test production error handling (no stack traces)

### Documentation
- [ ] Update ERROR_HANDLING.md with new patterns
- [ ] Add code examples for extending GasGuardError
- [ ] Document error code registry
- [ ] Update API documentation with error responses

### Deployment
- [ ] Merge to main
- [ ] Deploy to staging
- [ ] Deploy to production
- [ ] Monitor error logs for issues

---

## 🔍 Verification Checklist

After implementation, verify:

- [ ] All error classes extend GasGuardError
- [ ] All errors have a `code` property
- [ ] All errors have a `timestamp` property
- [ ] No duplicate ValidationError definitions
- [ ] All error responses use ApiErrorResponse format
- [ ] Rust errors use `thiserror` consistently
- [ ] Error middleware handles all GasGuardError types
- [ ] Tests cover all error scenarios
- [ ] Documentation is up to date

---

## 📋 Files Modified Summary

### Created
- `src/common/errors/index.ts`
- `src/common/errors/base.error.ts`
- `src/common/errors/validation.error.ts`
- `src/common/errors/configuration.error.ts`
- `src/common/errors/rpc.error.ts`
- `src/common/errors/pipeline.error.ts`
- `src/common/errors/types.ts`
- `tests/error-standardization.spec.ts`
- `packages/rules/src/errors.rs`

### Modified
- `src/config/validator.ts`
- `apps/api/src/validation/rpc/stellar/errors.ts`
- `apps/api/src/middleware/error.middleware.ts`
- `apps/api/src/validation/base.validator.ts`
- `apps/api/src/schemas/analysis.schema.ts`
- `packages/rules/src/soroban/mod.rs`
- `libs/rule-engine/src/lib.rs`

---

## 📊 Estimated Effort

| Phase | Task | Effort | Duration |
|-------|------|--------|----------|
| 1 | Create unified error module | 3 hrs | 1 day |
| 2 | Migrate TypeScript errors | 4 hrs | 2 days |
| 3 | Migrate Rust errors | 2 hrs | 1 day |
| 4 | Create tests | 3 hrs | 1 day |
| 5 | Code review & fixes | 2 hrs | 1 day |
| | **TOTAL** | **14 hrs** | **~1 week** |

---

**Status**: Ready for development  
**Next Step**: Start Phase 1 implementation
