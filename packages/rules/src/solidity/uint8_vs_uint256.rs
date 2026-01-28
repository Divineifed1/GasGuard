use crate::rule_engine::{Rule, RuleResult};
use crate::solidity::parser::SolidityASTNode;

pub struct Uint8VsUint256Rule;

impl Rule for Uint8VsUint256Rule {
    fn id(&self) -> &'static str {
        "uint8-vs-uint256"
    }

    fn description(&self) -> &'static str {
        "Using uint8 outside structs is often more gas-expensive than uint256 on EVM chains."
    }

    fn analyze(&self, ast: &SolidityASTNode) -> Vec<RuleResult> {
        let mut results = Vec::new();

        ast.walk(|node, parent| {
            // Match variable declarations
            if let SolidityASTNode::VariableDeclaration { type_name, location } = node {
                // Only uint8
                if type_name == "uint8" {
                    // Ignore struct members
                    if matches!(parent, Some(SolidityASTNode::StructDefinition { .. })) {
                        return;
                    }

                    results.push(RuleResult {
                        rule_id: self.id(),
                        message: "uint8 used outside a struct. Consider using uint256 for better gas efficiency.".to_string(),
                        location: location.clone(),
                        severity: "LOW",
                    });
                }
            }
        });

        results
    }
}
