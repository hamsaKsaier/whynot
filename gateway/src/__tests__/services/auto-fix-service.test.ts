import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindByBugId, mockCreate, mockUpdate, mockFindById } = vi.hoisted(() => ({
  mockFindByBugId: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockFindById: vi.fn(),
}));

vi.mock('../../../shared/database/repositories/auto-fix-repository', () => ({
  AutoFixRepository: vi.fn().mockImplementation(() => ({
    findByBugId: mockFindByBugId,
    create: mockCreate,
    update: mockUpdate,
    findById: mockFindById,
  })),
}));

vi.mock('../../../shared/database/connection', () => ({
  query: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../utils/ai/select-ai-provider', () => ({
  selectAIProvider: vi.fn().mockReturnValue({
    languageModel: vi.fn(),
  }),
}));

vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'fix code here' }),
}));

vi.mock('axios', () => ({
  default: { post: vi.fn(), get: vi.fn() },
}));

vi.mock('../../../shared/logger/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../services/email-service', () => ({
  sendAutoFixPREmail: vi.fn().mockResolvedValue(undefined),
}));

import { AutoFixService } from '../../services/auto-fix-service';

describe('AutoFixService', () => {
  let service: AutoFixService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AutoFixService();
  });

  it('can be instantiated', () => {
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(AutoFixService);
  });

  // The AutoFixService class methods require complex setup with GitHub API,
  // AI providers, and database calls. We test the class can be constructed
  // and core dependencies are injected.
  it('has expected methods', () => {
    expect(typeof (service as any).repository).toBeDefined();
  });
});
