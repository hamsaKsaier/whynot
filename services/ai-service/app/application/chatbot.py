import json
import logging
from typing import List, Dict, Any, Optional
from app.infrastructure.llm.llm_client import LLMClient
from app.domain.models import TestCase, TestStep

logger = logging.getLogger(__name__)


class TestAutomationChatbot:
    """General-purpose AI assistant for test automation"""
    
    def __init__(self):
        self.llm_client = LLMClient()
    
    async def processMessage(
        self,
        context: Dict[str, Any],
        userMessage: str,
        conversationHistory: List[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Process user message and provide response
        
        Args:
            context: Context about current test case, step, execution, etc.
            userMessage: User's message
            conversationHistory: Previous messages in the conversation
            
        Returns:
            Response with text, suggested actions, and any generated content
        """
        conversationHistory = conversationHistory or []
        
        # Detect intent
        intent = self._detectIntent(userMessage, context)
        
        # Build prompt with context
        prompt = self._buildPrompt(context, userMessage, conversationHistory, intent)
        
        # Get response from LLM
        try:
            response_text = await self.llm_client.generate_completion(
                prompt,
                self._getSystemPrompt(intent)
            )
            
            # Parse response (may contain JSON for actions)
            response = self._parseResponse(response_text, intent)
            
            return {
                "success": True,
                "message": response.get("message", response_text),
                "intent": intent,
                "actions": response.get("actions", []),
                "generated_test": response.get("test_case"),
                "modifications": response.get("modifications"),
                "confidence": response.get("confidence", 0.8)
            }
        except Exception as e:
            logger.error(f"Chatbot processing failed: {str(e)}")
            return {
                "success": False,
                "message": f"I encountered an error: {str(e)}. Please try again.",
                "intent": intent,
                "error": str(e)
            }
    
    def _detectIntent(self, message: str, context: Dict[str, Any]) -> str:
        """Detect user intent from message"""
        message_lower = message.lower()
        
        # Intent keywords
        if any(word in message_lower for word in ['generate', 'create', 'make', 'build', 'new test']):
            return 'generate_test'
        elif any(word in message_lower for word in ['modify', 'change', 'update', 'edit', 'add step', 'remove step']):
            return 'modify_test'
        elif any(word in message_lower for word in ['why', 'what', 'how', 'explain', 'help', 'question']):
            return 'question'
        elif any(word in message_lower for word in ['debug', 'fix', 'error', 'failed', 'issue', 'problem']):
            return 'debug'
        elif any(word in message_lower for word in ['configure', 'set', 'change timeout', 'headless', 'wait']):
            return 'configure'
        else:
            return 'general'
    
    def _getSystemPrompt(self, intent: str) -> str:
        """Get system prompt based on intent"""
        base_prompt = "You are an expert test automation assistant. Help users with test creation, modification, debugging, and configuration."
        
        intent_prompts = {
            'generate_test': "Focus on generating comprehensive test cases from user descriptions. Break down scenarios into atomic steps.",
            'modify_test': "Help users modify existing tests by adding, removing, or changing steps. Maintain test integrity.",
            'question': "Answer questions about test automation, best practices, and how the system works.",
            'debug': "Help debug test failures by analyzing errors, suggesting fixes, and explaining issues.",
            'configure': "Assist with test configuration like timeouts, headless mode, waits, and other settings.",
            'general': "Provide helpful responses about test automation."
        }
        
        return f"{base_prompt} {intent_prompts.get(intent, '')}"
    
    def _buildPrompt(
        self,
        context: Dict[str, Any],
        userMessage: str,
        conversationHistory: List[Dict[str, str]],
        intent: str
    ) -> str:
        """Build prompt with context and conversation history"""
        prompt_parts = []
        
        # Add context
        if context.get('test_case'):
            tc = context['test_case']
            prompt_parts.append(f"CURRENT TEST CASE:\n- Name: {tc.get('name', 'N/A')}")
            prompt_parts.append(f"- Description: {tc.get('description', 'N/A')}")
            prompt_parts.append(f"- Steps: {len(tc.get('steps', []))} steps")
            if tc.get('steps'):
                prompt_parts.append(f"- Step details: {json.dumps(tc['steps'][:3], indent=2)}")
        
        if context.get('step'):
            step = context['step']
            prompt_parts.append(f"\nCURRENT STEP:\n{json.dumps(step, indent=2)}")
        
        if context.get('execution_result'):
            exec_result = context['execution_result']
            prompt_parts.append(f"\nEXECUTION RESULT:\n- Status: {exec_result.get('status', 'N/A')}")
            if exec_result.get('error'):
                prompt_parts.append(f"- Error: {exec_result['error']}")
        
        if context.get('failure_analysis'):
            analysis = context['failure_analysis']
            prompt_parts.append(f"\nFAILURE ANALYSIS:\n- Category: {analysis.get('category', 'N/A')}")
            prompt_parts.append(f"- Reason: {analysis.get('reason', 'N/A')}")
            prompt_parts.append(f"- Is System Failure: {analysis.get('is_system_failure', False)}")
        
        # Add conversation history
        if conversationHistory:
            prompt_parts.append("\nCONVERSATION HISTORY:")
            for msg in conversationHistory[-5:]:  # Last 5 messages
                prompt_parts.append(f"{msg.get('role', 'user').upper()}: {msg.get('content', '')}")
        
        # Add user message
        prompt_parts.append(f"\nUSER MESSAGE: {userMessage}")
        
        # Add intent-specific instructions
        if intent == 'generate_test':
            prompt_parts.append("\nINSTRUCTIONS: Generate a test case based on the user's description. Return JSON with test case structure.")
        elif intent == 'modify_test':
            prompt_parts.append("\nINSTRUCTIONS: Modify the test case based on user's request. Return JSON with modifications.")
        elif intent == 'debug':
            prompt_parts.append("\nINSTRUCTIONS: Analyze the failure and provide debugging suggestions.")
        
        return "\n".join(prompt_parts)
    
    def _parseResponse(self, response_text: str, intent: str) -> Dict[str, Any]:
        """Parse LLM response based on intent"""
        result = {
            "message": response_text,
            "actions": [],
            "confidence": 0.8
        }
        
        # Try to extract JSON if present
        try:
            if '{' in response_text and '}' in response_text:
                json_match = json.loads(self.llm_client._extract_and_repair_json(response_text))
                
                if 'test_case' in json_match:
                    result['test_case'] = json_match['test_case']
                if 'modifications' in json_match:
                    result['modifications'] = json_match['modifications']
                if 'actions' in json_match:
                    result['actions'] = json_match['actions']
                if 'message' in json_match:
                    result['message'] = json_match['message']
        except:
            # If JSON parsing fails, just use text response
            pass
        
        return result
    
    async def generateTestFromConversation(
        self,
        conversation: List[Dict[str, str]],
        userStory: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate test case from conversation"""
        prompt = f"""Generate a test case based on this conversation.

{'User Story: ' + userStory if userStory else ''}

Conversation:
{json.dumps(conversation, indent=2)}

Return JSON with test case:
{{
  "name": "Test case name",
  "description": "Test description",
  "steps": [
    {{
      "action": "navigate|click|type|assert|...",
      "target": {{"text": "...", "role": "..."}},
      "value": "...",
      "description": "Step description"
    }}
  ]
}}"""
        
        response = await self.llm_client.generate_json(
            prompt,
            "You are an expert at generating test cases from conversations. Create comprehensive, executable test cases."
        )
        
        return response
    
    async def modifyTest(
        self,
        testCase: Dict[str, Any],
        userRequest: str,
        stepIndex: Optional[int] = None,
        step: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Modify test case based on user request, with optional step context"""
        
        # Build prompt with step context if provided
        if stepIndex is not None and step:
            prompt = f"""Modify this test case based on the user's request.

CURRENT STEP (index {stepIndex}):
{json.dumps(step, indent=2)}

FULL TEST CASE:
{json.dumps(testCase, indent=2)}

User Request: {userRequest}

Instructions:
- If user wants to change selector, update the step's suggested_selectors field or modify the target
- If user wants to delete step, remove it from the steps array (remove step at index {stepIndex})
- If user wants to add step, insert a new step at position {stepIndex + 1} (after current step)
- If user wants to modify step properties, update the step's fields (action, target, value, description, etc.)
- Always return the COMPLETE modified test case with all steps

Return the complete modified test case as JSON with this structure:
{{
  "name": "Test case name",
  "description": "Test description",
  "steps": [
    {{
      "id": "step-id",
      "action": "navigate|click|type|assert|...",
      "target": {{"text": "...", "role": "..."}},
      "value": "...",
      "description": "Step description",
      "expected_outcome": "...",
      "wait_time": 1000
    }}
  ],
  "website_url": "..."
}}"""
        else:
            # General test case modification
            prompt = f"""Modify this test case based on the user's request.

Current Test Case:
{json.dumps(testCase, indent=2)}

User Request: {userRequest}

Return the complete modified test case as JSON with all steps."""
        
        response = await self.llm_client.generate_json(
            prompt,
            "You are an expert at modifying test cases. Maintain test integrity while making requested changes. Always return the complete test case with all steps."
        )
        
        # Ensure response is a complete test case, not just modifications
        if "steps" not in response and "name" not in response:
            # Response might be modifications - merge with original
            if "action" in response and "steps" in response:
                # Response has modifications format
                modified_test_case = testCase.copy()
                modified_test_case["steps"] = response.get("steps", testCase.get("steps", []))
                return modified_test_case
            else:
                # Return as-is but ensure it has required fields
                if "name" not in response:
                    response["name"] = testCase.get("name", "Modified Test Case")
                if "description" not in response:
                    response["description"] = testCase.get("description", "")
                if "steps" not in response:
                    response["steps"] = testCase.get("steps", [])
                if "website_url" not in response:
                    response["website_url"] = testCase.get("website_url", "")
        
        return response
    
    async def answerQuestion(
        self,
        question: str,
        context: Dict[str, Any]
    ) -> str:
        """Answer questions about tests"""
        prompt = f"""Answer this question about test automation.

Question: {question}

Context:
{json.dumps(context, indent=2)}

Provide a clear, helpful answer."""
        
        response = await self.llm_client.generate_completion(
            prompt,
            "You are an expert test automation consultant. Provide clear, accurate answers."
        )
        
        return response


