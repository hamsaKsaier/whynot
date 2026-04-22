import { describe, it, expect } from 'vitest';
import { isCreateOrEditFlow } from '../createEditFlow';

describe('isCreateOrEditFlow', () => {
  it('returns false for empty string', () => {
    expect(isCreateOrEditFlow('')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isCreateOrEditFlow(null as unknown as string)).toBe(false);
    expect(isCreateOrEditFlow(undefined as unknown as string)).toBe(false);
  });

  it('returns false for non-string input', () => {
    expect(isCreateOrEditFlow(123 as unknown as string)).toBe(false);
  });

  it('detects "create" keyword', () => {
    expect(isCreateOrEditFlow('Create a new user')).toBe(true);
  });

  it('detects "add new" keyword', () => {
    expect(isCreateOrEditFlow('Add a new item to the list')).toBe(true);
    expect(isCreateOrEditFlow('Add new project')).toBe(true);
  });

  it('detects "edit" keyword', () => {
    expect(isCreateOrEditFlow('Edit user profile')).toBe(true);
  });

  it('detects "update" keyword', () => {
    expect(isCreateOrEditFlow('Update the settings')).toBe(true);
  });

  it('detects "modify" keyword', () => {
    expect(isCreateOrEditFlow('Modify the database config')).toBe(true);
  });

  it('detects "open create" keyword', () => {
    expect(isCreateOrEditFlow('Open the create dialog')).toBe(true);
  });

  it('detects "open edit" keyword', () => {
    expect(isCreateOrEditFlow('Open edit form')).toBe(true);
  });

  it('detects "creation form" keyword', () => {
    expect(isCreateOrEditFlow('The creation form should validate')).toBe(true);
  });

  it('detects "edit dialog" keyword', () => {
    expect(isCreateOrEditFlow('The edit dialog should open')).toBe(true);
  });

  it('detects "new form" keyword', () => {
    expect(isCreateOrEditFlow('New user form should be accessible')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(isCreateOrEditFlow('CREATE a new thing')).toBe(true);
    expect(isCreateOrEditFlow('EDIT something')).toBe(true);
  });

  it('returns false for unrelated stories', () => {
    expect(isCreateOrEditFlow('View the dashboard')).toBe(false);
    expect(isCreateOrEditFlow('Navigate to settings')).toBe(false);
    expect(isCreateOrEditFlow('Login to the system')).toBe(false);
  });
});
