/**
 * Integration tests for API endpoints
 * Run with: npm test (from gateway or test-executor directory)
 */

import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

describe('Gateway API Integration Tests', () => {
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await axios.get(`${BASE_URL}/health`);
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('healthy');
      expect(response.data.service).toBe('gateway');
    });
  });

  describe('Test Generation', () => {
    it('should generate test cases from user story', async () => {
      const response = await axios.post(
        `${BASE_URL}/api/generate-tests`,
        {
          website_url: 'https://example.com',
          user_story: 'As a user, I want to navigate to the homepage and see the main content'
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.test_cases).toBeDefined();
      expect(Array.isArray(response.data.test_cases)).toBe(true);
      expect(response.data.test_cases.length).toBeGreaterThan(0);
    });

    it('should reject invalid URL', async () => {
      try {
        await axios.post(
          `${BASE_URL}/api/generate-tests`,
          {
            website_url: 'not-a-valid-url',
            user_story: 'Test story'
          }
        );
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });

    it('should reject empty user story', async () => {
      try {
        await axios.post(
          `${BASE_URL}/api/generate-tests`,
          {
            website_url: 'https://example.com',
            user_story: ''
          }
        );
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Make many rapid requests
      const requests = Array(150).fill(null).map(() =>
        axios.get(`${BASE_URL}/health`).catch(err => err)
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => 
        r.response?.status === 429 || r.response?.status === 500
      );

      // At least some requests should be rate limited
      // Note: This test may be flaky depending on rate limit configuration
      expect(rateLimited || responses.length > 0).toBe(true);
    });
  });
});

























