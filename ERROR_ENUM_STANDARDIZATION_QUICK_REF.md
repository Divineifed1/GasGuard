# Error Enum Standardization - Quick Reference

**Status**: ✅ Detection Complete | Ready for Implementation  
**Issue**: #381 - Detect Missing Error Enum Standardization  
**Branch**: feat/issues381

---

## 📌 Quick Summary

**Problem**: 6 major inconsistencies in error definitions  
**Files Affected**: 7+ TypeScript and Rust files  
**Solution**: Create unified error module with standard base class  
**Effort**: ~14 hours  
**Priority**: Medium (Maintainability)

---

## 🔴 The 4 Key Issues

### 1️⃣ Three ValidationError Definitions
- **Variant A** ([src/config/validator.ts](src/config/validator.ts#L25)): `{ path, message, code }`
- **Variant B** ([apps/api/src/validation/base.validator.ts](apps/api/src/validation/base.validator.ts#L3)): `{ field, message, value, constraint }`
- **Variant C** ([apps/api/src/schemas/analysis.schema.ts](apps/api/src/schemas/analysis.schema.ts#L153)): Duplicate of B

**Fix**: Merge into single `ValidationErrorDetail` interface supporting both formats

---

### 2️⃣ Four Error Class Patterns
| Class | Pattern | Problem |
|-------|---------|---------|
| `RpcValidationError` | Constructor-only | No code/details |
| `ConfigValidationError` | Rich constructor | Unique pattern |
| `CustomError` | Interface | Not a class |
| Missing | Response-only | No class |

**Fix**: Base class `GasGuardError extends Error` with `code` and `timestamp` properties

---

### 3️⃣ Two Error Response Formats
- **Format A**: `{ error: { code, message, details, timestamp, requestId } }`
- **Format B**: Same + `validationErrors?: ValidationError[]`

**Fix**: Single `ApiErrorResponse` interface with optional arrays

---

### 4️⃣ Rust Error Pattern Inconsistency
- **Good**: `SorobanParseError` uses `thiserror::Error`
- **Bad**: `PipelineError` uses manual Display impl

**Fix**: All Rust enums use `#[derive(Debug, thiserror::Error)]`

---

## 📚 Documentation Files

### Main Reports
1. **[ERROR_ENUM_STANDARDIZATION_REPORT.md](ERROR_ENUM_STANDARDIZATION_REPORT.md)**
   - Detailed analysis of all inconsistencies
   - Code examples and comparisons
   - File-by-file breakdown

2. **[ERROR_ENUM_STANDARDIZATION_IMPLEMENTATION_PLAN.md](ERROR_ENUM_STANDARDIZATION_IMPLEMENTATION_PLAN.md)**
   - 5-phase implementation roadmap
   - Code templates for each error class
   - Testing strategy
   - Migration checklist

3. **[ERROR_ENUM_STANDARDIZATION_SUMMARY.md](ERROR_ENUM_STANDARDIZATION_SUMMARY.md)**
   - Executive summary
   - Impact analysis
   - Benefits overview

4. **This Document**: Quick reference guide

---

## 🎯 Implementation Phases

### Phase 1: Create Unified Error Module (Non-breaking)
```
src/common/errors/
├── base.error.ts         # GasGuardError abstract class
├── validation.error.ts   # ValidationError extends GasGuardError
├── configuration.error.ts
├── rpc.error.ts
├── pipeline.error.ts
└── types.ts              # Shared interfaces
```

### Phase 2: Migrate TypeScript
Update these files to import from new module:
- [src/config/validator.ts](src/config/validator.ts)
- [apps/api/src/validation/rpc/stellar/errors.ts](apps/api/src/validation/rpc/stellar/errors.ts)
- [apps/api/src/middleware/error.middleware.ts](apps/api/src/middleware/error.middleware.ts)
- [apps/api/src/validation/base.validator.ts](apps/api/src/validation/base.validator.ts)
- [apps/api/src/schemas/analysis.schema.ts](apps/api/src/schemas/analysis.schema.ts)

### Phase 3: Migrate Rust
Update Rust error enums:
- [packages/rules/src/soroban/mod.rs](packages/rules/src/soroban/mod.rs)
- [libs/rule-engine/src/lib.rs](libs/rule-engine/src/lib.rs)

### Phase 4: Testing
Add comprehensive tests for error standardization

### Phase 5: Migration Validation
- Code review
- Testing
- Deployment

---

## ✨ Unified Error Structure (Target)

### Base Class
```typescript
abstract class GasGuardError extends Error {
  abstract code: string;
  timestamp: Date = new Date();
  details?: Record<string, any>;
  toJSON(): object;
}
```

### ValidationErrorDetail Interface
```typescript
interface ValidationErrorDetail {
  // Config validation
  path?: string;        // "system.environment"
  
  // Request validation
  field?: string;       // "email"
  
  // Common
  code: string;         // "INVALID_EMAIL"
  message: string;      // "Invalid email format"
  value?: any;          // The bad value
  constraint?: string;  // "email_format"
}
```

### Standard Response
```typescript
interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    timestamp: string;
    requestId?: string;
    details?: Record<string, any>;
  };
  validationErrors?: ValidationErrorDetail[];
  warnings?: ValidationWarningDetail[];
  stack?: string;  // Non-production only
}
```

---

## 🔗 File Cross-References

### Files with Inconsistencies

| File | Issue | Type | Severity |
|------|-------|------|----------|
| [src/config/validator.ts](src/config/validator.ts) | ConfigValidationError class | Class Pattern | Medium |
| [apps/api/src/validation/rpc/stellar/errors.ts](apps/api/src/validation/rpc/stellar/errors.ts) | RpcValidationError class | Class Pattern | Medium |
| [apps/api/src/middleware/error.middleware.ts](apps/api/src/middleware/error.middleware.ts) | CustomError interface | Interface | Low |
| [apps/api/src/validation/base.validator.ts](apps/api/src/validation/base.validator.ts) | ValidationError interface | Duplicate (Variant B) | High |
| [apps/api/src/schemas/analysis.schema.ts](apps/api/src/schemas/analysis.schema.ts) | ValidationError interface | Duplicate (Variant C) | High |
| [packages/rules/src/soroban/mod.rs](packages/rules/src/soroban/mod.rs) | SorobanParseError enum | Rust Pattern | Low |
| [libs/rule-engine/src/lib.rs](libs/rule-engine/src/lib.rs) | PipelineError enum | Rust Pattern | Low |

---

## 📊 Stats

- **Total Inconsistencies Found**: 6
- **Files Requiring Changes**: 7+
- **New Files to Create**: 6
- **Estimated Implementation Time**: 14 hours
- **Risk Level**: Low (additive changes)
- **Type Safety Improvement**: Medium → High

---

## ✅ Checklist for Review

### Before Starting Implementation
- [ ] Review [ERROR_ENUM_STANDARDIZATION_REPORT.md](ERROR_ENUM_STANDARDIZATION_REPORT.md)
- [ ] Review [ERROR_ENUM_STANDARDIZATION_IMPLEMENTATION_PLAN.md](ERROR_ENUM_STANDARDIZATION_IMPLEMENTATION_PLAN.md)
- [ ] Verify all file references are correct
- [ ] Confirm effort estimate (14 hours)
- [ ] Assign implementation owner

### During Implementation
- [ ] Create Phase 1: Error module
- [ ] Create Phase 2: TypeScript migrations
- [ ] Create Phase 3: Rust migrations
- [ ] Create Phase 4: Tests
- [ ] Code review checkpoints

### After Implementation
- [ ] All tests pass
- [ ] No breaking changes
- [ ] Documentation updated
- [ ] Error codes in logs verified
- [ ] Monitor production for issues

---

## 🚀 Getting Started

### Step 1: Understand the Problem
Read: [ERROR_ENUM_STANDARDIZATION_REPORT.md](ERROR_ENUM_STANDARDIZATION_REPORT.md#-critical-inconsistencies)

### Step 2: Review the Solution
Read: [ERROR_ENUM_STANDARDIZATION_IMPLEMENTATION_PLAN.md](ERROR_ENUM_STANDARDIZATION_IMPLEMENTATION_PLAN.md#phase-1-create-unified-error-types-module-non-breaking)

### Step 3: Create Feature Branch
```bash
git checkout -b feat/errors-381-standardization
```

### Step 4: Implement Phase 1
Create the new error module as detailed in the implementation plan

### Step 5: Test and Deploy
Run tests, code review, merge, and deploy

---

## 📞 Key Contacts

- **Issue**: #381
- **Branch**: feat/issues381
- **Status**: Ready for development
- **Reports Location**: Root of GasGuard directory

---

**Last Updated**: June 1, 2026  
**Status**: ✅ Detection Complete
