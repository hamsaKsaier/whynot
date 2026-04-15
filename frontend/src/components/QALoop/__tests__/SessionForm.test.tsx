import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SessionForm } from '../SessionForm';

const defaultProps = {
  targetUrl: '',
  setTargetUrl: vi.fn(),
  qualityThreshold: 80,
  setQualityThreshold: vi.fn(),
  maxIterations: 10,
  setMaxIterations: vi.fn(),
  documentContext: '',
  setDocumentContext: vi.fn(),
  useLogin: false,
  setUseLogin: vi.fn(),
  loginCredentials: { email: '', password: '', loginUrl: '', emailSelector: '', passwordSelector: '', submitSelector: '' },
  setLoginCredentials: vi.fn(),
  showPassword: false,
  setShowPassword: vi.fn(),
  testPriority: 'balanced',
  setTestPriority: vi.fn(),
  existingSession: null,
  useExisting: false,
  setUseExisting: vi.fn(),
  documents: [],
  activeSession: null,
  onUpload: vi.fn(),
  onDelete: vi.fn(),
  onToggle: vi.fn(),
  isStarting: false,
  onStart: vi.fn(),
  projects: [],
  selectedProjectId: null,
  setSelectedProjectId: vi.fn(),
  environments: [],
  scanMode: 'v2' as const,
  setScanMode: vi.fn(),
  showAdvanced: false,
  setShowAdvanced: vi.fn(),
  projectContextInfo: null,
  useProjectContext: false,
  setUseProjectContext: vi.fn(),
};

describe('SessionForm', () => {
  it('renders URL input', () => {
    render(<SessionForm {...defaultProps} />);
    const input = screen.getByPlaceholderText(/example\.com|url|website/i);
    expect(input).toBeInTheDocument();
  });

  it('renders start button', () => {
    render(<SessionForm {...defaultProps} />);
    expect(screen.getByText(/start/i)).toBeInTheDocument();
  });

  it('disables start button when starting', () => {
    render(<SessionForm {...defaultProps} isStarting />);
    const startBtn = screen.getByText(/start/i).closest('button');
    expect(startBtn).toBeDisabled();
  });

  it('shows scan mode toggle', () => {
    render(<SessionForm {...defaultProps} />);
    const v2Label = screen.queryByText(/QA Team|v2|multi/i);
    expect(v2Label).toBeInTheDocument();
  });
});
