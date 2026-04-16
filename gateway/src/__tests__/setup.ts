process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgresql://whynot:whynot@localhost:5432/whynot_test';
process.env.STRIPE_SECRET_KEY = 'sk_test_stub';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_stub';
process.env.AI_CONFIG_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';
process.env.SECRETS_ENCRYPTION_KEY = Buffer.from('a'.repeat(32)).toString('base64');

// AI provider keys are now in the platform_ai_config table (seeded per-test).
// No ANTHROPIC_API_KEY or OPENAI_API_KEY env vars needed.
