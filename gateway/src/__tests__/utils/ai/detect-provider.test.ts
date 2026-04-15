import { describe, it, expect } from 'vitest';
import { detectProvider } from '../../../utils/ai/detect-provider';

describe('detectProvider', () => {
  it('detects OpenAI from api.openai.com', () => {
    expect(detectProvider('https://api.openai.com/v1')).toBe('openai');
  });

  it('detects OpenAI from full chat completions URL', () => {
    expect(detectProvider('https://api.openai.com/v1/chat/completions')).toBe('openai');
  });

  it('detects Anthropic from api.anthropic.com', () => {
    expect(detectProvider('https://api.anthropic.com/v1')).toBe('anthropic');
  });

  it('detects Anthropic from messages endpoint', () => {
    expect(detectProvider('https://api.anthropic.com/v1/messages')).toBe('anthropic');
  });

  it('detects Google from generativelanguage.googleapis.com', () => {
    expect(detectProvider('https://generativelanguage.googleapis.com/v1beta')).toBe('google');
  });

  it('detects Google from full models URL', () => {
    expect(detectProvider('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro')).toBe('google');
  });

  it('detects OpenRouter from openrouter.ai', () => {
    expect(detectProvider('https://openrouter.ai/api/v1')).toBe('openrouter');
  });

  it('detects OpenRouter from full chat URL', () => {
    expect(detectProvider('https://openrouter.ai/api/v1/chat/completions')).toBe('openrouter');
  });

  it('returns custom for unknown URLs', () => {
    expect(detectProvider('https://my-custom-llm.example.com/v1')).toBe('custom');
  });

  it('returns custom for localhost URLs', () => {
    expect(detectProvider('http://localhost:8080/v1')).toBe('custom');
  });

  it('returns custom for empty string', () => {
    expect(detectProvider('')).toBe('custom');
  });

  it('returns custom for arbitrary domain', () => {
    expect(detectProvider('https://llm.internal.corp.net/api')).toBe('custom');
  });
});
