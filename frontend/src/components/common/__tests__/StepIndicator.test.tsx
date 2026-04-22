import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { StepIndicator } from '../StepIndicator';

describe('StepIndicator', () => {
  const steps = ['Step 1', 'Step 2', 'Step 3'];

  it('renders all step labels', () => {
    render(<StepIndicator steps={steps} currentStep={0} />);

    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2')).toBeInTheDocument();
    expect(screen.getByText('Step 3')).toBeInTheDocument();
  });

  it('shows step numbers for pending steps', () => {
    render(<StepIndicator steps={steps} currentStep={0} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('highlights current step', () => {
    render(<StepIndicator steps={steps} currentStep={1} />);

    // Step 2 label should have current styling
    const step2Label = screen.getByText('Step 2');
    expect(step2Label.className).toContain('text-primary');
  });

  it('marks completed steps', () => {
    render(<StepIndicator steps={steps} currentStep={2} />);

    // Steps 1 and 2 are completed (index 0 and 1)
    // Step numbers should not be shown for completed steps (they show check icon)
    // The last step (index 2) is current and shows number 3
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <StepIndicator steps={steps} currentStep={0} className="my-steps" />
    );
    expect(container.firstChild).toHaveClass('my-steps');
  });

  it('renders connector lines between steps', () => {
    const { container } = render(
      <StepIndicator steps={steps} currentStep={0} />
    );

    // There should be connector lines (divs with h-0.5 class)
    const connectors = container.querySelectorAll('.h-0\\.5');
    expect(connectors.length).toBe(steps.length - 1);
  });
});
