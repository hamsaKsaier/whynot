from typing import List
from app.domain.models import TestCase
import logging

logger = logging.getLogger(__name__)


class ScenarioPrioritizer:
    """Prioritizes test cases by scenario type, risk level, and priority score"""
    
    def prioritize(self, test_cases: List[TestCase]) -> List[TestCase]:
        """
        Sort test cases by priority:
        1. Positive scenarios first
        2. Risk level (high > medium > low)
        3. Priority score (descending)
        4. Number of steps (more steps = more comprehensive)
        """
        if not test_cases:
            return test_cases
        
        def get_priority_key(test_case: TestCase) -> tuple:
            """Generate a sort key for prioritization"""
            # Scenario type priority: positive=0, negative=1, edge=2, None=3
            scenario_priority = {
                "positive": 0,
                "negative": 1,
                "edge": 2,
                None: 3
            }.get(test_case.scenario_type, 3)
            
            # Risk level priority: high=0, medium=1, low=2, None=3
            risk_priority = {
                "high": 0,
                "medium": 1,
                "low": 2,
                None: 3
            }.get(test_case.risk_level, 3)
            
            # Priority score (inverted for descending sort, default to 0)
            priority_score = test_case.priority_score if test_case.priority_score is not None else 0
            
            # Number of steps (inverted for descending sort - more steps = higher priority)
            step_count = len(test_case.steps) if test_case.steps else 0
            
            return (
                scenario_priority,  # Positive scenarios first
                risk_priority,       # High risk first
                -priority_score,     # Higher score first (negative for descending)
                -step_count          # More steps first (negative for descending)
            )
        
        sorted_cases = sorted(test_cases, key=get_priority_key)
        
        logger.info(f"Prioritized {len(sorted_cases)} test cases")
        for idx, tc in enumerate(sorted_cases, 1):
            logger.info(
                f"  {idx}. [{tc.scenario_type or 'unknown'}] {tc.name} "
                f"(risk: {tc.risk_level or 'unknown'}, priority: {tc.priority_score or 0}, steps: {len(tc.steps)})"
            )
        
        return sorted_cases
