import { describe, it, expect } from 'vitest';
import { parseUserStoryLabel } from '../parseUserStoryLabel';

describe('parseUserStoryLabel', () => {
  it('returns "Untitled Story" for empty string', () => {
    expect(parseUserStoryLabel('')).toEqual({ story: 'Untitled Story' });
  });

  it('returns "Untitled Story" for null/undefined-like input', () => {
    expect(parseUserStoryLabel(null as unknown as string)).toEqual({ story: 'Untitled Story' });
    expect(parseUserStoryLabel(undefined as unknown as string)).toEqual({ story: 'Untitled Story' });
  });

  it('returns plain string labels as-is', () => {
    expect(parseUserStoryLabel('As a user I want to login')).toEqual({
      story: 'As a user I want to login',
    });
  });

  it('parses JSON with story field', () => {
    const json = JSON.stringify({ story: 'Test login flow' });
    expect(parseUserStoryLabel(json)).toEqual({ story: 'Test login flow' });
  });

  it('parses JSON with title field', () => {
    const json = JSON.stringify({ title: 'Login Test' });
    expect(parseUserStoryLabel(json)).toEqual({ story: 'Login Test' });
  });

  it('parses JSON with name field', () => {
    const json = JSON.stringify({ name: 'Dashboard Test' });
    expect(parseUserStoryLabel(json)).toEqual({ story: 'Dashboard Test' });
  });

  it('parses JSON with description field', () => {
    const json = JSON.stringify({ description: 'Check settings page' });
    expect(parseUserStoryLabel(json)).toEqual({ story: 'Check settings page' });
  });

  it('extracts url from JSON with website_url field', () => {
    const json = JSON.stringify({ story: 'Test it', website_url: 'https://example.com' });
    expect(parseUserStoryLabel(json)).toEqual({
      story: 'Test it',
      url: 'https://example.com',
    });
  });

  it('extracts url from JSON with url field', () => {
    const json = JSON.stringify({ story: 'Test it', url: 'https://example.com' });
    expect(parseUserStoryLabel(json)).toEqual({
      story: 'Test it',
      url: 'https://example.com',
    });
  });

  it('handles story field that is itself a URL', () => {
    const json = JSON.stringify({ story: 'https://example.com/page' });
    const result = parseUserStoryLabel(json);
    expect(result.story).toBe('Test: example.com');
    expect(result.url).toBe('https://example.com/page');
  });

  it('handles story field that is an invalid URL gracefully', () => {
    const json = JSON.stringify({ story: 'https://not a valid url' });
    const result = parseUserStoryLabel(json);
    // Fallback when URL constructor throws
    expect(result.story).toBe('https://not a valid url');
    expect(result.url).toBe('https://not a valid url');
  });

  it('truncates long stringified JSON objects', () => {
    const json = JSON.stringify({ randomKey: 'a'.repeat(100) });
    const result = parseUserStoryLabel(json);
    expect(result.story.length).toBeLessThanOrEqual(80);
    expect(result.story).toContain('...');
  });

  it('returns short stringified objects without truncation', () => {
    const json = JSON.stringify({ x: 1 });
    const result = parseUserStoryLabel(json);
    expect(result.story).toBe('{"x":1}');
  });

  it('handles non-object JSON values as plain text', () => {
    expect(parseUserStoryLabel('"just a string"')).toEqual({ story: '"just a string"' });
  });
});
