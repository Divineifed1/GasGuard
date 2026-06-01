//! Detect Unsafe Randomness Patterns
//!
//! Flags use of blockhash or block.timestamp as a source of randomness,
//! which are predictable and manipulable by miners/validators.

use crate::rule_engine::{Rule, RuleViolation, ViolationSeverity};
use syn::Item;

pub struct UnsafeRandomnessRule;

impl Rule for UnsafeRandomnessRule {
    fn name(&self) -> &str {
        "unsafe-randomness"
    }

    fn description(&self) -> &str {
        "Detects use of blockhash or block.timestamp as randomness sources. \
         These values are predictable and can be manipulated."
    }

    fn check(&self, ast: &[Item]) -> Vec<RuleViolation> {
        let mut violations = Vec::new();
        for item in ast {
            if let Item::Fn(func) = item {
                let src = quote::quote!(#func).to_string();
                for pattern in &["blockhash", "block.timestamp", "block_timestamp"] {
                    if src.contains(pattern) {
                        violations.push(RuleViolation {
                            rule_name: self.name().to_string(),
                            description: format!(
                                "Use of `{}` as randomness source is unsafe.",
                                pattern
                            ),
                            severity: ViolationSeverity::High,
                            line_number: 0,
                            column_number: 0,
                            variable_name: pattern.to_string(),
                            suggestion: "Use a verifiable random function (VRF) or \
                                commit-reveal scheme instead."
                                .to_string(),
                        });
                    }
                }
            }
        }
        violations
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use syn::parse_file;

    fn check(code: &str) -> Vec<RuleViolation> {
        let ast = parse_file(code).expect("parse failed");
        UnsafeRandomnessRule.check(&ast.items)
    }

    #[test]
    fn flags_block_timestamp() {
        let code = r#"fn rand() -> u64 { let r = block_timestamp(); r }"#;
        assert!(!check(code).is_empty());
    }

    #[test]
    fn no_violation_for_safe_code() {
        let code = r#"fn safe() -> u64 { 42 }"#;
        assert!(check(code).is_empty());
    }
}