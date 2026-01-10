import uuid
import json
import logging
from typing import List, Optional
from app.domain.models import TestCase, TestStep, UserStory, ActionType, ElementDescription, ElementSelector
from app.infrastructure.llm.llm_client import LLMClient

logger = logging.getLogger(__name__)


class TestGenerator:
    """Generates test cases from user stories using AI"""
    
    def __init__(self):
        self._llm_client = None
    
    @property
    def llm_client(self):
        """Lazy initialization of LLM client"""
        if self._llm_client is None:
            self._llm_client = LLMClient()
        return self._llm_client
    
    def _create_test_generation_prompt(self, user_story: str, website_url: str) -> str:
        """Create prompt for test case generation"""
        return f"""You are an expert test automation engineer. Given a user story, generate comprehensive test cases.

User Story: {user_story}
Website URL: {website_url}

Generate test cases following these rules:
1. Break down the user story into testable scenarios
2. Each test case should have a clear name and description
3. Each test case should have multiple atomic steps
4. Each step should specify:
   - action: one of [navigate, click, type, fill, select, wait, assert, scroll, hover]
   - target: description of the element (text, role, label, placeholder, position)
   - value: for type/fill actions, the text to enter
   - expected_outcome: what should happen after this step
   - description: human-readable description of the step

5. Steps should be in logical order
6. Include navigation steps to reach the relevant page
7. Include assertion steps to verify expected outcomes

Return a JSON array of test cases. Each test case should have:
- name: string
- description: string
- steps: array of step objects

Each step object should have:
- action: string (one of the action types)
- target: object with optional fields: text, role, label, placeholder, position
- value: string (optional, for type/fill)
- expected_outcome: string
- description: string

Example format:
{{
  "test_cases": [
    {{
      "name": "User can login successfully",
      "description": "Test that a user can login with valid credentials",
      "steps": [
        {{
          "action": "navigate",
          "target": null,
          "value": "{website_url}",
          "expected_outcome": "Home page loads",
          "description": "Navigate to the website"
        }},
        {{
          "action": "click",
          "target": {{"text": "Login", "role": "button"}},
          "value": null,
          "expected_outcome": "Login form appears",
          "description": "Click on the Login button"
        }},
        {{
          "action": "type",
          "target": {{"placeholder": "Email", "role": "textbox"}},
          "value": "user@example.com",
          "expected_outcome": "Email field is filled",
          "description": "Enter email address"
        }}
      ]
    }}
  ]
}}"""
    
    def _parse_test_steps(self, steps_data: List[dict]) -> List[TestStep]:
        """Parse test steps from LLM response"""
        test_steps = []
        for idx, step_data in enumerate(steps_data):
            step_id = f"step-{idx + 1:03d}"
            
            # Parse target element description
            target = None
            if step_data.get("target"):
                target = ElementDescription(**step_data["target"])
            
            # Parse action type
            action_str = step_data.get("action", "click").lower()
            try:
                action = ActionType(action_str)
            except ValueError:
                action = ActionType.CLICK  # Default fallback
            
            test_step = TestStep(
                id=step_id,
                action=action,
                target=target,
                value=step_data.get("value"),
                expected_outcome=step_data.get("expected_outcome"),
                description=step_data.get("description", "")
            )
            test_steps.append(test_step)
        
        return test_steps
    
    def _create_test_generation_prompt_with_page_context(
        self, 
        user_story: str, 
        website_url: str,
        html: str,
        vision_analysis: Optional[dict] = None
    ) -> str:
        """Create prompt for test case generation with page context"""
        html_preview = html[:5000] if len(html) > 5000 else html  # Limit HTML preview
        vision_context = ""
        if vision_analysis:
            vision_context = f"\n\nVision Analysis Results:\n{json.dumps(vision_analysis, indent=2)}"
        
        return f"""You are an expert test automation engineer. Given a user story and the actual page content, generate comprehensive test cases.

User Story: {user_story}
Website URL: {website_url}

PAGE CONTENT:
HTML Preview (first 5000 chars):
{html_preview}
{vision_context}

IMPORTANT INSTRUCTIONS:
1. Analyze the HTML and screenshot to identify ACTUAL elements on the page
2. Only generate test steps for elements that ACTUALLY EXIST on this page
3. For each step that interacts with an element, generate 2 suggested selectors ranked by stability
4. Selector stability priority:
   - data-testid or data-cy attributes (stability_score: 0.95)
   - Stable ID attributes (stability_score: 0.85)
   - aria-label attributes (stability_score: 0.75)
   - Stable CSS classes (stability_score: 0.65) - only if class name is semantic and stable (e.g., login-button, submit-form, button-primary, not framework-generated like sc-123abc, css-xyz789, or Tailwind utilities)
   - Text content (stability_score: 0.60)
   - Unstable CSS classes (stability_score: 0.40) - framework-generated classes (use only if no better option)
   - XPath (stability_score: 0.30) - use as last resort

Generate test cases following these rules:
1. Break down the user story into testable scenarios
2. Each test case should have a clear name and description
3. Each test case should have multiple atomic steps
4. Each step should specify:
   - action: one of [navigate, click, type, fill, select, wait, assert, scroll, hover]
   - target: description of the element (text, role, label, placeholder, position)
   - value: for type/fill actions, the text to enter
   - expected_outcome: what should happen after this step
   - description: human-readable description of the step
   - suggested_selectors: array of 2 selectors (if element interaction), each with:
     * type: string (data-testid, id, aria-label, class, text, xpath, css)
     * value: string (the actual selector value)
     * stability_score: number (0.0 to 1.0)

5. Steps should be in logical order
6. Include navigation steps to reach the relevant page
7. Include assertion steps to verify expected outcomes
8. Only use elements that you can see in the HTML/screenshot

Return a JSON array of test cases. Each test case should have:
- name: string
- description: string
- steps: array of step objects

Each step object should have:
- action: string (one of the action types)
- target: object with optional fields: text, role, label, placeholder, position
- value: string (optional, for type/fill)
- expected_outcome: string
- description: string
- suggested_selectors: array of selector objects (for element interactions)

Example format:
{{
  "test_cases": [
    {{
      "name": "User can login successfully",
      "description": "Test that a user can login with valid credentials",
      "steps": [
        {{
          "action": "navigate",
          "target": null,
          "value": "{website_url}",
          "expected_outcome": "Home page loads",
          "description": "Navigate to the website",
          "suggested_selectors": null
        }},
        {{
          "action": "click",
          "target": {{"text": "Login", "role": "button"}},
          "value": null,
          "expected_outcome": "Login form appears",
          "description": "Click on the Login button",
          "suggested_selectors": [
            {{
              "type": "data-testid",
              "value": "[data-testid='login-button']",
              "stability_score": 0.95
            }},
            {{
              "type": "text",
              "value": "button:has-text('Login')",
              "stability_score": 0.60
            }}
          ]
        }},
        {{
          "action": "click",
          "target": {{"text": "Submit", "role": "button"}},
          "value": null,
          "expected_outcome": "Form is submitted",
          "description": "Click the submit button",
          "suggested_selectors": [
            {{
              "type": "class",
              "value": ".submit-button",
              "stability_score": 0.65
            }},
            {{
              "type": "id",
              "value": "#submit-btn",
              "stability_score": 0.85
            }}
          ]
        }}
      ]
    }}
  ]
}}"""
    
    async def generate_test_cases_with_page_context(
        self, 
        user_story: UserStory,
        screenshot_base64: str,
        html: str,
        vision_analysis: Optional[dict] = None
    ) -> List[TestCase]:
        """Generate test cases from user story with page context"""
        
        system_prompt = """You are an expert QA engineer specializing in test automation. 
        You generate comprehensive, executable test cases from user stories by analyzing actual page content.
        Always return valid JSON in the exact format specified.
        Only generate test steps for elements that actually exist on the page."""
        
        prompt = self._create_test_generation_prompt_with_page_context(
            user_story.story,
            user_story.website_url,
            html,
            vision_analysis
        )
        
        # Get response from LLM with vision
        response = await self.llm_client.generate_json_with_vision(
            prompt, 
            screenshot_base64,
            system_prompt
        )
        
        # Parse response
        # Log LLM response and check for suggested_selectors
        test_cases_count = len(response.get("test_cases", [])) if isinstance(response, dict) else 0
        logger.info(f"🎯 LLM response received: {test_cases_count} test case(s)")
        
        # Sample first step if available to check for suggested_selectors
        if isinstance(response, dict) and response.get("test_cases"):
            first_tc = response["test_cases"][0] if response["test_cases"] else {}
            first_step = first_tc.get("steps", [{}])[0] if first_tc.get("steps") else {}
            suggested_selectors = first_step.get("suggested_selectors")
            if suggested_selectors is not None:
                # Handle case where suggested_selectors might be None or empty list
                if isinstance(suggested_selectors, list) and len(suggested_selectors) > 0:
                    logger.info(f"   ✅ First step has {len(suggested_selectors)} suggested selector(s) from Claude")
                    for idx, sel in enumerate(suggested_selectors, 1):
                        logger.info(f"      {idx}. {sel.get('type', 'unknown')} = \"{sel.get('value', '')}\" (stability: {sel.get('stability_score', 0)})")
                elif isinstance(suggested_selectors, list):
                    logger.warning("   ⚠️  First step has suggested_selectors but it's an empty list")
                else:
                    logger.warning(f"   ⚠️  First step has suggested_selectors but it's not a list (type: {type(suggested_selectors)})")
            else:
                logger.warning("   ⚠️  First step does not have suggested_selectors in LLM response")
        test_cases = []
        test_cases_data = response.get("test_cases", [])
        
        if not test_cases_data:
            # Fallback: try if response is directly an array
            if isinstance(response, list):
                test_cases_data = response
        
        for idx, tc_data in enumerate(test_cases_data):
            test_case_id = f"test-{uuid.uuid4().hex[:8]}"
            
            # Log before parsing steps
            steps_data_raw = tc_data.get("steps", [])
            steps_count = len(steps_data_raw)
            logger.info(f"📋 Processing test case {idx + 1}: {tc_data.get('name', 'Unnamed')} ({steps_count} step(s))")
            
            if steps_data_raw:
                first_step_raw = steps_data_raw[0]
                suggested_selectors = first_step_raw.get("suggested_selectors")
                if suggested_selectors is not None:
                    # Handle case where suggested_selectors might be None or empty list
                    if isinstance(suggested_selectors, list) and len(suggested_selectors) > 0:
                        logger.info(f"   ✅ First step has {len(suggested_selectors)} suggested selector(s) in raw data")
                    elif isinstance(suggested_selectors, list):
                        logger.warning("   ⚠️  First step has suggested_selectors but it's an empty list in raw data")
                    else:
                        logger.warning(f"   ⚠️  First step has suggested_selectors but it's not a list in raw data (type: {type(suggested_selectors)})")
                else:
                    logger.warning(f"   ⚠️  First step does not have suggested_selectors in raw data (keys: {list(first_step_raw.keys())})")
            
            steps = self._parse_test_steps_with_selectors(tc_data.get("steps", []))
            
            test_case = TestCase(
                id=test_case_id,
                name=tc_data.get("name", f"Test Case {idx + 1}"),
                description=tc_data.get("description", ""),
                steps=steps,
                website_url=user_story.website_url,
                metadata={
                    "user_story": user_story.story,
                    "generated_at": None,  # Will be set by API layer
                    "generated_with_page_context": True
                }
            )
            test_cases.append(test_case)
        
        return test_cases
    
    def _parse_test_steps_with_selectors(self, steps_data: List[dict]) -> List[TestStep]:
        """Parse test steps from LLM response including suggested selectors"""
        test_steps = []
        for idx, step_data in enumerate(steps_data):
            step_id = f"step-{idx + 1:03d}"
            
            # Parse target element description
            target = None
            if step_data.get("target"):
                target = ElementDescription(**step_data["target"])
            
            # Parse action type
            action_str = step_data.get("action", "click").lower()
            try:
                action = ActionType(action_str)
            except ValueError:
                action = ActionType.CLICK  # Default fallback
            
            # Parse suggested selectors
            suggested_selectors = None
            if step_data.get("suggested_selectors"):
                raw_selectors = step_data.get("suggested_selectors", [])
                logger.info(f"🎯 Parsing Claude's suggested selectors for {step_id} (action: {action_str}): {len(raw_selectors)} selector(s)")
                for idx, sel in enumerate(raw_selectors, 1):
                    sel_type = sel.get('type', 'unknown')
                    sel_value = sel.get('value', '')
                    sel_stability = sel.get('stability_score', 0)
                    logger.info(f"   {idx}. {sel_type} = \"{sel_value}\" (stability: {sel_stability})")
                
                suggested_selectors = [
                    ElementSelector(**sel) for sel in step_data["suggested_selectors"]
                ]
            else:
                logger.warning(f"⚠️  No suggested_selectors found for {step_id} (action: {action_str}). Available keys: {list(step_data.keys())}")
            
            test_step = TestStep(
                id=step_id,
                action=action,
                target=target,
                value=step_data.get("value"),
                expected_outcome=step_data.get("expected_outcome"),
                description=step_data.get("description", ""),
                suggested_selectors=suggested_selectors
            )
            
            # Log TestStep creation with suggested_selectors status
            if suggested_selectors:
                logger.info(f"✅ TestStep {step_id} created with {len(suggested_selectors)} suggested selector(s) attached")
            else:
                logger.info(f"ℹ️  TestStep {step_id} created without suggested selectors")
            
            test_steps.append(test_step)
        
        return test_steps
    
    async def generate_test_cases(self, user_story: UserStory) -> List[TestCase]:
        """Generate test cases from user story"""
        system_prompt = """You are an expert QA engineer specializing in test automation. 
        You generate comprehensive, executable test cases from user stories.
        Always return valid JSON in the exact format specified."""
        
        prompt = self._create_test_generation_prompt(
            user_story.story,
            user_story.website_url
        )
        
        # Get response from LLM
        response = await self.llm_client.generate_json(prompt, system_prompt)
        
        # Parse response
        test_cases = []
        test_cases_data = response.get("test_cases", [])
        
        if not test_cases_data:
            # Fallback: try if response is directly an array
            if isinstance(response, list):
                test_cases_data = response
        
        for idx, tc_data in enumerate(test_cases_data):
            test_case_id = str(uuid.uuid4())
            
            steps = self._parse_test_steps(tc_data.get("steps", []))
            
            test_case = TestCase(
                id=test_case_id,
                name=tc_data.get("name", f"Test Case {idx + 1}"),
                description=tc_data.get("description", ""),
                steps=steps,
                website_url=user_story.website_url,
                metadata={
                    "user_story": user_story.story,
                    "generated_at": None  # Will be set by API layer
                }
            )
            test_cases.append(test_case)
        
        return test_cases

