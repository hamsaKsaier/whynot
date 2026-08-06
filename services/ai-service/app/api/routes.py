from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List, Optional
from pydantic import BaseModel
from app.domain.models import UserStory, TestCase, VisionAnalysisResult
from app.application.test_generator import TestGenerator
from app.application.html_preprocessor import HTMLPreProcessor
from app.application.selector_agents import StrategyAgent
from app.application.chatbot import TestAutomationChatbot
from app.application.chat_session import getSessionManager, ChatSession
from app.application.scenario_prioritizer import ScenarioPrioritizer
from app.application.test_case_validator import TestCaseValidator, ValidationResult
from app.application.visual_diff_analyzer import VisualDiffAnalyzer
from app.infrastructure.vision.vision_analyzer import VisionAnalyzer
from app.infrastructure.llm.llm_client import LLMClient
from datetime import datetime
import logging
import json

logger = logging.getLogger(__name__)


class UserStoryWithPageContext(UserStory):
    """User story with optional page context"""
    screenshot_base64: Optional[str] = None
    html: Optional[str] = None
    quick_mode: Optional[bool] = None

router = APIRouter()
test_generator = TestGenerator()
vision_analyzer = VisionAnalyzer()
html_preprocessor = HTMLPreProcessor()
scenario_prioritizer = ScenarioPrioritizer()
test_case_validator = TestCaseValidator()
visual_diff_analyzer = VisualDiffAnalyzer()
_strategy_agent = None
_chatbot = None

def get_strategy_agent():
    """Lazy initialization of strategy agent"""
    global _strategy_agent
    if _strategy_agent is None:
        _strategy_agent = StrategyAgent(LLMClient())
    return _strategy_agent


def get_chatbot():
    """Lazy initialization of chatbot.

    Constructing it at import time makes the whole service crash-loop when
    ANTHROPIC_API_KEY / OPENAI_API_KEY is unset — which is a supported
    self-hosted setup (the QA Loop runs on Google or OpenRouter keys instead).
    Only the chatbot endpoints require an LLMClient, so build it on demand.
    """
    global _chatbot
    if _chatbot is None:
        _chatbot = TestAutomationChatbot()
    return _chatbot


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    import os
    provider = os.getenv("LLM_PROVIDER", "anthropic").lower()
    api_key_set = False
    
    if provider == "openai":
        api_key_set = bool(os.getenv("OPENAI_API_KEY"))
    elif provider == "anthropic":
        api_key_set = bool(os.getenv("ANTHROPIC_API_KEY"))
    
    status = "healthy" if api_key_set else "unhealthy"
    details = {
        "status": status,
        "service": "ai-service",
        "llm_provider": provider,
        "api_key_configured": api_key_set
    }
    
    if not api_key_set:
        details["error"] = f"{provider.upper()}_API_KEY environment variable is not set"
    
    return details


@router.post("/api/generate-tests")
async def generate_tests(user_story: UserStoryWithPageContext):
    """Generate test cases from user story, optionally with page context"""
    import traceback
    import logging
    import json
    import os
    
    logger = logging.getLogger(__name__)
    
    try:
        # Use page context if provided, otherwise use old method
        has_page_context = bool(user_story.screenshot_base64 and user_story.html)
        
        logger.info(f"Generating test cases {'WITH' if has_page_context else 'WITHOUT'} page context", {
            "website_url": user_story.website_url,
            "has_html": bool(user_story.html),
            "has_screenshot": bool(user_story.screenshot_base64),
            "html_length": len(user_story.html) if user_story.html else 0,
            "screenshot_size": f"{(len(user_story.screenshot_base64) / 1024):.2f} KB" if user_story.screenshot_base64 else "N/A"
        })
        
        if has_page_context:
            logger.info("Using page context for test generation (HTML + Screenshot)")
            # Log HTML preview (first 500 chars)
            html_preview = user_story.html[:500] if user_story.html else "N/A"
            logger.info(f"HTML preview (first 500 chars): {html_preview}...")
            logger.info(f"HTML full length: {len(user_story.html)} chars")
            # Log screenshot info (base64 is too large to log fully)
            screenshot_preview = user_story.screenshot_base64[:100] if user_story.screenshot_base64 else "N/A"
            logger.info(f"Screenshot base64 preview (first 100 chars): {screenshot_preview}...")
            logger.info(f"Screenshot base64 full length: {len(user_story.screenshot_base64)} chars ({len(user_story.screenshot_base64) / 1024:.2f} KB)")
            
            # Pre-process HTML to clean and optimize before sending to Claude
            cleaned_html = user_story.html
            try:
                cleaned_html = html_preprocessor.clean_html(user_story.html, use_ai=False)
                logger.debug(f"HTML cleaned: {len(user_story.html)} -> {len(cleaned_html)} chars")
            except Exception as e:
                logger.warning(f"HTML pre-processing failed, using original HTML: {str(e)}")
                cleaned_html = user_story.html
            
            # Skip redundant pre-analysis — test_generator analyzes the screenshot directly
            vision_analysis = None
            
            logger.info("Calling generate_test_cases_with_page_context with cleaned HTML and screenshot")
            raw_quick = getattr(user_story, 'quick_mode', None)
            quick_mode = raw_quick is True or (isinstance(raw_quick, str) and raw_quick.lower() == 'true')
            logger.info(f"Quick mode for generation: quick_mode={quick_mode}, raw={raw_quick}")
            test_cases = await test_generator.generate_test_cases_with_page_context(
                user_story,
                user_story.screenshot_base64,
                cleaned_html,
                vision_analysis,
                quick_mode=quick_mode
            )
            logger.info(f"Generated {len(test_cases)} test case(s) with page context")
        else:
            # Fallback to old method without page context
            logger.warning("No page context provided, using fallback method without HTML/screenshot")
            raw_quick = getattr(user_story, 'quick_mode', None)
            quick_mode = raw_quick is True or (isinstance(raw_quick, str) and raw_quick.lower() == 'true')
            test_cases = await test_generator.generate_test_cases(user_story, quick_mode=quick_mode)
            logger.info(f"Generated {len(test_cases)} test case(s) without page context")
        
        # Add metadata
        for tc in test_cases:
            if tc.metadata:
                tc.metadata["generated_at"] = datetime.utcnow().isoformat()
        
        # Prioritize test cases before returning
        test_cases = scenario_prioritizer.prioritize(test_cases)
        logger.info(f"Prioritized {len(test_cases)} test cases")
        
        # Log suggested_selectors status for each step before returning
        for tc_idx, tc in enumerate(test_cases):
            logger.info(f"Test case {tc_idx + 1} ready to return", {
                "test_case_id": tc.id,
                "name": tc.name,
                "scenario_type": tc.scenario_type,
                "risk_level": tc.risk_level,
                "priority_score": tc.priority_score,
                "steps_count": len(tc.steps)
            })
            for step_idx, step in enumerate(tc.steps):
                has_suggested_selectors = step.suggested_selectors is not None and len(step.suggested_selectors) > 0
                selector_count = len(step.suggested_selectors) if step.suggested_selectors else 0
                logger.info(f"  Step {step_idx + 1} suggested_selectors status", {
                    "step_id": step.id,
                    "action": str(step.action),
                    "has_suggested_selectors": has_suggested_selectors,
                    "selector_count": selector_count,
                    "selectors": [
                        {"type": sel.type, "value": sel.value, "stability": sel.stability_score}
                        for sel in (step.suggested_selectors[:2] if has_suggested_selectors else [])
                    ]
                })
        
        # Explicitly serialize to ensure suggested_selectors are included
        serialized_cases = []
        for tc in test_cases:
            # Use model_dump for Pydantic v2, dict() for v1
            if hasattr(tc, 'model_dump'):
                tc_dict = tc.model_dump(exclude_none=False, mode='json')
            else:
                tc_dict = tc.dict(exclude_none=False)
            serialized_cases.append(tc_dict)
        
        # Log the serialized JSON to verify suggested_selectors are present
        for tc_dict in serialized_cases:
            for step in tc_dict.get('steps', []):
                has_selectors = step.get('suggested_selectors') is not None
                selector_count = len(step.get('suggested_selectors', [])) if step.get('suggested_selectors') else 0
                logger.info(f"Serialized step {step.get('id')} has suggested_selectors: {has_selectors} (count: {selector_count})")
                if has_selectors:
                    selectors = step.get('suggested_selectors', [])
                    for idx, sel in enumerate(selectors[:2], 1):
                        logger.info(f"  Serialized selector {idx}: {sel.get('type')} = \"{sel.get('value')}\"")
        
        # Log sample JSON payload for debugging
        if serialized_cases:
            sample_json = json.dumps(serialized_cases[0], indent=2)
            logger.debug(f"Sample serialized test case JSON (first 2000 chars):\n{sample_json[:2000]}")
        
        # Validate all test cases
        validation_results = []
        for tc in test_cases:
            validation_result = test_case_validator.validate(tc)
            validation_results.append({
                "test_case_id": tc.id,
                "is_valid": validation_result.is_valid,
                "score": validation_result.score,
                "errors": validation_result.errors,
                "warnings": validation_result.warnings
            })
        
        # Calculate validation summary
        total = len(validation_results)
        valid = sum(1 for r in validation_results if r["is_valid"])
        invalid = total - valid
        warnings_count = sum(len(r["warnings"]) for r in validation_results)
        
        validation_summary = {
            "total": total,
            "valid": valid,
            "invalid": invalid,
            "warnings": warnings_count
        }
        
        logger.info(f"Validation complete: {valid}/{total} valid, {invalid} invalid, {warnings_count} warnings")
        
        # Return test cases with validation results
        return {
            "test_cases": serialized_cases,
            "validation_summary": validation_summary,
            "validation_results": validation_results
        }
    except ValueError as e:
        # Handle configuration errors (missing API keys, etc.)
        error_msg = str(e)
        logger.error(f"Configuration error: {error_msg}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500, 
            detail=f"Configuration error: {error_msg}. Please check your API key configuration."
        )
    except Exception as e:
        # Log full error details for debugging
        error_msg = str(e)
        error_type = type(e).__name__
        logger.error(f"Error generating tests: {error_type}: {error_msg}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error generating tests: {error_type}: {error_msg}"
        )


@router.post("/api/analyze-screenshot", response_model=VisionAnalysisResult)
async def analyze_screenshot(file: UploadFile = File(...)):
    """Analyze screenshot to detect UI elements"""
    try:
        # Read image bytes
        image_bytes = await file.read()
        
        # Analyze screenshot
        result = await vision_analyzer.analyze_screenshot(screenshot_bytes=image_bytes)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing screenshot: {str(e)}")


@router.post("/api/agent-recovery")
async def agent_recovery(request: dict):
    """Agent-based recovery when selectors fail"""
    import traceback
    
    try:
        from app.domain.models import ElementDescription, ElementSelector
        
        # Parse request
        target_dict = request.get('target_description', {})
        target_description = ElementDescription(**target_dict)
        
        attempted_selectors_data = request.get('attempted_selectors', [])
        attempted_selectors = [ElementSelector(**sel) for sel in attempted_selectors_data]
        
        # Get strategy agent
        strategy_agent = get_strategy_agent()
        
        # Call agent discussion
        result = await strategy_agent.discuss_and_resolve(
            target_description=target_description,
            attempted_selectors=attempted_selectors,
            error_message=request.get('error_message', ''),
            html=request.get('html', ''),
            screenshot_base64=request.get('screenshot_base64')
        )
        
        # Extract selected selectors from final decision
        selected_selectors = []
        if result.get('final_decision') and result['final_decision'].get('selected_selectors'):
            selected_selectors = result['final_decision']['selected_selectors']
        
        return {
            "success": len(selected_selectors) > 0,
            "selected_selectors": selected_selectors,
            "agent_discussion": result.get('agent_discussion'),
            "final_decision": result.get('final_decision')
        }
    except Exception as e:
        logger.error(f"Agent recovery failed: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Agent recovery failed: {str(e)}"
        )


@router.post("/api/resolve-selector-failure")
async def resolve_selector_failure(request: dict):
    """Claude fallback when agents can't resolve selector failures"""
    import traceback
    import base64
    
    try:
        from app.domain.models import ElementDescription, ElementSelector
        
        # Parse request
        target_dict = request.get('target_description', {})
        target_description = ElementDescription(**target_dict)
        
        attempted_selectors_data = request.get('attempted_selectors', [])
        attempted_selectors = [ElementSelector(**sel) for sel in attempted_selectors_data]
        
        agent_discussion = request.get('agent_discussion', {})
        html = request.get('html', '')
        screenshot_base64 = request.get('screenshot_base64')
        
        # Clean HTML if needed
        cleaned_html = html_preprocessor.clean_html(html, use_ai=False)
        
        # Create comprehensive prompt for Claude
        import json
        prompt = f"""A test automation step has failed after multiple attempts. All strategies have been exhausted.

STEP INFORMATION:
- Step ID: {request.get('step_id', 'unknown')}
- Step Description: {request.get('step_description', '')}
- Error: {request.get('error_message', '')}

TARGET ELEMENT:
{json.dumps(target_dict, indent=2)}

ATTEMPTED SELECTORS:
{json.dumps([sel.dict() if hasattr(sel, 'dict') else sel for sel in attempted_selectors], indent=2)}

AGENT DISCUSSION RESULTS:
{json.dumps(agent_discussion, indent=2)}

CURRENT PAGE STATE:
HTML (cleaned, first 5000 chars):
{cleaned_html[:5000]}

Your task:
1. Analyze why all selectors failed
2. Examine the HTML structure carefully
3. Propose 2-3 new selectors that should work
4. Explain your reasoning

Return JSON:
{{
  "analysis": "Why selectors failed and what changed",
  "recommended_selectors": [
    {{"type": "id", "value": "#example", "stability_score": 0.85, "reason": "Why this should work"}}
  ],
  "confidence": 0.8
}}"""

        # Use Claude with vision if screenshot available
        if screenshot_base64:
            response_text = await test_generator.llm_client.generate_json_with_vision(
                prompt,
                screenshot_base64,
                "You are an expert at resolving complex test automation failures. Use advanced reasoning to find solutions."
            )
        else:
            response_text = await test_generator.llm_client.generate_json(
                prompt,
                "You are an expert at resolving complex test automation failures. Use advanced reasoning to find solutions."
            )
        
        # Extract selectors
        recommended_selectors = response_text.get('recommended_selectors', [])
        analysis = response_text.get('analysis', '')
        confidence = response_text.get('confidence', 0.5)
        
        # Log Claude's recommendations for selector failure resolution
        step_id = request.get('step_id', 'unknown')
        logger.info(f"🎯 Claude selector failure resolution for step {step_id}")
        logger.info(f"   Analysis: {analysis}")
        logger.info(f"   Confidence: {confidence}")
        logger.info(f"   Recommended selectors: {len(recommended_selectors)}")
        
        for idx, selector in enumerate(recommended_selectors, 1):
            sel_type = selector.get('type', 'unknown')
            sel_value = selector.get('value', '')
            sel_stability = selector.get('stability_score', 0)
            sel_reason = selector.get('reason', 'No reason provided')
            logger.info(f"      {idx}. {sel_type} = \"{sel_value}\" (stability: {sel_stability})")
            logger.info(f"         Reason: {sel_reason}")
        
        return {
            "success": len(recommended_selectors) > 0,
            "analysis": analysis,
            "recommended_selectors": recommended_selectors,
            "confidence": confidence
        }
    except Exception as e:
        logger.error(f"Claude fallback failed: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Claude fallback failed: {str(e)}"
        )


@router.post("/api/analyze-failure")
async def analyze_failure(request: dict):
    """AI-powered failure analysis to classify test failures"""
    import traceback
    import base64
    
    try:
        from app.infrastructure.llm.llm_client import LLMClient
        
        llm_client = LLMClient()
        
        # Extract request data
        step_id = request.get('step_id', 'unknown')
        step_description = request.get('step_description', '')
        error_message = request.get('error_message', '')
        element_found = request.get('element_found', False)
        attempted_selectors = request.get('attempted_selectors', [])
        page_state = request.get('page_state', {})
        target_description = request.get('target_description', {})
        screenshot_base64 = request.get('screenshot_base64')
        
        # Build comprehensive prompt
        prompt = f"""Analyze this test step failure and classify it.

STEP INFORMATION:
- Step ID: {step_id}
- Step Description: {step_description}
- Error Message: {error_message}
- Element Found in DOM: {element_found}
- Attempted Selectors: {len(attempted_selectors)} selector(s) were tried

TARGET ELEMENT:
{json.dumps(target_description, indent=2)}

PAGE STATE:
- URL: {page_state.get('url', 'unknown')}
- Title: {page_state.get('title', 'unknown')}
- HTML Snippet: {page_state.get('html_snippet', '')[:1000] if page_state.get('html_snippet') else 'N/A'}

Your task:
1. Determine if this is a SYSTEM FAILURE (our fault - selector/timing issues) or APPLICATION BUG (developer's fault)
2. Classify the failure category
3. Provide confidence score (0.0 to 1.0)
4. Suggest recovery actions if it's a system failure
5. Suggest fixes if it's an application bug

Return JSON:
{{
  "category": "selector_failure|timing_failure|element_missing|element_not_visible|element_not_interactable|assertion_failure|functional_bug|unknown",
  "confidence": 0.85,
  "is_system_failure": true,
  "reason": "Detailed explanation of why this failure occurred",
  "suggested_actions": [
    "Action 1",
    "Action 2"
  ]
}}"""

        # Use vision if screenshot available
        if screenshot_base64:
            response_text = await llm_client.generate_with_vision(
                prompt,
                screenshot_base64,
                "You are an expert at analyzing test automation failures. Classify failures accurately."
            )
        else:
            response_text = await llm_client.generate_completion(
                prompt,
                "You are an expert at analyzing test automation failures. Classify failures accurately."
            )
        
        # Parse JSON response
        response_data = llm_client._extract_and_repair_json(response_text)
        
        logger.info(f"Failure analysis completed for step {step_id}", {
            "category": response_data.get("category"),
            "is_system_failure": response_data.get("is_system_failure"),
            "confidence": response_data.get("confidence")
        })
        
        return response_data
        
    except Exception as e:
        logger.error(f"Failure analysis failed: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Failure analysis failed: {str(e)}"
        )


# Chatbot endpoints

@router.post("/api/chat/session")
async def create_chat_session(request: dict):
    """Create a new chat session"""
    try:
        session_manager = getSessionManager()
        session = session_manager.createSession(
            test_case_id=request.get('test_case_id'),
            step_id=request.get('step_id'),
            execution_id=request.get('execution_id'),
            context=request.get('context', {})
        )
        
        return {
            "success": True,
            "session_id": session.session_id,
            "session": session.toDict()
        }
    except Exception as e:
        logger.error(f"Failed to create chat session: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create chat session: {str(e)}"
        )


@router.post("/api/chat/message")
async def send_chat_message(request: dict):
    """Send a message in a chat session and get response"""
    try:
        session_id = request.get('session_id')
        message = request.get('message', '')
        context = request.get('context', {})
        
        if not session_id:
            raise ValueError("session_id is required")
        if not message:
            raise ValueError("message is required")
        
        session_manager = getSessionManager()
        session = session_manager.getSession(session_id)
        
        if not session:
            # Create new session if doesn't exist
            session = session_manager.createSession(
                test_case_id=context.get('test_case_id'),
                step_id=context.get('step_id'),
                execution_id=context.get('execution_id'),
                context=context
            )
        
        # Add user message
        session.addMessage('user', message)
        
        # Get conversation history
        conversation_history = [
            {"role": msg["role"], "content": msg["content"]}
            for msg in session.messages
        ]
        
        # Process message with chatbot
        response = await get_chatbot().processMessage(
            context={**session.context, **context},
            userMessage=message,
            conversationHistory=conversation_history
        )
        
        # Add assistant response
        if response.get('success'):
            session.addMessage('assistant', response.get('message', ''), {
                'intent': response.get('intent'),
                'actions': response.get('actions', [])
            })
        
        return {
            "success": response.get('success', True),
            "session_id": session.session_id,
            "message": response.get('message', ''),
            "intent": response.get('intent'),
            "actions": response.get('actions', []),
            "generated_test": response.get('generated_test'),
            "modifications": response.get('modifications'),
            "confidence": response.get('confidence', 0.8)
        }
    except Exception as e:
        logger.error(f"Failed to process chat message: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process chat message: {str(e)}"
        )


@router.get("/api/chat/session/{session_id}")
async def get_chat_session(session_id: str):
    """Get chat session with message history"""
    try:
        session_manager = getSessionManager()
        session = session_manager.getSession(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {
            "success": True,
            "session": session.getContext()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get chat session: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get chat session: {str(e)}"
        )


@router.post("/api/chat/generate-test")
async def generate_test_from_chat(request: dict):
    """Generate test case from conversation"""
    try:
        conversation = request.get('conversation', [])
        user_story = request.get('user_story')
        
        test_case = await get_chatbot().generateTestFromConversation(
            conversation=conversation,
            userStory=user_story
        )
        
        return {
            "success": True,
            "test_case": test_case
        }
    except Exception as e:
        logger.error(f"Failed to generate test from chat: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate test from chat: {str(e)}"
        )


@router.post("/api/chat/modify-test")
async def modify_test_from_chat(request: dict):
    """Modify test case based on chat conversation"""
    try:
        test_case = request.get('test_case')
        user_request = request.get('user_request', '')
        step_index = request.get('step_index')  # NEW: Optional step index
        step = request.get('step')  # NEW: Optional step object
        
        if not test_case:
            raise ValueError("test_case is required")
        
        # Call modifyTest with optional step context
        modified_test_case = await get_chatbot().modifyTest(
            testCase=test_case,
            userRequest=user_request,
            stepIndex=step_index,
            step=step
        )
        
        return {
            "success": True,
            "test_case": modified_test_case,  # Return full test case
            "modifications": modified_test_case  # For backwards compatibility
        }
    except Exception as e:
        logger.error(f"Failed to modify test from chat: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to modify test from chat: {str(e)}"
        )


@router.post("/api/analyze-visual-diff")
async def analyze_visual_diff(request: dict):
    """Analyze visual differences between two screenshots"""
    try:
        baseline_screenshot_base64 = request.get('baseline_screenshot_base64')
        current_screenshot_base64 = request.get('current_screenshot_base64')
        pixel_diff_score = request.get('pixel_diff_score', 0.0)
        context = request.get('context', {})
        
        if not baseline_screenshot_base64 or not current_screenshot_base64:
            raise ValueError("Both baseline_screenshot_base64 and current_screenshot_base64 are required")
        
        # Analyze visual differences
        analysis = await visual_diff_analyzer.analyze_visual_diff(
            baseline_screenshot_base64=baseline_screenshot_base64,
            current_screenshot_base64=current_screenshot_base64,
            pixel_diff_score=float(pixel_diff_score),
            context=context
        )
        
        return analysis.to_dict()
        
    except ValueError as e:
        logger.error(f"Invalid request for visual diff analysis: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to analyze visual diff: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze visual diff: {str(e)}"
        )

