import { describe, it, expect } from 'vitest';
import { isCreateOrEditFlow } from '../utils/create-edit-flow';

describe('isCreateOrEditFlow', () => {
  it('returns false for empty string', () => {
    expect(isCreateOrEditFlow('')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isCreateOrEditFlow(null as any)).toBe(false);
    expect(isCreateOrEditFlow(undefined as any)).toBe(false);
  });

  it('returns false for non-string input', () => {
    expect(isCreateOrEditFlow(123 as any)).toBe(false);
  });

  it('detects "create" keyword', () => {
    expect(isCreateOrEditFlow('create a new project')).toBe(true);
  });

  it('detects "add new" keyword', () => {
    expect(isCreateOrEditFlow('add new user')).toBe(true);
    expect(isCreateOrEditFlow('add a new item')).toBe(true);
  });

  it('detects "new ... form" pattern', () => {
    expect(isCreateOrEditFlow('open new project form')).toBe(true);
  });

  it('detects "edit" keyword', () => {
    expect(isCreateOrEditFlow('edit user profile')).toBe(true);
  });

  it('detects "update" keyword', () => {
    expect(isCreateOrEditFlow('update settings')).toBe(true);
  });

  it('detects "modify" keyword', () => {
    expect(isCreateOrEditFlow('modify the record')).toBe(true);
  });

  it('detects "open create/edit" pattern', () => {
    expect(isCreateOrEditFlow('open the create dialog')).toBe(true);
    expect(isCreateOrEditFlow('open edit form')).toBe(true);
    expect(isCreateOrEditFlow('open add modal')).toBe(true);
  });

  it('detects "creation form/dialog/modal/popup"', () => {
    expect(isCreateOrEditFlow('creation form for users')).toBe(true);
    expect(isCreateOrEditFlow('creation dialog')).toBe(true);
    expect(isCreateOrEditFlow('creation modal')).toBe(true);
    expect(isCreateOrEditFlow('creation popup')).toBe(true);
  });

  it('detects "edit form/dialog/modal/popup"', () => {
    expect(isCreateOrEditFlow('edit form submission')).toBe(true);
    expect(isCreateOrEditFlow('edit dialog closes')).toBe(true);
    expect(isCreateOrEditFlow('edit modal')).toBe(true);
    expect(isCreateOrEditFlow('edit popup')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isCreateOrEditFlow('CREATE a project')).toBe(true);
    expect(isCreateOrEditFlow('EDIT user')).toBe(true);
    expect(isCreateOrEditFlow('Update Settings')).toBe(true);
  });

  it('returns false for unrelated stories', () => {
    expect(isCreateOrEditFlow('view the dashboard')).toBe(false);
    expect(isCreateOrEditFlow('login to the app')).toBe(false);
    expect(isCreateOrEditFlow('search for users')).toBe(false);
    expect(isCreateOrEditFlow('navigate to home')).toBe(false);
  });
});
