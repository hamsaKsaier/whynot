# User AI Configuration

This guide explains how AI provider settings work from the user's perspective, including subscription tiers, key management, and platform key fallback.

## Subscription Tiers

WhyNot QA offers two subscription tiers that determine how AI providers are accessed:

### Bring Your Own Keys (`byo_keys`)

Plans: **Free**, **Pro (BYO)**

- Users **must** provide their own API keys to use AI features (test generation, auto-fix, etc.)
- No access to platform-managed keys
- Users configure providers at **Settings → AI**
- Keys are encrypted at rest using AES-256-GCM

### Managed + Pay-As-You-Go (`managed_payg`)

Plans: **Pro (Managed + PAYG)**

- Platform provides pre-configured AI keys — no setup required
- Users are charged per usage (pay-as-you-go)
- Users **can optionally** add their own keys for custom provider access
- When a user has their own key configured, it takes precedence over platform keys

## How Provider Selection Works

1. The system first checks if the user has a personal API key configured (`Settings → AI`)
2. If a personal key exists and is set as default, it is used
3. If no personal key exists and the user is on a `managed_payg` plan, the platform's default provider is used
4. If no personal key exists and the user is on a `byo_keys` plan, AI features are unavailable

## Admin-Configured Providers

The list of available providers shown to users is controlled by the platform administrator at **Admin → AI Providers**. Only providers that the admin has activated (with a valid API key) appear in the user's provider dropdown.

If an admin disables a provider, it is no longer available for new user configurations. Existing user configurations for that provider continue to work until the user's key expires or is deleted.

The `Custom (OpenAI-compatible)` option is always available, allowing users to connect any OpenAI-compatible API endpoint.

## Settings Tab (`Settings → AI`)

### For `byo_keys` users

- A banner explains that API keys are required
- If no keys are configured, a prompt encourages adding one
- The provider dropdown shows only admin-enabled providers plus "Custom"
- The model dropdown is populated from the admin's configured model list per provider

### For `managed_payg` users

- A banner indicates that managed AI access is included in the plan
- If no personal keys are configured, a message shows the current platform default (e.g., "Currently using: Anthropic / claude-sonnet-4-6")
- Users can optionally add their own keys to override the platform default

### Adding a Provider Key

1. Click **Add provider**
2. Select a provider from the dropdown
3. Select a model (or type a custom model name for "Custom" provider)
4. For "Custom" provider, enter the Base URL of the OpenAI-compatible API
5. Enter the API key
6. Click **Save**

### Managing Keys

- **Test connection**: Verifies the API key works by making a test request
- **Set as default**: Makes this provider the default for AI operations
- **Delete**: Removes the provider configuration

## Platform Key Fallback

For `managed_payg` users, the platform maintains a fallback chain of AI providers configured by the administrator. If the primary provider fails, the system automatically tries the next provider in the fallback order.

The fallback order and default provider are configured in **Admin → AI Providers → Billing Defaults**.
