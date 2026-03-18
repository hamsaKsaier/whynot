import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { UserRepository, UserEntity } from '../../shared/database/repositories/user-repository';
import { WorkspaceRepository } from '../../shared/database/repositories/workspace-repository';
import { PlanRepository } from '../../shared/database/repositories/plan-repository';
import { SubscriptionRepository } from '../../shared/database/repositories/subscription-repository';
import { CreditRepository } from '../../shared/database/repositories/credit-repository';
import { createError } from '../middleware/error-handler';

const userRepository = new UserRepository();
const workspaceRepository = new WorkspaceRepository();
const planRepository = new PlanRepository();
const subscriptionRepository = new SubscriptionRepository();
const creditRepository = new CreditRepository();

export interface AuthResult {
  token: string;
  user: PublicUser;
}

export interface PublicUser {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  role: string;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
}

function toPublicUser(user: UserEntity): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatar_url,
    role: user.role || 'user',
  };
}

export function generateJWT(user: UserEntity): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role || 'user' },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

/**
 * Provision subscription + credits for a new workspace.
 * Assigns the free-trial plan and grants initial credits.
 */
async function provisionWorkspace(workspaceId: string): Promise<void> {
  const freePlan = await planRepository.findBySlug('free-trial');
  if (!freePlan) return; // Plans not seeded yet, skip provisioning

  const now = new Date();
  const trialEnd = new Date(now.getTime() + freePlan.trial_days * 24 * 60 * 60 * 1000);

  await subscriptionRepository.create({
    workspace_id: workspaceId,
    plan_id: freePlan.id,
    status: 'trialing',
    current_period_start: now,
    current_period_end: trialEnd,
    trial_start: now,
    trial_end: trialEnd,
  });

  await creditRepository.initBalance(workspaceId);
  await creditRepository.addCredits({
    workspace_id: workspaceId,
    amount: freePlan.credits_per_period,
    type: 'subscription_refill',
    description: `Initial ${freePlan.name} credits`,
  });
}

/**
 * Register with email + password
 */
export async function register(email: string, password: string, name: string): Promise<AuthResult> {
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw createError('Email already in use', 409, 'EMAIL_IN_USE');
  }

  const password_hash = await bcrypt.hash(password, 10);
  const user = await userRepository.create({ email, password_hash, name });

  // Auto-create default workspace + provision subscription & credits
  const workspace = await workspaceRepository.create({ name: `${name}'s Workspace`, owner_id: user.id });
  await provisionWorkspace(workspace.id);

  return { token: generateJWT(user), user: toPublicUser(user) };
}

/**
 * Login with email + password
 */
export async function login(email: string, password: string): Promise<AuthResult> {
  const user = await userRepository.findByEmail(email);
  if (!user || !user.password_hash) {
    throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  return { token: generateJWT(user), user: toPublicUser(user) };
}

// ─── GitHub OAuth ────────────────────────────────────────────────────────────

export function getGithubAuthUrl(): string {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) throw new Error('GITHUB_CLIENT_ID not set');
  const callbackUrl = encodeURIComponent(
    process.env.GITHUB_CALLBACK_URL || 'http://localhost:3010/api/auth/github/callback'
  );
  return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${callbackUrl}&scope=user:email`;
}

export async function handleGithubCallback(code: string): Promise<AuthResult> {
  // Exchange code for access token
  const tokenRes = await axios.post(
    'https://github.com/login/oauth/access_token',
    {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GITHUB_CALLBACK_URL,
    },
    { headers: { Accept: 'application/json' } }
  );

  const accessToken: string = tokenRes.data.access_token;
  if (!accessToken) {
    throw createError('GitHub OAuth failed', 401, 'OAUTH_FAILED');
  }

  // Get user profile
  const profileRes = await axios.get('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = profileRes.data;

  // Get primary email if not public
  let email: string | null = profile.email;
  if (!email) {
    const emailsRes = await axios.get('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const primary = emailsRes.data.find((e: any) => e.primary && e.verified);
    email = primary?.email || null;
  }

  const githubId = String(profile.id);

  // Upsert user
  let user = await userRepository.findByGithubId(githubId);
  if (!user) {
    // Check if email already linked to another account
    if (email) {
      const existing = await userRepository.findByEmail(email);
      if (existing) {
        user = await userRepository.update(existing.id, { github_id: githubId, avatar_url: profile.avatar_url }) as typeof user;
      }
    }
    if (!user) {
      user = await userRepository.create({
        email: email || undefined,
        name: profile.name || profile.login || 'GitHub User',
        avatar_url: profile.avatar_url,
        github_id: githubId,
      });
      const workspace = await workspaceRepository.create({ name: `${user.name}'s Workspace`, owner_id: user.id });
      await provisionWorkspace(workspace.id);
    }
  } else {
    // Update avatar/email if changed
    user = await userRepository.update(user.id, {
      avatar_url: profile.avatar_url,
      ...(email && !user.email ? { email } : {}),
    }) as typeof user;
  }

  return { token: generateJWT(user!), user: toPublicUser(user!) };
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────

export function getGoogleAuthUrl(): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID not set');
  const callbackUrl = encodeURIComponent(
    process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3010/api/auth/google/callback'
  );
  return (
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&redirect_uri=${callbackUrl}&response_type=code&scope=email%20profile`
  );
}

export async function handleGoogleCallback(code: string): Promise<AuthResult> {
  // Exchange code for tokens
  const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_CALLBACK_URL,
    grant_type: 'authorization_code',
  });

  const accessToken: string = tokenRes.data.access_token;
  if (!accessToken) {
    throw createError('Google OAuth failed', 401, 'OAUTH_FAILED');
  }

  // Get user profile
  const profileRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = profileRes.data;
  const googleId = String(profile.id);

  // Upsert user
  let user = await userRepository.findByGoogleId(googleId);
  if (!user) {
    if (profile.email) {
      const existing = await userRepository.findByEmail(profile.email);
      if (existing) {
        user = await userRepository.update(existing.id, {
          google_id: googleId,
          avatar_url: profile.picture,
        }) as typeof user;
      }
    }
    if (!user) {
      user = await userRepository.create({
        email: profile.email || undefined,
        name: profile.name || 'Google User',
        avatar_url: profile.picture,
        google_id: googleId,
      });
      const workspace = await workspaceRepository.create({ name: `${user.name}'s Workspace`, owner_id: user.id });
      await provisionWorkspace(workspace.id);
    }
  } else {
    user = await userRepository.update(user.id, { avatar_url: profile.picture }) as typeof user;
  }

  return { token: generateJWT(user!), user: toPublicUser(user!) };
}
