import os
import base64
import json
import logging
from typing import List, Dict, Any, Optional
from app.infrastructure.llm.llm_client import LLMClient

logger = logging.getLogger(__name__)


class VisualDiffAnalysis:
    """Analysis result for visual differences"""
    
    def __init__(
        self,
        difference_types: List[str],
        severity: str,
        descriptions: List[str],
        affected_areas: Optional[List[Dict[str, str]]] = None,
        recommendations: Optional[List[str]] = None
    ):
        self.difference_types = difference_types
        self.severity = severity  # 'low' | 'medium' | 'high' | 'critical'
        self.descriptions = descriptions
        self.affected_areas = affected_areas or []
        self.recommendations = recommendations or []

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "difference_types": self.difference_types,
            "severity": self.severity,
            "descriptions": self.descriptions,
            "affected_areas": self.affected_areas,
            "recommendations": self.recommendations
        }


class VisualDiffAnalyzer:
    """Analyzes visual differences between two screenshots using AI"""
    
    def __init__(self):
        self._llm_client = None
    
    @property
    def llm_client(self):
        """Lazy initialization of LLM client"""
        if self._llm_client is None:
            self._llm_client = LLMClient()
        return self._llm_client
    
    async def analyze_visual_diff(
        self,
        baseline_screenshot_base64: str,
        current_screenshot_base64: str,
        pixel_diff_score: float,
        context: Optional[dict] = None
    ) -> VisualDiffAnalysis:
        """
        Analyze visual differences between two screenshots.
        
        Args:
            baseline_screenshot_base64: Base64-encoded baseline screenshot
            current_screenshot_base64: Base64-encoded current screenshot
            pixel_diff_score: Pixel difference score (0.0 to 1.0)
            context: Optional context information (test case, step, etc.)
        
        Returns:
            VisualDiffAnalysis with difference types, severity, descriptions, etc.
        """
        
        try:
            # Create analysis prompt
            prompt = self._create_analysis_prompt(pixel_diff_score, context)
            
            # Use vision-capable LLM
            provider = os.getenv("LLM_PROVIDER", "anthropic").lower()
            result_text = None
            
            if provider == "openai" and self.llm_client.openai_client:
                # OpenAI Vision API
                response = self.llm_client.openai_client.chat.completions.create(
                    model=os.getenv("OPENAI_VISION_MODEL", "gpt-4o"),
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/png;base64,{baseline_screenshot_base64}",
                                        "detail": "high"
                                    }
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/png;base64,{current_screenshot_base64}",
                                        "detail": "high"
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens=2000,
                    temperature=0.3
                )
                result_text = response.choices[0].message.content
            
            elif provider == "anthropic" and self.llm_client.anthropic_client:
                # Anthropic Claude Vision API
                model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
                response = self.llm_client.anthropic_client.messages.create(
                    model=model,
                    max_tokens=2000,
                    messages=[{
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": baseline_screenshot_base64
                                }
                            },
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": current_screenshot_base64
                                }
                            },
                            {
                                "type": "text",
                                "text": prompt
                            }
                        ]
                    }]
                )
                result_text = response.content[0].text
            
            # Parse JSON from response
            if result_text:
                analysis_data = self._parse_analysis_response(result_text, pixel_diff_score)
            else:
                # Fallback: use pixel score to estimate severity
                analysis_data = self._fallback_analysis(pixel_diff_score)
            
            return VisualDiffAnalysis(**analysis_data)
            
        except Exception as e:
            logger.error(f"Error analyzing visual diff: {str(e)}")
            # Fallback to pixel-based analysis
            return VisualDiffAnalysis(**self._fallback_analysis(pixel_diff_score))
    
    def _create_analysis_prompt(self, pixel_diff_score: float, context: Optional[dict] = None) -> str:
        """Create prompt for visual diff analysis"""
        
        context_str = ""
        if context:
            context_str = f"\n\nContext:\n- Test Case: {context.get('test_case_name', 'Unknown')}\n"
            context_str += f"- Step: {context.get('step_description', 'Unknown')}\n"
            context_str += f"- Expected Outcome: {context.get('expected_outcome', 'N/A')}\n"
        
        prompt = f"""You are analyzing visual differences between two screenshots of the same web page.

Baseline screenshot (first image): The reference/expected screenshot
Current screenshot (second image): The screenshot from the current test execution
Pixel diff score: {pixel_diff_score * 100:.2f}% of pixels differ

Analyze the differences and provide a JSON response with the following structure:
{{
  "difference_types": ["category1", "category2"],
  "severity": "low|medium|high|critical",
  "descriptions": ["Human-readable description 1", "Description 2"],
  "affected_areas": [
    {{"region": "top-left", "description": "Description of changes in this area"}},
    {{"region": "header", "description": "Description of changes"}}
  ],
  "recommendations": ["Suggestion 1", "Suggestion 2"]
}}

Categories for difference_types:
- "layout_shift": Elements moved, repositioned, or layout changed
- "color_change": Colors, backgrounds, or styling changed
- "content_update": Text content changed, added, or removed
- "missing_element": Element present in baseline but missing in current
- "new_element": Element not in baseline but present in current
- "styling_change": CSS/styling differences (fonts, spacing, borders)
- "image_change": Images changed or replaced
- "functional_breakage": Changes that likely break functionality

Severity guidelines:
- "low": Minor styling changes, cosmetic differences, negligible impact
- "medium": Noticeable layout shifts, moderate styling changes, some visual impact
- "high": Significant content changes, missing/added elements, substantial visual impact
- "critical": Broken layout, critical elements missing, likely functional breakage

Focus on functional impact, not cosmetic differences. Ignore anti-aliasing variations and minor rendering differences.{context_str}

Return ONLY the JSON object, no additional text."""

        return prompt
    
    def _parse_analysis_response(self, result_text: str, pixel_diff_score: float) -> Dict[str, Any]:
        """Parse AI response into analysis data"""
        
        try:
            # Try to extract JSON
            start = result_text.find("{")
            end = result_text.rfind("}") + 1
            if start >= 0 and end > start:
                json_text = result_text[start:end]
            else:
                json_text = result_text
            
            analysis_data = json.loads(json_text)
            
            # Validate and normalize
            difference_types = analysis_data.get("difference_types", [])
            if not isinstance(difference_types, list):
                difference_types = []
            
            severity = analysis_data.get("severity", "medium").lower()
            if severity not in ["low", "medium", "high", "critical"]:
                severity = self._calculate_severity_from_score(pixel_diff_score)
            
            descriptions = analysis_data.get("descriptions", [])
            if not isinstance(descriptions, list):
                descriptions = [str(descriptions)] if descriptions else []
            
            affected_areas = analysis_data.get("affected_areas", [])
            if not isinstance(affected_areas, list):
                affected_areas = []
            
            recommendations = analysis_data.get("recommendations", [])
            if not isinstance(recommendations, list):
                recommendations = []
            
            return {
                "difference_types": difference_types,
                "severity": severity,
                "descriptions": descriptions,
                "affected_areas": affected_areas,
                "recommendations": recommendations
            }
            
        except json.JSONDecodeError as e:
            logger.warn(f"Failed to parse JSON from AI response: {str(e)}")
            # Fallback to pixel-based analysis
            return self._fallback_analysis(pixel_diff_score)
        except Exception as e:
            logger.error(f"Error parsing analysis response: {str(e)}")
            return self._fallback_analysis(pixel_diff_score)
    
    def _fallback_analysis(self, pixel_diff_score: float) -> Dict[str, Any]:
        """Fallback analysis based on pixel difference score"""
        
        severity = self._calculate_severity_from_score(pixel_diff_score)
        
        if pixel_diff_score < 0.01:
            difference_types = ["styling_change"]
            descriptions = [f"Minor visual differences detected ({pixel_diff_score * 100:.2f}% pixel difference)"]
        elif pixel_diff_score < 0.05:
            difference_types = ["styling_change", "layout_shift"]
            descriptions = [f"Moderate visual differences detected ({pixel_diff_score * 100:.2f}% pixel difference)"]
        elif pixel_diff_score < 0.2:
            difference_types = ["layout_shift", "content_update"]
            descriptions = [f"Significant visual differences detected ({pixel_diff_score * 100:.2f}% pixel difference)"]
        else:
            difference_types = ["layout_shift", "content_update", "functional_breakage"]
            descriptions = [f"Major visual differences detected ({pixel_diff_score * 100:.2f}% pixel difference)"]
        
        return {
            "difference_types": difference_types,
            "severity": severity,
            "descriptions": descriptions,
            "affected_areas": [],
            "recommendations": ["Review screenshots manually to identify specific changes"]
        }
    
    def _calculate_severity_from_score(self, pixel_diff_score: float) -> str:
        """Calculate severity based on pixel difference score"""
        if pixel_diff_score >= 0.5:
            return "critical"
        elif pixel_diff_score >= 0.2:
            return "high"
        elif pixel_diff_score >= 0.05:
            return "medium"
        else:
            return "low"
