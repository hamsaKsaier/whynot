import React, { useState } from 'react';
import { Input } from '../common/Input';
import { Textarea } from '../common/Textarea';
import { Button } from '../common/Button';
import { Card } from '../common/Card';

interface TestInputFormProps {
  onGenerateTests: (websiteUrl: string, userStory: string) => void;
  onRunTest: (websiteUrl: string, userStory: string, headless: boolean) => void;
  isLoading?: boolean;
}

export const TestInputForm: React.FC<TestInputFormProps> = ({
  onGenerateTests,
  onRunTest,
  isLoading = false,
}) => {
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [userStory, setUserStory] = useState('');
  const [headless, setHeadless] = useState(false);
  const [errors, setErrors] = useState<{ websiteUrl?: string; userStory?: string }>({});

  const validate = () => {
    const newErrors: { websiteUrl?: string; userStory?: string } = {};
    
    if (!websiteUrl.trim()) {
      newErrors.websiteUrl = 'Website URL is required';
    } else if (!isValidUrl(websiteUrl)) {
      newErrors.websiteUrl = 'Please enter a valid URL';
    }
    
    if (!userStory.trim()) {
      newErrors.userStory = 'User story is required';
    } else if (userStory.trim().length < 10) {
      newErrors.userStory = 'User story must be at least 10 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleGenerateTests = () => {
    if (validate()) {
      onGenerateTests(websiteUrl.trim(), userStory.trim());
    }
  };

  const handleRunTest = () => {
    if (validate()) {
      onRunTest(websiteUrl.trim(), userStory.trim(), headless);
    }
  };

  const loadExample = () => {
    setWebsiteUrl('https://example.com');
    setUserStory('As a user, I want to navigate to the website and see the homepage content');
  };

  return (
    <Card title="Create Test" className="mb-6">
      <div className="space-y-4">
        <Input
          label="Website URL"
          type="url"
          placeholder="https://example.com"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          error={errors.websiteUrl}
          disabled={isLoading}
        />

        <Textarea
          label="User Story"
          placeholder="As a user, I want to..."
          value={userStory}
          onChange={(e) => setUserStory(e.target.value)}
          error={errors.userStory}
          disabled={isLoading}
        />

        <div className="flex items-center">
          <input
            type="checkbox"
            id="headless"
            checked={headless}
            onChange={(e) => setHeadless(e.target.checked)}
            disabled={isLoading}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
          <label htmlFor="headless" className="ml-2 text-sm text-gray-700">
            Run in headless mode (no live preview)
          </label>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleGenerateTests}
            disabled={isLoading}
            variant="secondary"
          >
            Generate Tests
          </Button>
          <Button
            onClick={handleRunTest}
            disabled={isLoading}
            isLoading={isLoading}
          >
            Run Test
          </Button>
          <button
            onClick={loadExample}
            disabled={isLoading}
            className="text-sm text-primary-600 hover:text-primary-700 underline"
          >
            Load Example
          </button>
        </div>
      </div>
    </Card>
  );
};





