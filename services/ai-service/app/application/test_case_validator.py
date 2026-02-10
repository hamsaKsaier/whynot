from typing import List, Optional
from app.domain.models import TestCase, TestStep, ActionType
import logging

logger = logging.getLogger(__name__)


class ValidationResult:
    """Result of test case validation"""
    def __init__(
        self,
        is_valid: bool,
        errors: List[str],
        warnings: List[str],
        score: int
    ):
        self.is_valid = is_valid
        self.errors = errors
        self.warnings = warnings
        self.score = score  # 0-100


class TestCaseValidator:
    """Validates test cases for correctness and completeness"""
    
    def validate(self, test_case: TestCase) -> ValidationResult:
        """
        Comprehensive validation of a test case
        Returns ValidationResult with errors, warnings, and score
        """
        errors: List[str] = []
        warnings: List[str] = []
        
        # 1. Basic Structure Validation
        if not test_case.name or not test_case.name.strip():
            errors.append("Test case must have a name")
        
        if not test_case.description or not test_case.description.strip():
            warnings.append("Test case should have a description")
        
        if not test_case.steps or len(test_case.steps) == 0:
            errors.append("Test case must have at least one step")
            return ValidationResult(False, errors, warnings, 0)
        
        # 2. Step Validation
        for idx, step in enumerate(test_case.steps, 1):
            step_errors, step_warnings = self._validate_step(step, idx)
            errors.extend(step_errors)
            warnings.extend(step_warnings)
        
        # 3. Selector Validation
        selector_errors, selector_warnings = self._validate_selectors(test_case.steps)
        errors.extend(selector_errors)
        warnings.extend(selector_warnings)
        
        # 4. Step Logic Validation
        logic_errors, logic_warnings = self._validate_step_logic(test_case.steps)
        errors.extend(logic_errors)
        warnings.extend(logic_warnings)
        
        # 5. Completeness Validation
        completeness_warnings = self._validate_completeness(test_case)
        warnings.extend(completeness_warnings)
        
        # Calculate score (0-100)
        # Start with 100, deduct points for errors and warnings
        score = 100
        score -= len(errors) * 20  # Each error costs 20 points
        score -= len(warnings) * 5  # Each warning costs 5 points
        score = max(0, score)  # Don't go below 0
        
        is_valid = len(errors) == 0
        
        return ValidationResult(is_valid, errors, warnings, score)
    
    def _validate_step(self, step: TestStep, step_index: int) -> tuple[List[str], List[str]]:
        """Validate a single step"""
        errors: List[str] = []
        warnings: List[str] = []
        
        # Required fields
        if not step.action:
            errors.append(f"Step {step_index}: Missing action")
        
        if not step.description or not step.description.strip():
            warnings.append(f"Step {step_index}: Should have a description")
        
        # Validate action type
        try:
            ActionType(step.action)
        except (ValueError, TypeError):
            errors.append(f"Step {step_index}: Invalid action type '{step.action}'")
        
        # Validate action-specific requirements
        if step.action in [ActionType.TYPE, ActionType.FILL]:
            if not step.value or not step.value.strip():
                warnings.append(f"Step {step_index}: Type/Fill action should have a value")
        
        if step.action == ActionType.NAVIGATE:
            if not step.value or not step.value.strip():
                errors.append(f"Step {step_index}: Navigate action must have a URL value")
        
        if step.action == ActionType.ASSERT:
            if not step.expected_outcome or not step.expected_outcome.strip():
                warnings.append(f"Step {step_index}: Assert action should have an expected outcome")
        
        return errors, warnings
    
    def _validate_selectors(self, steps: List[TestStep]) -> tuple[List[str], List[str]]:
        """Validate selectors for steps that need element location"""
        errors: List[str] = []
        warnings: List[str] = []
        
        actions_requiring_selectors = [
            ActionType.CLICK,
            ActionType.TYPE,
            ActionType.FILL,
            ActionType.HOVER,
            ActionType.ASSERT
        ]
        
        for idx, step in enumerate(steps, 1):
            if step.action in actions_requiring_selectors:
                if not step.target:
                    errors.append(f"Step {idx}: {step.action} action requires a target element")
                elif not step.suggested_selectors or len(step.suggested_selectors) == 0:
                    warnings.append(f"Step {idx}: {step.action} action should have suggested selectors")
                else:
                    # Validate selector quality
                    for sel_idx, selector in enumerate(step.suggested_selectors, 1):
                        if not selector.type or not selector.type.strip():
                            errors.append(f"Step {idx}, Selector {sel_idx}: Missing selector type")
                        if not selector.value or not selector.value.strip():
                            errors.append(f"Step {idx}, Selector {sel_idx}: Missing selector value")
                        if selector.stability_score < 0 or selector.stability_score > 1:
                            warnings.append(f"Step {idx}, Selector {sel_idx}: Stability score should be between 0 and 1")
        
        return errors, warnings
    
    def _validate_step_logic(self, steps: List[TestStep]) -> tuple[List[str], List[str]]:
        """Validate logical consistency of steps"""
        errors: List[str] = []
        warnings: List[str] = []
        
        # Check for navigation step
        has_navigation = any(step.action == ActionType.NAVIGATE for step in steps)
        if not has_navigation:
            warnings.append("Test case should start with a navigation step")
        
        # Check for assertion steps
        has_assertion = any(step.action == ActionType.ASSERT for step in steps)
        if not has_assertion:
            warnings.append("Test case should have at least one assertion step to verify results")
        
        # Check step order (navigation should be first)
        if steps and steps[0].action != ActionType.NAVIGATE and has_navigation:
            warnings.append("Navigation step should typically be the first step")
        
        # Check for logical flow issues
        for idx in range(len(steps) - 1):
            current = steps[idx]
            next_step = steps[idx + 1]
            
            # Type/Fill should typically come before submit/click actions
            if current.action in [ActionType.TYPE, ActionType.FILL]:
                if next_step.action == ActionType.TYPE or next_step.action == ActionType.FILL:
                    # Multiple type/fill in a row is usually fine (filling a form)
                    pass
                elif next_step.action == ActionType.NAVIGATE:
                    warnings.append(f"Step {idx + 1}: Navigation after input may indicate missing submit/click step")
        
        return errors, warnings
    
    def _validate_completeness(self, test_case: TestCase) -> List[str]:
        """Validate test case completeness"""
        warnings: List[str] = []
        
        # Check minimum steps
        if len(test_case.steps) < 2:
            warnings.append("Test case should have at least 2 steps (navigation + action)")
        
        # Check for meaningful test coverage
        action_types = set(step.action for step in test_case.steps)
        if len(action_types) == 1:
            warnings.append("Test case has only one type of action - may lack coverage")
        
        return warnings
