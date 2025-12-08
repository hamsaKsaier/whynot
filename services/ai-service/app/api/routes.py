from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List, Optional
from pydantic import BaseModel
from app.domain.models import UserStory, TestCase, VisionAnalysisResult
from app.application.test_generator import TestGenerator
from app.infrastructure.vision.vision_analyzer import VisionAnalyzer
from datetime import datetime


class UserStoryWithPageContext(UserStory):
    """User story with optional page context"""
    screenshot_base64: Optional[str] = None
    html: Optional[str] = None

router = APIRouter()
test_generator = TestGenerator()
vision_analyzer = VisionAnalyzer()


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "ai-service"}


@router.post("/api/generate-tests", response_model=List[TestCase])
async def generate_tests(user_story: UserStoryWithPageContext):
    """Generate test cases from user story, optionally with page context"""
    try:
        # Use page context if provided, otherwise use old method
        if user_story.screenshot_base64 and user_story.html:
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
                pass
            
            test_cases = await test_generator.generate_test_cases_with_page_context(
                user_story,
                user_story.screenshot_base64,
                user_story.html,
                vision_analysis
            )
        else:
            # Fallback to old method without page context
            test_cases = await test_generator.generate_test_cases(user_story)
        
        # Add metadata
        for tc in test_cases:
            if tc.metadata:
                tc.metadata["generated_at"] = datetime.utcnow().isoformat()
        
        return test_cases
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating tests: {str(e)}")


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

