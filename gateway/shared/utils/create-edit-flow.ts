/**
 * Helpers for Create/Edit flow detection and prerequisite steps.
 * Used when the user story describes creating or editing entities (CRUD forms in dialogs).
 */

export interface PrerequisiteStep {
  action: 'click' | 'type';
  selector: string;
  value?: string;
}

/**
 * Detect if the user story describes a Create or Edit flow that requires
 * opening a dialog/modal before we can capture the form for test generation.
 */
export function isCreateOrEditFlow(story: string): boolean {
  if (!story || typeof story !== 'string') return false;
  const lower = story.toLowerCase();
  const patterns = [
    /\bcreate\b/,
    /\badd\s+(a\s+)?new\b/,
    /\bnew\s+[\w\s]+\s+form\b/,
    /\bedit\b/,
    /\bupdate\b/,
    /\bmodify\b/,
    /\bopen\s+(the\s+)?(create|edit|add)\b/,
    /\bcreation\s+(form|dialog|modal|popup)\b/,
    /\bedit\s+(form|dialog|modal|popup)\b/,
  ];
  return patterns.some((p) => p.test(lower));
}
