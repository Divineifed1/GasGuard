pub mod rule_engine;
pub mod unused_state_variables;
pub mod vyper;
pub mod soroban;

// Explicitly export core types to avoid ambiguity
pub use rule_engine::{Rule, RuleEngine, RuleViolation, ViolationSeverity, extract_struct_fields, find_variable_usage};
pub use unused_state_variables::UnusedStateVariablesRule;

// Export Soroban types specifically
pub use soroban::{
    SorobanAnalyzer, 
    SorobanContract, 
    SorobanParser, 
    SorobanResult, 
    SorobanRuleEngine,
    SorobanStruct,
    SorobanImpl,
    SorobanFunction,
    SorobanField,
    SorobanParam
};

// Export Vyper types (keeping glob here is fine if Vyper module is clean, but let's be safe)
pub use vyper::*;