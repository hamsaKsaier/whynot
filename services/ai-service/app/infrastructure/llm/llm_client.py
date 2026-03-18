import os
import re
import logging
import asyncio
from typing import Optional, Callable, Any
from openai import OpenAI
from anthropic import AsyncAnthropic   # async client — does not block the event loop (3.8)
import json

# Transient HTTP status codes that warrant a retry with exponential back-off (3.4)
_RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})
_MAX_RETRIES = 3


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
                # Use the async client so .messages.create() is a coroutine and
                # does not block the FastAPI event loop (3.8)
                self.anthropic_client = AsyncAnthropic(api_key=api_key)
            else:
                raise ValueError("ANTHROPIC_API_KEY environment variable is not set")
        else:
            raise ValueError(f"Unknown LLM provider: {self.provider}. Set LLM_PROVIDER to 'openai' or 'anthropic'")
    
    async def _anthropic_with_retry(self, coro_factory: Callable[[], Any]) -> Any:
        """Execute an Anthropic API coroutine with exponential back-off retry (3.4).

        coro_factory must be a *callable* that returns a fresh coroutine each
        time it is called (lambdas work perfectly).  Retries on transient errors
        (429 / 5xx) up to _MAX_RETRIES times with 1 s → 2 s → 4 s delays.
        Non-transient errors are re-raised immediately.
        """
        for attempt in range(_MAX_RETRIES):
            try:
                return await coro_factory()
            except Exception as e:
                status = (
                    getattr(e, "status_code", None)
                    or getattr(getattr(e, "response", None), "status_code", None)
                )
                if status in _RETRY_STATUSES and attempt < _MAX_RETRIES - 1:
                    delay = 2 ** attempt  # 1 s, 2 s, 4 s
                    logging.warning(
                        f"Anthropic transient error (status {status}), "
                        f"retrying in {delay}s (attempt {attempt + 1}/{_MAX_RETRIES})"
                    )
                    await asyncio.sleep(delay)
                else:
                    raise

    async def generate_completion(self, prompt: str, system_prompt: Optional[str] = None, max_tokens: int = 8192) -> str:
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
            model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
            try:
                response = await self._anthropic_with_retry(
                    lambda: self.anthropic_client.messages.create(
                        model=model,
                        max_tokens=max_tokens,
                        system=system_message,
                        messages=[{"role": "user", "content": prompt}]
                    )
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
    
    async def _generate_with_tool_use(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 8192
    ) -> dict:
        """Generate structured JSON via Anthropic tool_use — guarantees valid JSON output.

        Uses tool_choice={"type":"tool","name":"return_result"} so the model is forced
        to populate the tool-input dict, which the SDK parses automatically.  No text
        repair needed.
        """
        system_message = system_prompt or ""
        model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
        tool = {
            "name": "return_result",
            "description": "Return the complete structured result as valid JSON",
            "input_schema": {
                "type": "object",
                "properties": {},
                "additionalProperties": True,
            },
        }
        try:
            response = await self._anthropic_with_retry(
                lambda: self.anthropic_client.messages.create(
                    model=model,
                    max_tokens=max_tokens,
                    system=system_message,
                    tools=[tool],
                    tool_choice={"type": "tool", "name": "return_result"},
                    messages=[{"role": "user", "content": prompt}],
                )
            )
            for block in response.content:
                if block.type == "tool_use" and block.name == "return_result":
                    return block.input  # already a dict; no JSON parsing needed
            raise ValueError("No tool_use block found in Anthropic response")
        except Exception as e:
            raise ValueError(f"Anthropic tool_use generation error: {str(e)}")

    async def _generate_with_tool_use_vision(
        self,
        prompt: str,
        screenshot_base64: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 8192
    ) -> dict:
        """Generate structured JSON via Anthropic tool_use with an inline screenshot.

        Identical to _generate_with_tool_use but includes the image in the user message.
        """
        system_message = system_prompt or ""
        model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
        tool = {
            "name": "return_result",
            "description": "Return the complete structured result as valid JSON",
            "input_schema": {
                "type": "object",
                "properties": {},
                "additionalProperties": True,
            },
        }
        try:
            response = await self._anthropic_with_retry(
                lambda: self.anthropic_client.messages.create(
                    model=model,
                    max_tokens=max_tokens,
                    system=system_message,
                    tools=[tool],
                    tool_choice={"type": "tool", "name": "return_result"},
                    messages=[{
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": screenshot_base64,
                                },
                            },
                            {"type": "text", "text": prompt},
                        ],
                    }],
                )
            )
            for block in response.content:
                if block.type == "tool_use" and block.name == "return_result":
                    return block.input
            raise ValueError("No tool_use block found in Anthropic vision response")
        except Exception as e:
            raise ValueError(f"Anthropic tool_use vision generation error: {str(e)}")

    def _extract_and_repair_json(self, response: str) -> dict:
        """Extract and repair JSON from LLM response (OpenAI fallback only)."""
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
            parsed = json.loads(json_str)
            return parsed
        except json.JSONDecodeError as e:
            error_pos = getattr(e, 'pos', 0)
            error_msg = str(e)
            
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

            # Try parsing again
            try:
                parsed = json.loads(json_str)
                return parsed
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
                
                # Try one more aggressive repair: apply _fix_missing_commas_safe again
                # Sometimes the first pass doesn't catch all cases
                try:
                    aggressive_fix = self._fix_missing_commas_safe(json_str)
                    # Also try regex fixes one more time
                    aggressive_fix = re.sub(r'\]\s*\[', '],[', aggressive_fix)
                    aggressive_fix = re.sub(r'\}\s*\{', '},{', aggressive_fix)
                    
                    # Try parsing the aggressively fixed version
                    parsed = json.loads(aggressive_fix)
                    return parsed
                except Exception as repair_error:
                    pass
                
                # Try to detect and fix incomplete JSON (truncated field values)
                # The error shows: "expected_outcome": "expected_" - an incomplete string value
                try:
                    before_error = json_str[:error_pos]
                    
                    # Find incomplete string values: patterns like "field": "incomplete_text without closing quote
                    # Look backwards from error position to find the last opening quote of a string value
                    last_quote_pos = before_error.rfind('"')
                    if last_quote_pos >= 0:
                        # Check if we're in a string value (there's a colon before the quote)
                        before_quote = before_error[:last_quote_pos].rstrip()
                        # Look for the colon that indicates this is a value, not a key
                        if ':' in before_quote[-50:]:  # Check last 50 chars before quote
                            # We're likely in an incomplete string value
                            # Find where the incomplete string starts (after the opening quote)
                            incomplete_value_start = last_quote_pos + 1
                            
                            # Close the incomplete string at the error position
                            # Check what's at error_pos - if it's not a quote, we need to insert one
                            incomplete_fix = json_str[:error_pos]
                            if incomplete_fix[-1] != '"':
                                incomplete_fix += '"'  # Close the incomplete string
                            
                            # Now close all incomplete structures
                            # Count remaining open structures
                            remaining_braces = incomplete_fix.count('{') - incomplete_fix.count('}')
                            remaining_brackets = incomplete_fix.count('[') - incomplete_fix.count(']')
                            
                            # Close all remaining structures at the end
                            incomplete_fix += ']' * max(0, remaining_brackets)
                            incomplete_fix += '}' * max(0, remaining_braces)
                            
                            # Remove trailing commas before closing brackets
                            incomplete_fix = re.sub(r',(\s*[}\]])', r'\1', incomplete_fix)
                            
                            # Try to parse the fixed version
                            try:
                                parsed = json.loads(incomplete_fix)
                                logging.warning(f"Fixed incomplete JSON by closing truncated string field at position {error_pos}")
                                return parsed
                            except json.JSONDecodeError as fix_parse_error:
                                logging.debug(f"First fix attempt failed: {fix_parse_error}, trying alternative")
                                # If closing the string didn't work, the field might be too incomplete
                                # Fall through to the alternative fix below
                                # Alternative: Remove the incomplete field entirely
                                # Find pattern: ,"field": "incomplete_text without closing quote
                                # Try multiple patterns to catch different cases
                                incomplete_field_patterns = [
                                    r',\s*"([^"]+)":\s*"([^"]*)$',  # Pattern: ,"field": "incomplete (at end of string)
                                    r'^\s*"([^"]+)":\s*"([^"]*)$',  # Pattern: "field": "incomplete (at start, no comma)
                                    r',\s*"([^"]+)":\s*"([^"]+)$',  # Pattern: ,"field": "incomplete_no_quote (no closing quote)
                                ]
                                
                                incomplete_match = None
                                for pattern in incomplete_field_patterns:
                                    incomplete_match = re.search(pattern, before_error, re.MULTILINE)
                                    if incomplete_match:
                                        break
                                
                                if incomplete_match:
                                    field_name = incomplete_match.group(1)
                                    incomplete_value = incomplete_match.group(2) if len(incomplete_match.groups()) > 1 else ''
                                    logging.warning(f"Detected incomplete field '{field_name}' with incomplete value: '{incomplete_value}...'")
                                    # Remove the incomplete field (everything from the comma before the field)
                                    simple_fix = json_str[:incomplete_match.start()]
                                    
                                    # Close all structures
                                    simple_braces = simple_fix.count('{') - simple_fix.count('}')
                                    simple_brackets = simple_fix.count('[') - simple_fix.count(']')
                                    simple_fix += ']' * max(0, simple_brackets)
                                    simple_fix += '}' * max(0, simple_braces)
                                    simple_fix = re.sub(r',(\s*[}\]])', r'\1', simple_fix)
                                    
                                    try:
                                        parsed = json.loads(simple_fix)
                                        logging.warning(f"Fixed incomplete JSON by removing truncated field '{field_name}'")
                                        return parsed
                                    except json.JSONDecodeError as alt_error:
                                        logging.debug(f"Alternative fix also failed: {alt_error}")
                                        pass
                except Exception as incomplete_fix_error:
                    logging.debug(f"Incomplete JSON fix attempt failed: {incomplete_fix_error}")
                    pass
                
                # Last resort: Try to salvage partial JSON by removing the incomplete field
                # This is better than failing completely
                try:
                    # Find the last incomplete field and remove it
                    salvage_fix = json_str[:error_pos]
                    
                    # Look for the incomplete field pattern: ,"field": "incomplete (without closing quote)
                    # Try multiple patterns to find incomplete fields
                    incomplete_field_patterns = [
                        r',\s*"([^"]+)":\s*"([^"]*)$',  # Pattern: ,"field": "incomplete
                        r'"([^"]+)":\s*"([^"]*)$',     # Pattern: "field": "incomplete (at start of object)
                        r',\s*"([^"]+)":\s*"[^"]*[^"]$', # Pattern: ,"field": "incomplete without quote
                    ]
                    
                    salvage_match = None
                    for pattern in incomplete_field_patterns:
                        salvage_match = re.search(pattern, salvage_fix)
                        if salvage_match:
                            break
                    
                    if salvage_match:
                        field_name = salvage_match.group(1) if len(salvage_match.groups()) > 0 else 'unknown'
                        incomplete_value = salvage_match.group(2) if len(salvage_match.groups()) > 1 else ''
                        logging.warning(f"Removing incomplete field '{field_name}' with incomplete value '{incomplete_value}...' to salvage JSON")
                        # Remove the incomplete field (from comma or start to end of field)
                        salvage_fix = salvage_fix[:salvage_match.start()]
                    
                    # Close all structures properly
                    salvage_braces = salvage_fix.count('{') - salvage_fix.count('}')
                    salvage_brackets = salvage_fix.count('[') - salvage_fix.count(']')
                    salvage_fix += ']' * max(0, salvage_brackets)
                    salvage_fix += '}' * max(0, salvage_braces)
                    salvage_fix = re.sub(r',(\s*[}\]])', r'\1', salvage_fix)
                    
                    # Try to parse the salvaged JSON
                    parsed = json.loads(salvage_fix)
                    logging.warning(f"Salvaged incomplete JSON by removing truncated field (error at position {error_pos}, line {line_num})")
                    return parsed
                except json.JSONDecodeError as salvage_parse_error:
                    logging.debug(f"Salvage parse failed: {salvage_parse_error}, trying manual fix for 'expected_outcome'")
                    # Manual fix: Specifically handle the "expected_outcome": "expected_" case
                    # Look for this exact pattern in the error context
                    if 'expected_outcome' in str(e2) or 'expected_' in str(e2):
                        # Find the incomplete expected_outcome field and remove it
                        expected_outcome_pattern = r',\s*"expected_outcome":\s*"[^"]*$'
                        expected_match = re.search(expected_outcome_pattern, json_str[:error_pos], re.MULTILINE)
                        if expected_match:
                            manual_fix = json_str[:expected_match.start()]
                            # Close structures
                            manual_braces = manual_fix.count('{') - manual_fix.count('}')
                            manual_brackets = manual_fix.count('[') - manual_fix.count(']')
                            manual_fix += ']' * max(0, manual_brackets)
                            manual_fix += '}' * max(0, manual_braces)
                            manual_fix = re.sub(r',(\s*[}\]])', r'\1', manual_fix)
                            try:
                                parsed = json.loads(manual_fix)
                                logging.warning(f"Salvaged JSON by manually removing incomplete 'expected_outcome' field")
                                return parsed
                            except:
                                pass
                    logging.error(f"Could not salvage JSON: {salvage_parse_error}")
                    pass
                except Exception as salvage_error:
                    logging.error(f"Salvage attempt failed with exception: {salvage_error}")
                    pass
                
                raise ValueError(
                    f"Could not parse or repair JSON. Error at line {line_num}, column {col_num}: {e2}. "
                    f"Response preview: {original_response[:500]}"
                )
    
    async def generate_json(self, prompt: str, system_prompt: Optional[str] = None, max_tokens: int = 8192) -> dict:
        """Generate JSON response from LLM.

        For Anthropic: uses tool_use to guarantee syntactically valid JSON with no repair needed.
        For OpenAI: falls back to text generation + _extract_and_repair_json.
        """
        if self.provider == "anthropic" and self.anthropic_client:
            return await self._generate_with_tool_use(prompt, system_prompt, max_tokens)

        # OpenAI fallback: generate text then repair
        json_prompt = f"{prompt}\n\nIMPORTANT: Respond with COMPLETE, valid JSON only. Ensure all field values are complete and properly closed. Do not truncate responses. No markdown formatting."
        response = await self.generate_completion(json_prompt, system_prompt, max_tokens)

        # Check if response might be truncated (very long responses can hit token limits)
        if len(response) > 25000:
            logging.warning(f"Received very long response ({len(response)} chars), may be truncated - attempting repair")

        return self._extract_and_repair_json(response)
    
    async def generate_with_vision(
        self,
        prompt: str,
        screenshot_base64: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 8192
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
            model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
            
            try:
                # Anthropic vision API format — awaited via async client (3.8), with retry (3.4)
                response = await self._anthropic_with_retry(
                    lambda: self.anthropic_client.messages.create(
                        model=model,
                        max_tokens=max_tokens,
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
                )
                return response.content[0].text
            except Exception as e:
                raise ValueError(f"Anthropic API error: {str(e)}")
        
        raise ValueError(f"No vision-capable LLM provider configured. Provider: {self.provider}")
    
    async def generate_json_with_vision(
        self,
        prompt: str,
        screenshot_base64: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 8192
    ) -> dict:
        """Generate JSON response using vision-capable model.

        For Anthropic: uses tool_use with inline image for guaranteed valid JSON.
        For OpenAI: falls back to text generation + _extract_and_repair_json.
        """
        if self.provider == "anthropic" and self.anthropic_client:
            return await self._generate_with_tool_use_vision(prompt, screenshot_base64, system_prompt, max_tokens)

        # OpenAI fallback
        json_prompt = f"{prompt}\n\nRespond with valid JSON only, no markdown formatting."
        response = await self.generate_with_vision(json_prompt, screenshot_base64, system_prompt, max_tokens)
        return self._extract_and_repair_json(response)

