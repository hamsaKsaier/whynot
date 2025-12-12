import os
import re
import logging
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
            else:
                raise ValueError("OPENAI_API_KEY environment variable is not set")
        elif self.provider == "anthropic":
            api_key = os.getenv("ANTHROPIC_API_KEY")
            if api_key:
                self.anthropic_client = Anthropic(api_key=api_key)
            else:
                raise ValueError("ANTHROPIC_API_KEY environment variable is not set")
        else:
            raise ValueError(f"Unknown LLM provider: {self.provider}. Set LLM_PROVIDER to 'openai' or 'anthropic'")
    
    async def generate_completion(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Generate completion from LLM"""
        if self.provider == "openai":
            if not self.openai_client:
                raise ValueError("OpenAI client not initialized. Check OPENAI_API_KEY environment variable.")
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            
            try:
                response = self.openai_client.chat.completions.create(
                    model=os.getenv("OPENAI_MODEL", "gpt-4"),
                    messages=messages,
                    temperature=0.3
                )
                return response.choices[0].message.content
            except Exception as e:
                raise ValueError(f"OpenAI API error: {str(e)}")
        
        elif self.provider == "anthropic":
            if not self.anthropic_client:
                raise ValueError("Anthropic client not initialized. Check ANTHROPIC_API_KEY environment variable.")
            system_message = system_prompt or ""
            model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")
            try:
                response = self.anthropic_client.messages.create(
                    model=model,
                    max_tokens=4096,
                    system=system_message,
                    messages=[{"role": "user", "content": prompt}]
                )
                return response.content[0].text
            except Exception as e:
                raise ValueError(f"Anthropic API error: {str(e)}")
        
        raise ValueError(f"No LLM provider configured. Provider: {self.provider}, Set OPENAI_API_KEY or ANTHROPIC_API_KEY")
    
    def _extract_and_repair_json(self, response: str) -> dict:
        """Extract and repair JSON from LLM response"""
        original_response = response
        
        # Step 1: Remove markdown code blocks
        response = response.strip()
        # Remove ```json or ``` markers
        response = re.sub(r'^```(?:json)?\s*', '', response, flags=re.MULTILINE)
        response = re.sub(r'\s*```$', '', response, flags=re.MULTILINE)
        response = response.strip()
        
        # Step 2: Try to find JSON object using regex (more robust than find)
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
        else:
            # Fallback to simple find
            start = response.find("{")
            end = response.rfind("}") + 1
            if start >= 0 and end > start:
                json_str = response[start:end]
            else:
                raise ValueError(f"No JSON object found in response: {response[:200]}")
        
        # Step 3: Try parsing
        try:
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            # Step 4: Attempt JSON repair for common issues
            logging.warning(f"JSON parse error: {e}. Attempting repair...")
            
            # Fix common issues:
            # 1. Unterminated strings - find strings that aren't closed
            # 2. Missing commas between objects
            # 3. Trailing commas
            # 4. Truncated responses
            
            # First, try to fix unterminated strings by finding incomplete string values
            # Look for strings that start with " but don't have a closing "
            in_string = False
            escape_next = False
            fixed_json = []
            i = 0
            while i < len(json_str):
                char = json_str[i]
                if escape_next:
                    fixed_json.append(char)
                    escape_next = False
                    i += 1
                    continue
                if char == '\\':
                    escape_next = True
                    fixed_json.append(char)
                    i += 1
                    continue
                if char == '"':
                    in_string = not in_string
                    fixed_json.append(char)
                elif in_string:
                    fixed_json.append(char)
                else:
                    fixed_json.append(char)
                i += 1
            
            # If we're still in a string at the end, close it
            if in_string:
                fixed_json.append('"')
            
            json_str = ''.join(fixed_json)
            
            # Try to fix unterminated JSON structures by counting braces/brackets
            brace_count = 0
            bracket_count = 0
            fixed_end = len(json_str)
            for i, char in enumerate(json_str):
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                elif char == '[':
                    bracket_count += 1
                elif char == ']':
                    bracket_count -= 1
                
                # If we've closed all structures, this might be a good end point
                if brace_count == 0 and bracket_count == 0 and i > 0:
                    # But only if we're not in the middle of a string
                    # Check if we're in a string by counting quotes before this point
                    quotes_before = json_str[:i+1].count('"')
                    if quotes_before % 2 == 0:  # Even number means we're not in a string
                        fixed_end = i + 1
                        break
            
            # If structures are still open, close them
            if brace_count > 0 or bracket_count > 0:
                json_str = json_str[:fixed_end]
                # Close any open brackets first
                while bracket_count > 0:
                    json_str += ']'
                    bracket_count -= 1
                # Then close any open braces
                while brace_count > 0:
                    json_str += '}'
                    brace_count -= 1
            
            # Remove trailing commas before } or ]
            json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
            
            # Try parsing again
            try:
                return json.loads(json_str)
            except json.JSONDecodeError as e2:
                # Log the problematic section with more context
                error_pos = getattr(e2, 'pos', 0)
                start_context = max(0, error_pos - 200)
                end_context = min(len(json_str), error_pos + 200)
                context = json_str[start_context:end_context]
                line_num = json_str[:error_pos].count('\n') + 1
                col_num = error_pos - json_str[:error_pos].rfind('\n') - 1
                logging.error(f"JSON repair failed. Error at line {line_num}, column {col_num} (position {error_pos}): {e2}")
                logging.error(f"Context (200 chars before/after): ...{context}...")
                logging.error(f"Full response length: {len(original_response)} chars")
                logging.error(f"JSON string length: {len(json_str)} chars")
                raise ValueError(
                    f"Could not parse or repair JSON. Error at line {line_num}, column {col_num}: {e2}. "
                    f"Response preview: {original_response[:500]}"
                )
    
    async def generate_json(self, prompt: str, system_prompt: Optional[str] = None) -> dict:
        """Generate JSON response from LLM"""
        json_prompt = f"{prompt}\n\nRespond with valid JSON only, no markdown formatting."
        response = await self.generate_completion(json_prompt, system_prompt)
        return self._extract_and_repair_json(response)
    
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
        
        elif self.provider == "anthropic":
            if not self.anthropic_client:
                raise ValueError("Anthropic client not initialized. Check ANTHROPIC_API_KEY environment variable.")
            system_message = system_prompt or ""
            model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")
            
            try:
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
            except Exception as e:
                raise ValueError(f"Anthropic API error: {str(e)}")
        
        raise ValueError(f"No vision-capable LLM provider configured. Provider: {self.provider}")
    
    async def generate_json_with_vision(
        self,
        prompt: str,
        screenshot_base64: str,
        system_prompt: Optional[str] = None
    ) -> dict:
        """Generate JSON response using vision-capable model"""
        json_prompt = f"{prompt}\n\nRespond with valid JSON only, no markdown formatting."
        response = await self.generate_with_vision(json_prompt, screenshot_base64, system_prompt)
        return self._extract_and_repair_json(response)

