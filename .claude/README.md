# `.claude/` — Agents, Skills & Rules

> **Single source of truth**: [`ARCHITECTURE.md`](../ARCHITECTURE.md) overrides any guidance in this directory.

This directory contains Claude agents, skills, and rules imported and adapted from the `serverless-v2` monorepo for the whynot platform. Every file has been re-mapped from Next.js/tRPC/Drizzle to **Vite + React / Express / raw SQL** conventions.

## Imported Agents (`.claude/agents/`)

### Design (`agents/design/`)
| File | Purpose |
|------|---------|
| `design-ui-designer.md` | UI/visual design for components |
| `design-ux-architect.md` | UX architecture and information hierarchy |
| `design-ux-researcher.md` | User research methodology |
| `design-brand-guardian.md` | Brand consistency enforcement |
| `design-image-prompt-engineer.md` | AI image generation prompts |
| `design-visual-storyteller.md` | Visual narrative and storytelling |
| `design-whimsy-injector.md` | Delight and personality in UI |
| `design-inclusive-visuals-specialist.md` | Accessibility-first visual design |
| `bulk-selection-specialist.md` | Bulk/multi-select UX patterns |

### Content (`agents/content/`)
| File | Purpose |
|------|---------|
| `blog-developer.md` | Blog content development |
| `legal-content-writer.md` | Legal/compliance page content |

### Top-level
| File | Purpose |
|------|---------|
| `api-designer.md` | REST API design (adapted from tRPC) |
| `base-template-generator.md` | Agent/skill template scaffolding |
| `prompt-engineer.md` | Prompt engineering for AI features |
| `translation-manager.md` | i18n translation workflow |
| `frontend-developer.md` | Frontend development (Vite + React) |

## Imported Skills (`.claude/skills/`)

| Directory / File | Purpose |
|------------------|---------|
| `shadcn-design-system-compliance/` | Component library compliance |
| `backend-i18n/` | Backend internationalization |
| `landing-page-optimization/` | Landing page CRO |
| `brand-guidelines/` | Brand asset management |
| `canvas-design/` | Canvas-based design tooling |
| `theme-factory/` | Theme generation (10 themes) |
| `pricing-strategy/` | Pricing tier strategy |
| `paywall-upgrade-cro/` | Paywall conversion optimization |
| `page-cro/` | Page-level conversion optimization |
| `copywriting/` | Copywriting frameworks |
| `content-strategy/` | Content planning and strategy |
| `ad-creative/` | Ad creative generation |
| `ab-test-setup/` | A/B test experiment setup |
| `paid-ads/` | Paid advertising management |
| `signup-flow-cro/` | Signup conversion optimization |
| `referral-program/` | Referral program management |
| `programmatic-seo/` | Programmatic SEO pages |
| `competitor-alternatives/` | Competitor comparison content |
| `social-content/` | Social media content creation |
| `marketing-ideas/` | Marketing ideation |
| `popup-cro/` | Popup conversion optimization |
| `churn-prevention/` | Churn reduction strategies |
| `spec-driven-development/` | Spec-driven development workflow |
| `legal-content-generator/` | Legal page content generation |
| `whynot-dashboard/` | Dashboard UI patterns (renamed from serverlessbase-dashboard) |
| `refactor-safely.md` | Safe refactoring guidelines |
| `debug-issue.md` | Debugging workflow |
| `review-changes.md` | Code review assistance |

## Imported Rules (`.claude/rules/`)

| File | Purpose |
|------|---------|
| `rtl-support-arabic.md` | RTL/Arabic layout support |
| `uncodixify-ui.md` | Remove Codix-specific UI patterns |
| `switch-component-styling.md` | Switch component styling conventions |
| `url-tab-state.md` | URL-based tab state management |
| `spec-driven-development.md` | Spec-driven development rules |

## Excluded from Import

The following categories were **explicitly excluded** as they relate to devops/infra/backend-core tooling not present in this project:

- **DevOps agents**: `devops-engineer`, `deployment-engineer`, `docker-swarm-specialist`, `opentofu-specialist`, `traefik-routing-specialist`
- **Backend-core agents**: `backend-developer`, `dev-backend-api`, `drizzle-orm-expert`, `trpc-api-specialist`, `redis-caching-specialist`
- **Infra skills**: `docker-workflow-automation`, `nginx-proxy-management`, `site-architecture`
- **Game dev**: All `unity-*`, `unreal-*`, `godot-*`, `roblox-*` agents
- **Stalwart**: All `stalwart-*` agents (mail platform not used here)
- **Sales/Support**: `sales-*`, `support-*` (not product-tier)
- **CI/CD**: `ops-cicd-github` and related workflow automation
