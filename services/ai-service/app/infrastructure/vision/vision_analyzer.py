import os
import base64
from typing import List, Dict, Any
from PIL import Image
import io
from app.domain.models import VisionAnalysisResult
from app.infrastructure.llm.llm_client import LLMClient


class VisionAnalyzer:
    """Analyzes screenshots using vision AI to detect elements"""
    
    def __init__(self):
        self._llm_client = None
    
    @property
    def llm_client(self):
        """Lazy initialization of LLM client"""
        if self._llm_client is None:
            self._llm_client = LLMClient()
        return self._llm_client
    
    def _image_to_base64(self, image_path: str) -> str:
        """Convert image to base64 string"""
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    
    def _image_bytes_to_base64(self, image_bytes: bytes) -> str:
        """Convert image bytes to base64 string"""
        return base64.b64encode(image_bytes).decode('utf-8')
    
    async def analyze_screenshot(
        self, 
        screenshot_path: str = None, 
        screenshot_bytes: bytes = None
    ) -> VisionAnalysisResult:
        """Analyze screenshot to detect UI elements"""
        
        # Convert image to base64
        if screenshot_path:
            image_base64 = self._image_to_base64(screenshot_path)
        elif screenshot_bytes:
            image_base64 = self._image_bytes_to_base64(screenshot_bytes)
        else:
            raise ValueError("Either screenshot_path or screenshot_bytes must be provided")
        
        # Create vision analysis prompt
        prompt = """Analyze this screenshot of a web page and identify all interactive elements.

For each element, provide:
1. Element type (button, input, link, etc.)
2. Text content (if any)
3. Approximate position (x, y coordinates relative to top-left)
4. Size (width, height in pixels)
5. Visual characteristics (color, style hints)
6. Accessibility attributes if visible (aria-label, role hints)

Return a JSON object with:
{
  "elements": [
    {
      "type": "button",
      "text": "Login",
      "position": {"x": 100, "y": 200},
      "size": {"width": 80, "height": 30},
      "visual": {"color": "#007bff"},
      "accessibility": {"role": "button"}
    }
  ],
  "text_elements": [
    {
      "text": "Welcome",
      "position": {"x": 50, "y": 50},
      "type": "heading"
    }
  ],
  "layout": {
    "width": 1920,
    "height": 1080
  }
}"""
        
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
                                    "url": f"data:image/png;base64,{image_base64}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=2000
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
                                "data": image_base64
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
        import json
        if result_text:
            try:
                # Try to extract JSON
                start = result_text.find("{")
                end = result_text.rfind("}") + 1
                if start >= 0 and end > start:
                    result_data = json.loads(result_text[start:end])
                else:
                    result_data = json.loads(result_text)
            except:
                # Fallback: return empty result
                result_data = {"elements": [], "text_elements": [], "layout": {}}
        else:
            # Fallback for non-vision models: return basic structure
            result_data = {
                "elements": [],
                "text_elements": [],
                "layout": {}
            }
        
        return VisionAnalysisResult(
            elements=result_data.get("elements", []),
            text_elements=result_data.get("text_elements", []),
            layout_info=result_data.get("layout")
        )
