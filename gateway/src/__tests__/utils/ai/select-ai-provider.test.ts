import { describe, it, expect, vi } from 'vitest';

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => {
    const provider = (model: string) => ({ modelId: model, provider: 'openai' });
    provider._type = 'openai';
    return provider;
  }),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => {
    const provider = (model: string) => ({ modelId: model, provider: 'anthropic' });
    provider._type = 'anthropic';
    return provider;
  }),
}));

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => {
    const provider = (model: string) => ({ modelId: model, provider: 'google' });
    provider._type = 'google';
    return provider;
  }),
}));

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: vi.fn(({ name }: { name: string }) => {
    const provider = (model: string) => ({ modelId: model, provider: name });
    provider._type = name;
    return provider;
  }),
}));

import { selectAIProvider, AIProviderError } from '../../../utils/ai/select-ai-provider';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

type MockProvider = ReturnType<typeof selectAIProvider> & { _type: string };

describe('selectAIProvider', () => {
  describe('provider detection from URL', () => {
    it('creates OpenAI provider for api.openai.com', () => {
      const provider = selectAIProvider({
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
      });
      expect(createOpenAI).toHaveBeenCalledWith({ apiKey: 'sk-test' });
      expect((provider as MockProvider)._type).toBe('openai');
    });

    it('creates Anthropic provider for api.anthropic.com', () => {
      const provider = selectAIProvider({
        apiUrl: 'https://api.anthropic.com/v1',
        apiKey: 'sk-ant-test',
      });
      expect(createAnthropic).toHaveBeenCalledWith({ apiKey: 'sk-ant-test' });
      expect((provider as MockProvider)._type).toBe('anthropic');
    });

    it('creates Google provider for generativelanguage.googleapis.com', () => {
      const provider = selectAIProvider({
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'google-key',
      });
      expect(createGoogleGenerativeAI).toHaveBeenCalledWith({ apiKey: 'google-key' });
      expect((provider as MockProvider)._type).toBe('google');
    });

    it('creates OpenAICompatible provider for openrouter.ai', () => {
      const provider = selectAIProvider({
        apiUrl: 'https://openrouter.ai/api/v1',
        apiKey: 'or-key',
      });
      expect(createOpenAICompatible).toHaveBeenCalledWith({
        name: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'or-key',
      });
      expect((provider as MockProvider)._type).toBe('openrouter');
    });

    it('creates OpenAICompatible provider for unknown URLs (custom)', () => {
      const provider = selectAIProvider({
        apiUrl: 'https://my-llm.example.com/v1',
        apiKey: 'custom-key',
      });
      expect(createOpenAICompatible).toHaveBeenCalledWith({
        name: 'custom',
        baseURL: 'https://my-llm.example.com/v1',
        apiKey: 'custom-key',
      });
      expect((provider as MockProvider)._type).toBe('custom');
    });
  });

  describe('explicit provider override', () => {
    it('uses explicit provider over URL detection', () => {
      const provider = selectAIProvider({
        apiUrl: 'https://proxy.example.com/anthropic',
        apiKey: 'key',
        provider: 'anthropic',
      });
      expect(createAnthropic).toHaveBeenCalledWith({ apiKey: 'key' });
      expect((provider as MockProvider)._type).toBe('anthropic');
    });

    it('uses explicit openrouter provider regardless of URL', () => {
      const provider = selectAIProvider({
        apiUrl: 'https://proxy.example.com/or',
        apiKey: 'key',
        provider: 'openrouter',
      });
      expect(createOpenAICompatible).toHaveBeenCalledWith({
        name: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: 'key',
      });
      expect((provider as MockProvider)._type).toBe('openrouter');
    });
  });

  describe('OpenRouter uses createOpenAICompatible', () => {
    it('never calls createOpenAI for OpenRouter URLs', () => {
      vi.mocked(createOpenAI).mockClear();
      selectAIProvider({
        apiUrl: 'https://openrouter.ai/api/v1',
        apiKey: 'or-key',
      });
      expect(createOpenAI).not.toHaveBeenCalled();
      expect(createOpenAICompatible).toHaveBeenCalled();
    });
  });

  describe('model instantiation', () => {
    it('returns a callable provider that produces model refs', () => {
      const provider = selectAIProvider({
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
      });
      const model = provider('gpt-4o');
      expect(model).toEqual({ modelId: 'gpt-4o', provider: 'openai' });
    });

    it('Anthropic provider returns model ref', () => {
      const provider = selectAIProvider({
        apiUrl: 'https://api.anthropic.com/v1',
        apiKey: 'sk-ant-test',
      });
      const model = provider('claude-sonnet-4-6');
      expect(model).toEqual({ modelId: 'claude-sonnet-4-6', provider: 'anthropic' });
    });

    it('OpenRouter provider returns model ref', () => {
      const provider = selectAIProvider({
        apiUrl: 'https://openrouter.ai/api/v1',
        apiKey: 'or-key',
      });
      const model = provider('anthropic/claude-3.5-sonnet');
      expect(model).toEqual({ modelId: 'anthropic/claude-3.5-sonnet', provider: 'openrouter' });
    });
  });

  describe('error handling', () => {
    it('AIProviderError carries i18n key and provider name', () => {
      const error = new AIProviderError('errors:ai.unknownProvider', 'bogus');
      expect(error.i18nKey).toBe('errors:ai.unknownProvider');
      expect(error.provider).toBe('bogus');
      expect(error.message).toBe('Unknown AI provider: bogus');
      expect(error.name).toBe('AIProviderError');
      expect(error).toBeInstanceOf(Error);
    });
  });
});
