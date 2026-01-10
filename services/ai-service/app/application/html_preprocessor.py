import re
from typing import Optional
from bs4 import BeautifulSoup
from app.infrastructure.llm.llm_client import LLMClient


class HTMLPreProcessor:
    """Pre-processes HTML to remove unnecessary content before sending to Claude"""
    
    def __init__(self):
        self._llm_client = None
    
    @property
    def llm_client(self):
        """Lazy initialization of LLM client"""
        if self._llm_client is None:
            self._llm_client = LLMClient()
        return self._llm_client
    
    def clean_html_simple(self, html: str) -> str:
        """
        Simple HTML cleaning without AI - removes scripts, styles, comments
        This is fast and cost-free
        """
        soup = BeautifulSoup(html, 'html.parser')
        
        # Remove script tags
        for script in soup.find_all('script'):
            script.decompose()
        
        # Remove style tags
        for style in soup.find_all('style'):
            style.decompose()
        
        # Remove comments
        from bs4 import Comment
        for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
            comment.extract()
        
        # Remove hidden elements
        for element in soup.find_all(attrs={'style': re.compile(r'display\s*:\s*none|visibility\s*:\s*hidden', re.I)}):
            element.decompose()
        
        # Remove elements with hidden attribute
        for element in soup.find_all(attrs={'hidden': True}):
            element.decompose()
        
        # Keep only relevant attributes
        for tag in soup.find_all():
            # Keep important attributes
            attrs_to_keep = ['id', 'class', 'name', 'type', 'role', 'aria-label', 
                           'data-testid', 'data-cy', 'href', 'src', 'alt', 'placeholder',
                           'for', 'value', 'disabled', 'required', 'checked', 'selected']
            
            # Remove attributes not in keep list
            attrs_to_remove = [attr for attr in tag.attrs.keys() if attr not in attrs_to_keep]
            for attr in attrs_to_remove:
                del tag.attrs[attr]
        
        return str(soup)
    
    async def clean_html_with_ai(self, html: str) -> str:
        """
        Advanced HTML cleaning with AI - extracts semantic structure
        Uses lightweight LLM to identify and keep only interactive elements
        """
        # First do simple cleaning
        cleaned = self.clean_html_simple(html)
        
        # If HTML is still too large, use AI to extract semantic structure
        if len(cleaned) > 10000:
            prompt = f"""Analyze this HTML and extract only the essential structure for test automation.

Keep:
- Interactive elements (buttons, inputs, links, forms)
- Text content that's visible to users
- Structural elements (headings, lists, navigation)
- Important attributes (id, class, data-testid, aria-label, role, href, placeholder)

Remove:
- Decorative elements
- Redundant nested structures
- Inline styles (keep only class names)
- Metadata that's not relevant for testing

Return only the cleaned HTML structure, no explanations.

HTML to clean:
{cleaned[:5000]}"""

            try:
                response = await self.llm_client.generate_completion(prompt, 
                    "You are an expert at cleaning HTML for test automation. Extract only essential structure.")
                
                # Extract HTML from response (might be wrapped in markdown)
                html_match = re.search(r'<html.*?</html>', response, re.DOTALL | re.IGNORECASE)
                if html_match:
                    return html_match.group(0)
                
                # Try to find HTML-like content
                html_match = re.search(r'<[^>]+>.*?</[^>]+>', response, re.DOTALL)
                if html_match:
                    return html_match.group(0)
                
                # Fallback to simple cleaning
                return cleaned[:10000]
            except Exception as e:
                print(f"AI HTML cleaning failed, using simple cleaning: {e}")
                return cleaned[:10000]
        
        return cleaned
    
    def clean_html(self, html: str, use_ai: bool = False) -> str:
        """
        Main cleaning method
        Args:
            html: Raw HTML content
            use_ai: Whether to use AI for advanced cleaning (default: False for speed)
        Returns:
            Cleaned HTML
        """
        if use_ai:
            import asyncio
            return asyncio.run(self.clean_html_with_ai(html))
        else:
            return self.clean_html_simple(html)
    
    def extract_semantic_structure(self, html: str) -> dict:
        """
        Extract semantic structure from HTML for better context
        Returns structured data about the page
        """
        soup = BeautifulSoup(html, 'html.parser')
        
        structure = {
            'forms': [],
            'buttons': [],
            'inputs': [],
            'links': [],
            'headings': []
        }
        
        # Extract forms
        for form in soup.find_all('form'):
            structure['forms'].append({
                'id': form.get('id'),
                'action': form.get('action'),
                'method': form.get('method')
            })
        
        # Extract buttons
        for button in soup.find_all(['button', 'input'], type=['button', 'submit']):
            structure['buttons'].append({
                'text': button.get_text(strip=True),
                'id': button.get('id'),
                'class': button.get('class'),
                'data-testid': button.get('data-testid')
            })
        
        # Extract inputs
        for input_elem in soup.find_all('input'):
            structure['inputs'].append({
                'type': input_elem.get('type'),
                'id': input_elem.get('id'),
                'name': input_elem.get('name'),
                'placeholder': input_elem.get('placeholder'),
                'aria-label': input_elem.get('aria-label')
            })
        
        # Extract links
        for link in soup.find_all('a', href=True):
            structure['links'].append({
                'text': link.get_text(strip=True),
                'href': link.get('href'),
                'id': link.get('id')
            })
        
        # Extract headings
        for heading in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
            structure['headings'].append({
                'level': heading.name,
                'text': heading.get_text(strip=True)
            })
        
        return structure














