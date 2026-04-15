import express from 'express';
import { z } from 'zod';
import { generateText } from 'ai';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler, createError } from '../../middleware/error-handler';
import { validate } from '../../middleware/validation';
import { encrypt, decrypt } from '../../utils/crypto/secret-cipher';
import { selectAIProvider } from '../../utils/ai/select-ai-provider';
import { UserAiConfigRepository } from '../../../shared/database/repositories/user-ai-config-repository';
import { AuditRepository } from '../../../shared/database/repositories/audit-repository';
import { createLogger } from '../../../shared/logger/logger';
import type { AIProviderName } from '../../utils/ai/detect-provider';

const router = express.Router();
const logger = createLogger('ai-config');
const repo = new UserAiConfigRepository();
const audit = new AuditRepository();

const PROVIDERS: AIProviderName[] = ['openai', 'anthropic', 'google', 'openrouter', 'custom'];

function maskApiKey(plaintext: string): string {
  if (plaintext.length <= 4) return '••••';
  return `sk-${'•'.repeat(5)}${plaintext.slice(-4)}`;
}

function providerBaseUrl(provider: AIProviderName): string {
  switch (provider) {
    case 'openai': return 'https://api.openai.com/v1';
    case 'anthropic': return 'https://api.anthropic.com';
    case 'google': return 'https://generativelanguage.googleapis.com/v1beta';
    case 'openrouter': return 'https://openrouter.ai/api/v1';
    case 'custom': return '';
  }
}

const createSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'openrouter', 'custom']),
  model: z.string().min(1).max(200),
  baseUrl: z.string().url().max(500).optional(),
  apiKey: z.string().min(1).max(500),
});

const updateSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'openrouter', 'custom']).optional(),
  model: z.string().min(1).max(200).optional(),
  baseUrl: z.string().url().max(500).optional().nullable(),
  apiKey: z.string().min(1).max(500).optional(),
});

// GET /api/me/ai-config — list all configs (keys masked)
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const configs = await repo.listByUser(userId);

    const masked = configs.map((c: any) => {
      const key = decrypt({
        ciphertext: c.api_key_encrypted,
        iv: c.api_key_iv,
        tag: c.api_key_tag,
      });
      return {
        id: c.id,
        provider: c.provider,
        model: c.model,
        baseUrl: c.base_url,
        apiKey: maskApiKey(key),
        isDefault: c.is_default,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      };
    });

    res.json({ items: masked });
  })
);

// POST /api/me/ai-config — create a new config
router.post(
  '/',
  requireAuth,
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const { provider, model, baseUrl, apiKey } = req.body;

    const { ciphertext, iv, tag } = encrypt(apiKey);

    const resolvedUrl = baseUrl || providerBaseUrl(provider) || null;

    const config = await repo.create({
      user_id: userId,
      provider,
      model,
      base_url: resolvedUrl,
      api_key_encrypted: ciphertext,
      api_key_iv: iv,
      api_key_tag: tag,
    });

    await audit.log({
      actor_id: userId,
      actor_email: (req as any).user.email,
      action: 'ai-config.set',
      target_type: 'user_ai_config',
      target_id: config.id,
      details: { provider, model },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    logger.info('AI config created', { userId, configId: config.id, provider });

    res.status(201).json({
      id: config.id,
      provider: config.provider,
      model: config.model,
      baseUrl: config.base_url,
      apiKey: maskApiKey(apiKey),
      isDefault: config.is_default,
      createdAt: config.created_at,
      updatedAt: config.updated_at,
    });
  })
);

// PUT /api/me/ai-config/:id — update config
router.put(
  '/:id',
  requireAuth,
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { provider, model, baseUrl, apiKey } = req.body;

    const existing = await repo.findById(id, userId);
    if (!existing) {
      throw createError((req as any).t('errors:resource.notFound', { resource: 'AI config' }), 404, 'NOT_FOUND');
    }

    const updateInput: any = {};
    if (provider !== undefined) updateInput.provider = provider;
    if (model !== undefined) updateInput.model = model;
    if (baseUrl !== undefined) updateInput.base_url = baseUrl;

    if (apiKey) {
      const { ciphertext, iv, tag } = encrypt(apiKey);
      updateInput.api_key_encrypted = ciphertext;
      updateInput.api_key_iv = iv;
      updateInput.api_key_tag = tag;
    }

    const updated = await repo.update(id, userId, updateInput);

    const action = apiKey ? 'ai-config.rotated' : 'ai-config.set';
    await audit.log({
      actor_id: userId,
      actor_email: (req as any).user.email,
      action,
      target_type: 'user_ai_config',
      target_id: id,
      details: { provider: updated?.provider, model: updated?.model },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    const maskedKey = apiKey
      ? maskApiKey(apiKey)
      : maskApiKey(
          decrypt({
            ciphertext: updated!.api_key_encrypted,
            iv: updated!.api_key_iv,
            tag: updated!.api_key_tag,
          })
        );

    res.json({
      id: updated!.id,
      provider: updated!.provider,
      model: updated!.model,
      baseUrl: updated!.base_url,
      apiKey: maskedKey,
      isDefault: updated!.is_default,
      createdAt: updated!.created_at,
      updatedAt: updated!.updated_at,
    });
  })
);

// PUT /api/me/ai-config/:id/default — set as default
router.put(
  '/:id/default',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const existing = await repo.findById(id, userId);
    if (!existing) {
      throw createError((req as any).t('errors:resource.notFound', { resource: 'AI config' }), 404, 'NOT_FOUND');
    }

    const updated = await repo.setDefault(id, userId);

    await audit.log({
      actor_id: userId,
      actor_email: (req as any).user.email,
      action: 'ai-config.default-changed',
      target_type: 'user_ai_config',
      target_id: id,
      details: { provider: updated?.provider, model: updated?.model },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    res.json({
      id: updated!.id,
      provider: updated!.provider,
      model: updated!.model,
      baseUrl: updated!.base_url,
      isDefault: updated!.is_default,
      createdAt: updated!.created_at,
      updatedAt: updated!.updated_at,
    });
  })
);

// DELETE /api/me/ai-config/:id
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const existing = await repo.findById(id, userId);
    if (!existing) {
      throw createError((req as any).t('errors:resource.notFound', { resource: 'AI config' }), 404, 'NOT_FOUND');
    }

    await repo.delete(id, userId);

    await audit.log({
      actor_id: userId,
      actor_email: (req as any).user.email,
      action: 'ai-config.revoked',
      target_type: 'user_ai_config',
      target_id: id,
      details: { provider: existing.provider, model: existing.model },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    res.json({ success: true });
  })
);

// POST /api/me/ai-config/:id/test — test connection
router.post(
  '/:id/test',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const config = await repo.findById(id, userId);
    if (!config) {
      throw createError((req as any).t('errors:resource.notFound', { resource: 'AI config' }), 404, 'NOT_FOUND');
    }

    const apiKey = decrypt({
      ciphertext: config.api_key_encrypted,
      iv: config.api_key_iv,
      tag: config.api_key_tag,
    });

    const apiUrl = config.base_url || providerBaseUrl(config.provider as AIProviderName);

    const start = Date.now();
    try {
      const provider = selectAIProvider({
        apiUrl,
        apiKey,
        provider: config.provider as AIProviderName,
      });

      await generateText({
        model: provider(config.model),
        prompt: 'Say "ok"',
        maxOutputTokens: 1,
      });

      const latencyMs = Date.now() - start;
      res.json({ ok: true, latencyMs });
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      logger.warn('AI config test failed', { configId: id, error: err.message });
      res.json({
        ok: false,
        error: err.message || 'Connection test failed',
        latencyMs,
      });
    }
  })
);

export const aiConfigRouter = router;
