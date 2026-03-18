#!/bin/bash

# Example test execution script

echo "🧪 Running WhyNot Test Example"
echo "========================================"
echo ""

# Example 1: Simple navigation test
echo "Test 1: Navigation Test"
curl -X POST http://localhost:3000/api/run-test \
  -H "Content-Type: application/json" \
  -d '{
    "website_url": "https://example.com",
    "user_story": "As a user, I want to navigate to the website and see the homepage content",
    "headless": true
  }' | jq '.'

echo ""
echo "---"
echo ""

# Example 2: Login test (uncomment to use)
# echo "Test 2: Login Test"
# curl -X POST http://localhost:3000/api/run-test \
#   -H "Content-Type: application/json" \
#   -d '{
#     "website_url": "https://example.com/login",
#     "user_story": "As a user, I want to login to the website using my email and password",
#     "headless": true
#   }' | jq '.'





























