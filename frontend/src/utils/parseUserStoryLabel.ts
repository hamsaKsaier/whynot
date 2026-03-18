/**
 * Parses a user story label that might be a raw JSON string.
 *
 * Some user stories are stored as JSON objects (e.g. `{"story":"https://…"}`).
 * This utility extracts the human-readable story text and optional URL
 * regardless of the input format.
 */
export function parseUserStoryLabel(label: string): { story: string; url?: string } {
  if (!label) return { story: 'Untitled Story' };

  // Try to parse as JSON
  try {
    const parsed = JSON.parse(label);
    if (typeof parsed === 'object' && parsed !== null) {
      const story =
        parsed.story || parsed.title || parsed.name || parsed.description || '';

      const url = parsed.website_url || parsed.url;

      // If the extracted "story" is itself a URL, use it as the url and create a friendly label
      if (typeof story === 'string' && /^https?:\/\//.test(story)) {
        try {
          const hostname = new URL(story).hostname;
          return { story: `Test: ${hostname}`, url: story };
        } catch {
          return { story, url: story };
        }
      }

      if (story) return { story, url };

      // Fallback: stringify the object but truncate for readability
      const str = JSON.stringify(parsed);
      return { story: str.length > 80 ? str.slice(0, 77) + '...' : str };
    }
  } catch {
    // Not JSON — use as-is
  }

  return { story: label };
}
