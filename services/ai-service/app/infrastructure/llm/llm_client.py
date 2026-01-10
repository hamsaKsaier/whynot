import os
import re
import logging
from typing import Optional
from openai import OpenAI
from anthropic import Anthropic
import json
import time


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
            model = os.getenv("ANTHROPIC_MODEL", "claude-opus-4-5-20251101")
            try:
                response = self.anthropic_client.messages.create(
                    model=model,
                    max_tokens=8192,  # Increased to handle large JSON responses with many test steps
                    system=system_message,
                    messages=[{"role": "user", "content": prompt}]
                )
                return response.content[0].text
            except Exception as e:
                raise ValueError(f"Anthropic API error: {str(e)}")
        
        raise ValueError(f"No LLM provider configured. Provider: {self.provider}, Set OPENAI_API_KEY or ANTHROPIC_API_KEY")
    
    def _fix_missing_commas_safe(self, text):
        """Fix missing commas while respecting string boundaries"""
        result = []
        in_string = False
        escape_next = False
        i = 0
        while i < len(text):
            char = text[i]
            if escape_next:
                result.append(char)
                escape_next = False
                i += 1
                continue
            if char == '\\':
                escape_next = True
                result.append(char)
                i += 1
                continue
            if char == '"':
                in_string = not in_string
                result.append(char)
                i += 1
                continue
            if in_string:
                result.append(char)
                i += 1
                continue
            
            # Outside strings: look for patterns that need commas
            # Pattern: } or ] followed by whitespace and then " (new key)
            if (char == '}' or char == ']') and i < len(text) - 1:
                # Skip whitespace
                j = i + 1
                while j < len(text) and text[j] in ' \t\n\r':
                    j += 1
                if j < len(text) and text[j] == '"':
                    # Check if there's already a comma between
                    has_comma = False
                    for k in range(i+1, j):
                        if text[k] == ',':
                            has_comma = True
                            break
                    if not has_comma:
                        result.append(char)
                        result.append(',')
                        i += 1
                        continue
            
            result.append(char)
            i += 1
        return ''.join(result)
    
    def _extract_and_repair_json(self, response: str) -> dict:
        """Extract and repair JSON from LLM response"""
        # #region agent log
        try:
            log_data = {
                "sessionId": "debug-session",
                "runId": "run1",
                "hypothesisId": "A",
                "location": "llm_client.py:_extract_and_repair_json:entry",
                "message": "Starting JSON extraction",
                "data": {
                    "original_response_length": len(response),
                    "original_response_preview": response[:500] if len(response) > 500 else response,
                    "original_response_suffix": response[-200:] if len(response) > 200 else ""
                },
                "timestamp": int(time.time() * 1000)
            }
            with open("/Users/takiacademy/whynot/.cursor/debug.log", "a") as f:
                f.write(json.dumps(log_data) + "\n")
        except:
            pass
        # #endregion
        
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
        
        # #region agent log
        try:
            log_data = {
                "sessionId": "debug-session",
                "runId": "run1",
                "hypothesisId": "B",
                "location": "llm_client.py:_extract_and_repair_json:extracted",
                "message": "JSON extracted from response",
                "data": {
                    "extracted_json_length": len(json_str),
                    "extracted_json_preview": json_str[:500] if len(json_str) > 500 else json_str,
                    "extracted_json_suffix": json_str[-200:] if len(json_str) > 200 else ""
                },
                "timestamp": int(time.time() * 1000)
            }
            with open("/Users/takiacademy/whynot/.cursor/debug.log", "a") as f:
                f.write(json.dumps(log_data) + "\n")
        except:
            pass
        # #endregion
        
        # Step 3: Try parsing
        try:
            parsed = json.loads(json_str)
            # #region agent log
            try:
                log_data = {
                    "sessionId": "debug-session",
                    "runId": "run1",
                    "hypothesisId": "C",
                    "location": "llm_client.py:_extract_and_repair_json:parse_success",
                    "message": "JSON parsed successfully on first attempt",
                    "data": {"parsed_keys": list(parsed.keys()) if isinstance(parsed, dict) else "not_dict"},
                    "timestamp": int(time.time() * 1000)
                }
                with open("/Users/takiacademy/whynot/.cursor/debug.log", "a") as f:
                    f.write(json.dumps(log_data) + "\n")
            except:
                pass
            # #endregion
            return parsed
        except json.JSONDecodeError as e:
            # #region agent log
            error_pos = getattr(e, 'pos', 0)
            error_msg = str(e)
            try:
                log_data = {
                    "sessionId": "debug-session",
                    "runId": "run1",
                    "hypothesisId": "D",
                    "location": "llm_client.py:_extract_and_repair_json:parse_error",
                    "message": "JSON parse error detected",
                    "data": {
                        "error": error_msg,
                        "error_position": error_pos,
                        "error_line": json_str[:error_pos].count('\n') + 1,
                        "error_column": error_pos - json_str[:error_pos].rfind('\n') - 1,
                        "context_before": json_str[max(0, error_pos-100):error_pos],
                        "context_after": json_str[error_pos:min(len(json_str), error_pos+100)]
                    },
                    "timestamp": int(time.time() * 1000)
                }
                with open("/Users/takiacademy/whynot/.cursor/debug.log", "a") as f:
                    f.write(json.dumps(log_data) + "\n")
            except:
                pass
            # #endregion
            
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
            
            # NEW: Fix missing commas between array elements and object properties
            # Use regex patterns that work outside of strings
            # First, fix obvious patterns: ] [ and } {
            json_str = re.sub(r'\]\s*\[', '],[', json_str)
            json_str = re.sub(r'\}\s*\{', '},{', json_str)
            
            # Fix missing commas between object properties using safe method
            json_str = self._fix_missing_commas_safe(json_str)
            
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
            
            # #region agent log
            try:
                log_data = {
                    "sessionId": "debug-session",
                    "runId": "run1",
                    "hypothesisId": "E",
                    "location": "llm_client.py:_extract_and_repair_json:before_second_parse",
                    "message": "Attempting second parse after repair",
                    "data": {
                        "repaired_json_length": len(json_str),
                        "repaired_json_preview": json_str[:500] if len(json_str) > 500 else json_str,
                        "repaired_json_around_error": json_str[max(0, error_pos-200):min(len(json_str), error_pos+200)]
                    },
                    "timestamp": int(time.time() * 1000)
                }
                with open("/Users/takiacademy/whynot/.cursor/debug.log", "a") as f:
                    f.write(json.dumps(log_data) + "\n")
            except:
                pass
            # #endregion
            
            # Try parsing again
            try:
                parsed = json.loads(json_str)
                # #region agent log
                try:
                    log_data = {
                        "sessionId": "debug-session",
                        "runId": "run1",
                        "hypothesisId": "F",
                        "location": "llm_client.py:_extract_and_repair_json:repair_success",
                        "message": "JSON repair successful",
                        "data": {"parsed_keys": list(parsed.keys()) if isinstance(parsed, dict) else "not_dict"},
                        "timestamp": int(time.time() * 1000)
                    }
                    with open("/Users/takiacademy/whynot/.cursor/debug.log", "a") as f:
                        f.write(json.dumps(log_data) + "\n")
                except:
                    pass
                # #endregion
                return parsed
            except json.JSONDecodeError as e2:
                # Log the problematic section with more context
                error_pos = getattr(e2, 'pos', 0)
                start_context = max(0, error_pos - 200)
                end_context = min(len(json_str), error_pos + 200)
                context = json_str[start_context:end_context]
                line_num = json_str[:error_pos].count('\n') + 1
                col_num = error_pos - json_str[:error_pos].rfind('\n') - 1
                
                # #region agent log
                try:
                    log_data = {
                        "sessionId": "debug-session",
                        "runId": "run1",
                        "hypothesisId": "G",
                        "location": "llm_client.py:_extract_and_repair_json:repair_failed",
                        "message": "JSON repair failed after all attempts",
                        "data": {
                            "error": str(e2),
                            "error_position": error_pos,
                            "error_line": line_num,
                            "error_column": col_num,
                            "context": context,
                            "original_response_length": len(original_response),
                            "json_string_length": len(json_str),
                            "original_response_preview": original_response[:500]
                        },
                        "timestamp": int(time.time() * 1000)
                    }
                    with open("/Users/takiacademy/whynot/.cursor/debug.log", "a") as f:
                        f.write(json.dumps(log_data) + "\n")
                except:
                    pass
                # #endregion
                
                logging.error(f"JSON repair failed. Error at line {line_num}, column {col_num} (position {error_pos}): {e2}")
                logging.error(f"Context (200 chars before/after): ...{context}...")
                logging.error(f"Full response length: {len(original_response)} chars")
                logging.error(f"JSON string length: {len(json_str)} chars")
                
                # Try one more aggressive repair: apply _fix_missing_commas_safe again
                # Sometimes the first pass doesn't catch all cases
                try:
                    aggressive_fix = self._fix_missing_commas_safe(json_str)
                    # Also try regex fixes one more time
                    aggressive_fix = re.sub(r'\]\s*\[', '],[', aggressive_fix)
                    aggressive_fix = re.sub(r'\}\s*\{', '},{', aggressive_fix)
                    
                    # Try parsing the aggressively fixed version
                    parsed = json.loads(aggressive_fix)
                    # #region agent log
                    try:
                        log_data = {
                            "sessionId": "debug-session",
                            "runId": "run1",
                            "hypothesisId": "H",
                            "location": "llm_client.py:_extract_and_repair_json:aggressive_repair_success",
                            "message": "Aggressive JSON repair successful",
                            "data": {"parsed_keys": list(parsed.keys()) if isinstance(parsed, dict) else "not_dict"},
                            "timestamp": int(time.time() * 1000)
                        }
                        with open("/Users/takiacademy/whynot/.cursor/debug.log", "a") as f:
                            f.write(json.dumps(log_data) + "\n")
                    except:
                        pass
                    # #endregion
                    return parsed
                except Exception as repair_error:
                    # #region agent log
                    try:
                        log_data = {
                            "sessionId": "debug-session",
                            "runId": "run1",
                            "hypothesisId": "I",
                            "location": "llm_client.py:_extract_and_repair_json:aggressive_repair_failed",
                            "message": "Aggressive repair also failed",
                            "data": {"repair_error": str(repair_error)},
                            "timestamp": int(time.time() * 1000)
                        }
                        with open("/Users/takiacademy/whynot/.cursor/debug.log", "a") as f:
                            f.write(json.dumps(log_data) + "\n")
                    except:
                        pass
                    # #endregion
                    pass
                
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
            model = os.getenv("ANTHROPIC_MODEL", "claude-opus-4-5-20251101")
            
            try:
                # Anthropic vision API format
                response = self.anthropic_client.messages.create(
                    model=model,
                    max_tokens=8192,  # Increased to handle large JSON responses with many test steps
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

