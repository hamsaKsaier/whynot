#!/usr/bin/env python3
"""
Example Python script to test WhyNot
"""

import requests
import json
import time

GATEWAY_URL = "http://localhost:3000"

def run_test(website_url: str, user_story: str, headless: bool = True):
    """Run a test using the WhyNot"""
    
    payload = {
        "website_url": website_url,
        "user_story": user_story,
        "headless": headless
    }
    
    print(f"🚀 Running test for: {website_url}")
    print(f"📝 User Story: {user_story}")
    print("")
    
    try:
        response = requests.post(
            f"{GATEWAY_URL}/api/run-test",
            json=payload,
            timeout=300  # 5 minute timeout
        )
        
        if response.status_code == 200:
            result = response.json()
            
            if result.get("success"):
                summary = result.get("summary", {})
                print("✅ Test completed successfully!")
                print(f"   Test: {summary.get('test_name')}")
                print(f"   Status: {summary.get('status')}")
                print(f"   Steps: {summary.get('passed_steps')}/{summary.get('total_steps')} passed")
                print(f"   Duration: {summary.get('duration_ms')}ms")
                print("")
                
                # Show execution result
                exec_result = result.get("execution_result", {})
                steps = exec_result.get("steps", [])
                
                print("📋 Step Results:")
                for step in steps:
                    status = "✅" if step.get("success") else "❌"
                    print(f"   {status} {step.get('step_id')}: {step.get('execution_time_ms')}ms")
                    if not step.get("success"):
                        print(f"      Error: {step.get('error')}")
                
                return result
            else:
                print(f"❌ Test failed: {result.get('error')}")
                return None
        else:
            print(f"❌ API Error: {response.status_code}")
            print(response.text)
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return None

def generate_tests_only(website_url: str, user_story: str):
    """Generate test cases without executing them"""
    
    payload = {
        "website_url": website_url,
        "user_story": user_story
    }
    
    print(f"🧠 Generating test cases for: {website_url}")
    print("")
    
    try:
        response = requests.post(
            f"{GATEWAY_URL}/api/generate-tests",
            json=payload,
            timeout=60
        )
        
        if response.status_code == 200:
            result = response.json()
            test_cases = result.get("test_cases", [])
            
            print(f"✅ Generated {len(test_cases)} test case(s)")
            print("")
            
            for i, tc in enumerate(test_cases, 1):
                print(f"Test Case {i}: {tc.get('name')}")
                print(f"   Description: {tc.get('description')}")
                print(f"   Steps: {len(tc.get('steps', []))}")
                print("")
            
            return test_cases
        else:
            print(f"❌ API Error: {response.status_code}")
            print(response.text)
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return None

if __name__ == "__main__":
    # Example 1: Simple navigation test
    print("=" * 50)
    print("Example 1: Navigation Test")
    print("=" * 50)
    run_test(
        website_url="https://example.com",
        user_story="As a user, I want to navigate to the website and see the homepage content"
    )
    
    print("\n")
    
    # Example 2: Generate tests only
    print("=" * 50)
    print("Example 2: Generate Tests Only")
    print("=" * 50)
    generate_tests_only(
        website_url="https://example.com",
        user_story="As a user, I want to search for products"
    )





























