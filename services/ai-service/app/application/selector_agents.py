from typing import List, Dict, Any, Optional
from app.domain.models import ElementDescription, ElementSelector
from app.infrastructure.llm.llm_client import LLMClient
import json
import re


class SelectorAgent:
    """Agent that analyzes why selectors failed and proposes new ones"""
    
    def __init__(self, llm_client: LLMClient):
        self.llm_client = llm_client
    
    async def analyze_failure(
        self, 
        target_description: ElementDescription,
        attempted_selectors: List[ElementSelector],
        error_message: str,
        html: str
    ) -> Dict[str, Any]:
        """Analyze why selectors failed and propose solutions"""
        # Handle both dict and object formats
        target_dict = target_description.dict() if hasattr(target_description, 'dict') else (
            target_description if isinstance(target_description, dict) else target_description.__dict__
        )
        selectors_list = [
            s.dict() if hasattr(s, 'dict') else (s if isinstance(s, dict) else s.__dict__)
            for s in attempted_selectors
        ]
        
        prompt = f"""A test step failed to find an element. Analyze why and propose solutions.

Target Description: {json.dumps(target_dict, indent=2)}
Attempted Selectors: {json.dumps(selectors_list, indent=2)}
Error: {error_message}

HTML Context (first 2000 chars):
{html[:2000]}

Analyze:
1. Why did the selectors fail?
2. What might have changed on the page?
3. What alternative selectors could work?

Return JSON:
{{
  "analysis": "Why selectors failed",
  "suggestions": [
    {{
      "selector": {{"type": "id", "value": "#example", "stability_score": 0.85}},
      "reason": "Why this might work"
    }}
  ],
  "confidence": 0.8
}}"""

        try:
            response = await self.llm_client.generate_json(prompt, 
                "You are an expert at debugging test automation selector failures.")
            return response
        except Exception as e:
            return {
                "analysis": f"Analysis failed: {str(e)}",
                "suggestions": [],
                "confidence": 0.0
            }


class DOMAgent:
    """Agent that examines DOM structure to find alternatives"""
    
    def __init__(self):
        pass
    
    async def find_alternatives(
        self,
        target_description: ElementDescription,
        html: str
    ) -> List[ElementSelector]:
        """Find alternative selectors from DOM structure"""
        from bs4 import BeautifulSoup
        
        soup = BeautifulSoup(html, 'html.parser')
        selectors = []
        
        # Search by text
        if target_description.text:
            elements = soup.find_all(string=re.compile(target_description.text, re.I))
            for elem in elements[:5]:  # Limit to 5 matches
                parent = elem.parent
                if parent:
                    # Try to find stable attributes
                    if parent.get('id'):
                        selectors.append({
                            "type": "id",
                            "value": f"#{parent.get('id')}",
                            "stability_score": 0.85
                        })
                    if parent.get('data-testid'):
                        selectors.append({
                            "type": "data-testid",
                            "value": f"[data-testid='{parent.get('data-testid')}']",
                            "stability_score": 0.95
                        })
        
        # Search by role
        if target_description.role:
            elements = soup.find_all(attrs={'role': target_description.role})
            for elem in elements[:5]:
                if elem.get('id'):
                    selectors.append({
                        "type": "id",
                        "value": f"#{elem.get('id')}",
                        "stability_score": 0.85
                    })
        
        return selectors


class VisionAgent:
    """Agent that analyzes screenshots for visual clues"""
    
    def __init__(self, llm_client: LLMClient):
        self.llm_client = llm_client
    
    async def analyze_visual(
        self,
        target_description: ElementDescription,
        screenshot_base64: str
    ) -> List[ElementSelector]:
        """Analyze screenshot to find element visually"""
        prompt = f"""Look at this screenshot and find the element described below.

Target: {json.dumps(target_description.dict() if hasattr(target_description, 'dict') else target_description, indent=2)}

Describe where the element is located visually and suggest how to find it in the DOM.
Return JSON with visual position and suggested selectors."""

        try:
            response = await self.llm_client.generate_json_with_vision(
                prompt,
                screenshot_base64,
                "You are an expert at visual element detection for test automation."
            )
            
            selectors = []
            if 'suggestions' in response:
                for suggestion in response['suggestions']:
                    if 'selector' in suggestion:
                        selectors.append(suggestion['selector'])
            
            return selectors
        except Exception as e:
            return []


class StrategyAgent:
    """Agent that coordinates other agents and makes final decisions"""
    
    def __init__(self, llm_client: LLMClient):
        self.llm_client = llm_client
        self.selector_agent = SelectorAgent(llm_client)
        self.dom_agent = DOMAgent()
        self.vision_agent = VisionAgent(llm_client)
    
    async def discuss_and_resolve(
        self,
        target_description: ElementDescription,
        attempted_selectors: List[ElementSelector],
        error_message: str,
        html: str,
        screenshot_base64: Optional[str] = None
    ) -> Dict[str, Any]:
        """Coordinate agents to discuss and propose solution"""
        # Handle both dict and object formats
        target_dict = target_description.dict() if hasattr(target_description, 'dict') else (
            target_description if isinstance(target_description, dict) else target_description.__dict__
        )
        
        # Get analysis from each agent
        selector_analysis = await self.selector_agent.analyze_failure(
            target_description, attempted_selectors, error_message, html
        )
        
        dom_alternatives = await self.dom_agent.find_alternatives(
            target_description, html
        )
        
        vision_selectors = []
        if screenshot_base64:
            vision_selectors = await self.vision_agent.analyze_visual(
                target_description, screenshot_base64
            )
        
        # Combine all suggestions
        all_suggestions = []
        
        if selector_analysis.get('suggestions'):
            all_suggestions.extend(selector_analysis['suggestions'])
        
        for alt in dom_alternatives:
            all_suggestions.append({
                "selector": alt,
                "reason": "Found in DOM structure",
                "source": "dom_agent"
            })
        
        for vis in vision_selectors:
            all_suggestions.append({
                "selector": vis,
                "reason": "Found via visual analysis",
                "source": "vision_agent"
            })
        
        # Strategy agent makes final decision
        if all_suggestions:
            decision_prompt = f"""Multiple agents have proposed solutions. Make the final decision.

Target: {json.dumps(target_dict, indent=2)}
Error: {error_message}

Agent Suggestions:
{json.dumps(all_suggestions, indent=2)}

Select the best 2-3 selectors to try, ranked by likelihood of success.
Return JSON:
{{
  "decision": "Why this solution",
  "selected_selectors": [
    {{"type": "id", "value": "#example", "stability_score": 0.85, "confidence": 0.9}}
  ],
  "agent_consensus": "What agents agreed on"
}}"""

            try:
                decision = await self.llm_client.generate_json(decision_prompt,
                    "You are a strategy agent coordinating multiple AI agents to solve test automation problems.")
                
                return {
                    "agent_discussion": {
                        "selector_agent": selector_analysis,
                        "dom_agent": {"alternatives_found": len(dom_alternatives)},
                        "vision_agent": {"selectors_found": len(vision_selectors)}
                    },
                    "final_decision": decision,
                    "all_suggestions": all_suggestions
                }
            except Exception as e:
                # Fallback: use first few suggestions
                return {
                    "agent_discussion": {
                        "selector_agent": selector_analysis,
                        "dom_agent": {"alternatives_found": len(dom_alternatives)},
                        "vision_agent": {"selectors_found": len(vision_selectors)}
                    },
                    "final_decision": {
                        "selected_selectors": [s.get('selector', s) for s in all_suggestions[:3]]
                    },
                    "all_suggestions": all_suggestions
                }
        
        return {
            "agent_discussion": {
                "selector_agent": selector_analysis,
                "dom_agent": {"alternatives_found": len(dom_alternatives)},
                "vision_agent": {"selectors_found": len(vision_selectors)}
            },
            "final_decision": {
                "selected_selectors": []
            },
            "all_suggestions": []
        }
