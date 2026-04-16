import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock dependencies before importing the component
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../services/api', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: { preferences: {
      scan_complete: true,
      critical_bug: false,
      monitor_alert: true,
      autofix_pr: false,
    } } }),
    put: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToastContext: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

import { NotificationPreferences } from '../NotificationPreferences';

describe('NotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders notification triggers after loading', async () => {
    render(<NotificationPreferences />);
    const switches = await screen.findAllByRole('switch');
    expect(switches.length).toBe(4);
  });

  it('applies RTL translate class to enabled custom switch thumb', async () => {
    render(<NotificationPreferences />);
    // Wait for loading to finish — scan_complete is enabled
    const switches = await screen.findAllByRole('switch');
    const enabledSwitch = switches[0]; // scan_complete = true
    const thumb = enabledSwitch.querySelector('span');
    expect(thumb?.className).toContain('rtl:-translate-x-6');
  });

  it('applies LTR translate class to enabled custom switch thumb', async () => {
    render(<NotificationPreferences />);
    const switches = await screen.findAllByRole('switch');
    const enabledSwitch = switches[0]; // scan_complete = true
    const thumb = enabledSwitch.querySelector('span');
    expect(thumb?.className).toContain('translate-x-6');
  });

  it('applies RTL translate class to disabled custom switch thumb', async () => {
    render(<NotificationPreferences />);
    const switches = await screen.findAllByRole('switch');
    const disabledSwitch = switches[1]; // critical_bug = false
    const thumb = disabledSwitch.querySelector('span');
    expect(thumb?.className).toContain('rtl:-translate-x-1');
  });

  it('applies LTR translate class to disabled custom switch thumb', async () => {
    render(<NotificationPreferences />);
    const switches = await screen.findAllByRole('switch');
    const disabledSwitch = switches[1]; // critical_bug = false
    const thumb = disabledSwitch.querySelector('span');
    expect(thumb?.className).toContain('translate-x-1');
  });
});
