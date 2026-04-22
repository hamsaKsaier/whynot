import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

const {
  mockFindByEmail, mockFindByGithubId, mockFindByGoogleId,
  mockUserCreate, mockUserUpdate, mockWsCreate,
  mockFindBySlug, mockSubCreate, mockInitBalance, mockAddCredits,
} = vi.hoisted(() => ({
  mockFindByEmail: vi.fn(),
  mockFindByGithubId: vi.fn(),
  mockFindByGoogleId: vi.fn(),
  mockUserCreate: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockWsCreate: vi.fn(),
  mockFindBySlug: vi.fn(),
  mockSubCreate: vi.fn(),
  mockInitBalance: vi.fn(),
  mockAddCredits: vi.fn(),
}));

vi.mock('../../../shared/database/repositories/user-repository', () => ({
  UserRepository: vi.fn().mockImplementation(() => ({
    findByEmail: mockFindByEmail,
    findByGithubId: mockFindByGithubId,
    findByGoogleId: mockFindByGoogleId,
    create: mockUserCreate,
    update: mockUserUpdate,
  })),
}));

vi.mock('../../../shared/database/repositories/workspace-repository', () => ({
  WorkspaceRepository: vi.fn().mockImplementation(() => ({
    create: mockWsCreate,
  })),
}));

vi.mock('../../../shared/database/repositories/plan-repository', () => ({
  PlanRepository: vi.fn().mockImplementation(() => ({
    findBySlug: mockFindBySlug,
  })),
}));

vi.mock('../../../shared/database/repositories/subscription-repository', () => ({
  SubscriptionRepository: vi.fn().mockImplementation(() => ({
    create: mockSubCreate,
  })),
}));

vi.mock('../../../shared/database/repositories/credit-repository', () => ({
  CreditRepository: vi.fn().mockImplementation(() => ({
    initBalance: mockInitBalance,
    addCredits: mockAddCredits,
  })),
}));

import { register, login, generateJWT, getGithubAuthUrl, getGoogleAuthUrl } from '../../services/auth-service';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

describe('auth-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no free plan seeded
    mockFindBySlug.mockResolvedValue(null);
  });

  describe('register', () => {
    it('creates user, workspace, and returns token', async () => {
      mockFindByEmail.mockResolvedValue(null);
      const fakeUser = { id: 'u-1', email: 'new@test.com', name: 'New User', avatar_url: null, role: 'user', password_hash: 'hash' };
      mockUserCreate.mockResolvedValue(fakeUser);
      mockWsCreate.mockResolvedValue({ id: 'ws-1' });

      const result = await register('new@test.com', 'password123', 'New User');

      expect(result.token).toBeDefined();
      expect(result.user).toEqual({
        id: 'u-1',
        email: 'new@test.com',
        name: 'New User',
        avatarUrl: null,
        role: 'user',
      });
      expect(mockUserCreate).toHaveBeenCalled();
      expect(mockWsCreate).toHaveBeenCalled();
    });

    it('throws 409 if email already in use', async () => {
      mockFindByEmail.mockResolvedValue({ id: 'existing' });

      await expect(register('existing@test.com', 'pass', 'Name')).rejects.toThrow('Email already in use');
    });

    it('provisions subscription when free plan exists', async () => {
      mockFindByEmail.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue({ id: 'u-1', email: 'new@test.com', name: 'User', avatar_url: null, role: 'user' });
      mockWsCreate.mockResolvedValue({ id: 'ws-1' });
      mockFindBySlug.mockResolvedValue({ id: 'plan-free', trial_days: 14, credits_per_period: 100, name: 'Free Trial' });

      await register('new@test.com', 'pass12345', 'User');

      expect(mockSubCreate).toHaveBeenCalled();
      expect(mockInitBalance).toHaveBeenCalledWith('ws-1');
      expect(mockAddCredits).toHaveBeenCalledWith(
        expect.objectContaining({ workspace_id: 'ws-1', amount: 100 }),
      );
    });
  });

  describe('login', () => {
    it('returns token for valid credentials', async () => {
      // bcrypt.hash('password123', 10) produces a valid hash
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('password123', 10);
      mockFindByEmail.mockResolvedValue({
        id: 'u-1', email: 'user@test.com', name: 'User', avatar_url: null, role: 'user', password_hash: hash,
      });

      const result = await login('user@test.com', 'password123');

      expect(result.token).toBeDefined();
      expect(result.user.email).toBe('user@test.com');
    });

    it('throws for non-existent email', async () => {
      mockFindByEmail.mockResolvedValue(null);

      await expect(login('nobody@test.com', 'pass')).rejects.toThrow('Invalid email or password');
    });

    it('throws for wrong password', async () => {
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('correct-password', 10);
      mockFindByEmail.mockResolvedValue({
        id: 'u-1', email: 'user@test.com', name: 'User', password_hash: hash,
      });

      await expect(login('user@test.com', 'wrong-password')).rejects.toThrow('Invalid email or password');
    });

    it('throws when user has no password_hash (OAuth-only)', async () => {
      mockFindByEmail.mockResolvedValue({
        id: 'u-1', email: 'user@test.com', name: 'User', password_hash: null,
      });

      await expect(login('user@test.com', 'pass')).rejects.toThrow('Invalid email or password');
    });
  });

  describe('generateJWT', () => {
    it('generates a valid JWT token', () => {
      const user = { id: 'u-1', email: 'test@test.com', name: 'Test', role: 'user' } as any;
      const token = generateJWT(user);

      const payload = jwt.verify(token, JWT_SECRET) as any;
      expect(payload.id).toBe('u-1');
      expect(payload.email).toBe('test@test.com');
    });

    it('defaults role to user when not set', () => {
      const user = { id: 'u-1', email: 'test@test.com', name: 'Test', role: undefined } as any;
      const token = generateJWT(user);

      const payload = jwt.verify(token, JWT_SECRET) as any;
      expect(payload.role).toBe('user');
    });
  });

  describe('getGithubAuthUrl', () => {
    it('returns GitHub OAuth URL', () => {
      process.env.GITHUB_CLIENT_ID = 'gh-client-id';
      const url = getGithubAuthUrl();

      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=gh-client-id');
      expect(url).toContain('scope=user:email');
    });

    it('throws when GITHUB_CLIENT_ID is not set', () => {
      delete process.env.GITHUB_CLIENT_ID;
      expect(() => getGithubAuthUrl()).toThrow('GITHUB_CLIENT_ID not set');
    });
  });

  describe('getGoogleAuthUrl', () => {
    it('returns Google OAuth URL', () => {
      process.env.GOOGLE_CLIENT_ID = 'google-client-id';
      const url = getGoogleAuthUrl();

      expect(url).toContain('accounts.google.com');
      expect(url).toContain('client_id=google-client-id');
    });

    it('throws when GOOGLE_CLIENT_ID is not set', () => {
      delete process.env.GOOGLE_CLIENT_ID;
      expect(() => getGoogleAuthUrl()).toThrow('GOOGLE_CLIENT_ID not set');
    });
  });
});
