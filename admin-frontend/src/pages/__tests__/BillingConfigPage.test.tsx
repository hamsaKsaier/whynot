import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BillingConfigPage } from '../BillingConfigPage';

const stableT = (key: string) => {
  const map: Record<string, string> = {
    'admin.billingConfig.title': 'Billing Configuration',
    'admin.billingConfig.description': 'Configure billing settings',
    'admin.billingConfig.save': 'Save',
    'admin.billingConfig.saving': 'Saving...',
    'admin.billingConfig.saved': 'Saved',
    'admin.billingConfig.loadError': 'Failed to load',
    'admin.billingConfig.saveError': 'Failed to save',
    'admin.billingConfig.generalTitle': 'General',
    'admin.billingConfig.generalDescription': 'Basic billing settings',
    'admin.billingConfig.trialDays': 'Trial Days',
    'admin.billingConfig.trialDaysHint': 'Number of trial days',
    'admin.billingConfig.gracePeriod': 'Grace Period',
    'admin.billingConfig.gracePeriodHint': 'Days after payment failure',
    'admin.billingConfig.currency': 'Currency',
    'admin.billingConfig.currencyHint': 'Three-letter currency code',
    'admin.billingConfig.thresholdsTitle': 'Thresholds',
    'admin.billingConfig.thresholdsDescription': 'Credit thresholds',
    'admin.billingConfig.creditsLowThreshold': 'Low Threshold',
    'admin.billingConfig.creditsLowThresholdHint': 'In cents',
    'admin.billingConfig.paygChargeBuffer': 'Charge Buffer',
    'admin.billingConfig.paygChargeBufferHint': 'In cents',
    'admin.billingConfig.paygRatesTitle': 'PAYG Rates',
    'admin.billingConfig.paygRatesDescription': 'Per-event pricing',
    'admin.billingConfig.noPaygRates': 'No PAYG rates configured',
    'admin.billingConfig.addRate': 'Add Rate',
    'admin.billingConfig.eventType': 'Event Type',
    'admin.billingConfig.costCents': 'Cost (cents)',
    'admin.billingConfig.remove': 'Remove',
  };
  return map[key] || key;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: stableT }),
}));

vi.mock('../../services/api', () => ({
  getBillingConfig: vi.fn(),
  updateBillingConfig: vi.fn(),
}));

import { getBillingConfig } from '../../services/api';

describe('BillingConfigPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    vi.mocked(getBillingConfig).mockReturnValue(new Promise(() => {}));
    render(<BillingConfigPage />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders form after loading', async () => {
    vi.mocked(getBillingConfig).mockResolvedValue({
      config: {
        trial_days: '14',
        grace_period_days: '7',
        currency: 'usd',
        credits_low_threshold_cents: '1000',
        payg_charge_buffer_cents: '500',
      },
    });

    render(<BillingConfigPage />);

    await waitFor(() => {
      expect(screen.getByText('Billing Configuration')).toBeInTheDocument();
    });
    // Check header renders and save button
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('shows error on load failure', async () => {
    vi.mocked(getBillingConfig).mockRejectedValue(new Error('fail'));

    render(<BillingConfigPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });
  });

  it('shows no PAYG rates message when none configured', async () => {
    vi.mocked(getBillingConfig).mockResolvedValue({
      config: {},
    });

    render(<BillingConfigPage />);

    await waitFor(() => {
      expect(screen.getByText('No PAYG rates configured')).toBeInTheDocument();
    });
  });

  it('renders Add Rate button', async () => {
    vi.mocked(getBillingConfig).mockResolvedValue({ config: {} });

    render(<BillingConfigPage />);

    await waitFor(() => {
      expect(screen.getByText('Add Rate')).toBeInTheDocument();
    });
  });
});
