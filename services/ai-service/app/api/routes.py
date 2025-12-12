from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List, Optional
from pydantic import BaseModel
from app.domain.models import UserStory, TestCase, VisionAnalysisResult
from app.application.test_generator import TestGenerator
from app.application.html_preprocessor import HTMLPreProcessor
from app.application.selector_agents import StrategyAgent
from app.infrastructure.vision.vision_analyzer import VisionAnalyzer
from app.infrastructure.llm.llm_client import LLMClient
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class UserStoryWithPageContext(UserStory):
    """User story with optional page context"""
    screenshot_base64: Optional[str] = None
    html: Optional[str] = None

router = APIRouter()
test_generator = TestGenerator()
vision_analyzer = VisionAnalyzer()
html_preprocessor = HTMLPreProcessor()
_strategy_agent = None

def get_strategy_agent():
    """Lazy initialization of strategy agent"""
    global _strategy_agent
    if _strategy_agent is None:
        _strategy_agent = StrategyAgent(LLMClient())
    return _strategy_agent


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


@router.post("/api/generate-tests", response_model=List[TestCase])
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
            
            # Optionally use VisionAnalyzer to pre-analyze page for better results
            vision_analysis = None
            try:
                import base64
                screenshot_bytes = base64.b64decode(user_story.screenshot_base64)
                vision_result = await vision_analyzer.analyze_screenshot(screenshot_bytes=screenshot_bytes)
                vision_analysis = {
                    "elements": vision_result.elements,
                    "text_elements": vision_result.text_elements,
                    "layout": vision_result.layout_info
                }
            except Exception as e:
                # Continue without vision analysis if it fails
                logger.warning(f"Vision analysis failed, continuing without it: {str(e)}")
            
            logger.info("Calling generate_test_cases_with_page_context with cleaned HTML and screenshot")
            test_cases = await test_generator.generate_test_cases_with_page_context(
                user_story,
                user_story.screenshot_base64,
                cleaned_html,
                vision_analysis
            )
            logger.info(f"Generated {len(test_cases)} test case(s) with page context")
        else:
            # Fallback to old method without page context
            logger.warning("No page context provided, using fallback method without HTML/screenshot")
            test_cases = await test_generator.generate_test_cases(user_story)
            logger.info(f"Generated {len(test_cases)} test case(s) without page context")
        
        # Add metadata
        for tc in test_cases:
            if tc.metadata:
                tc.metadata["generated_at"] = datetime.utcnow().isoformat()
        
        return test_cases
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
        
        return {
            "success": len(recommended_selectors) > 0,
            "analysis": response_text.get('analysis', ''),
            "recommended_selectors": recommended_selectors,
            "confidence": response_text.get('confidence', 0.5)
        }
    except Exception as e:
        logger.error(f"Claude fallback failed: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Claude fallback failed: {str(e)}"
        )

