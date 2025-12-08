import os
from typing import Optional
from openai import OpenAI
from anthropic import Anthropic
import json


class LLMClient:
    """Client for interacting with LLM APIs"""
    
    def __init__(self):
        self.openai_client = None
        self.anthropic_client = None
        self.provider = os.getenv("LLM_PROVIDER", "anthropic").lower()
        
        if self.provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            if api_key:
                self.openai_client = OpenAI(api_key=api_key)
        elif self.provider == "anthropic":
            api_key = os.getenv("ANTHROPIC_API_KEY")
            if api_key:
                self.anthropic_client = Anthropic(api_key=api_key)
    
    async def generate_completion(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Generate completion from LLM"""
        if self.provider == "openai" and self.openai_client:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            
            response = self.openai_client.chat.completions.create(
                model=os.getenv("OPENAI_MODEL", "gpt-4"),
                messages=messages,
                temperature=0.3
            )
            return response.choices[0].message.content
        
        elif self.provider == "anthropic" and self.anthropic_client:
            system_message = system_prompt or ""
            model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")
            response = self.anthropic_client.messages.create(
                model=model,
                max_tokens=4096,
                system=system_message,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text
        
        raise ValueError("No LLM provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY")
    
    async def generate_json(self, prompt: str, system_prompt: Optional[str] = None) -> dict:
        """Generate JSON response from LLM"""
        json_prompt = f"{prompt}\n\nRespond with valid JSON only, no markdown formatting."
        response = await self.generate_completion(json_prompt, system_prompt)
        
        # Try to extract JSON from response
        response = response.strip()
        if response.startswith("```json"):
            response = response[7:]
        if response.startswith("```"):
            response = response[3:]
        if response.endswith("```"):
            response = response[:-3]
        response = response.strip()
        
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            # Fallback: try to find JSON object in response
            start = response.find("{")
            end = response.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(response[start:end])
            raise ValueError(f"Could not parse JSON from response: {response[:200]}")
    
    async def generate_with_vision(
        self, 
        prompt: str, 
        screenshot_base64: str,
        system_prompt: Optional[str] = None
    ) -> str:
        """Generate completion using vision-capable model with screenshot"""
        if self.provider == "openai" and self.openai_client:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{screenshot_base64}"
                        }
                    }
                ]
            })
            
            response = self.openai_client.chat.completions.create(
                model=os.getenv("OPENAI_VISION_MODEL", "gpt-4o"),
                messages=messages,
                temperature=0.3,
                max_tokens=4096
            )
            return response.choices[0].message.content
        
        elif self.provider == "anthropic" and self.anthropic_client:
            system_message = system_prompt or ""
            model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")
            
            # Anthropic vision API format
            response = self.anthropic_client.messages.create(
                model=model,
                max_tokens=4096,
                system=system_message,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": screenshot_base64
                            }
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }]
            )
            return response.content[0].text
        
        raise ValueError("No vision-capable LLM provider configured")
    
    async def generate_json_with_vision(
        self,
        prompt: str,
        screenshot_base64: str,
        system_prompt: Optional[str] = None
    ) -> dict:
        """Generate JSON response using vision-capable model"""
        json_prompt = f"{prompt}\n\nRespond with valid JSON only, no markdown formatting."
        response = await self.generate_with_vision(json_prompt, screenshot_base64, system_prompt)
        
        # Try to extract JSON from response
        response = response.strip()
        if response.startswith("```json"):
            response = response[7:]
        if response.startswith("```"):
            response = response[3:]
        if response.endswith("```"):
            response = response[:-3]
        response = response.strip()
        
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            # Fallback: try to find JSON object in response
            start = response.find("{")
            end = response.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(response[start:end])
            raise ValueError(f"Could not parse JSON from response: {response[:200]}")

