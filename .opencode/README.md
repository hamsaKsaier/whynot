# `.opencode/` — Agents, Commands & Configuration

> **Single source of truth**: [`ARCHITECTURE.md`](../ARCHITECTURE.md) overrides any guidance in this directory.

This directory contains opencode agents, speckit commands, and configuration imported and adapted from the `serverless-v2` monorepo for the whynot platform. Every file has been re-mapped from Next.js/tRPC/Drizzle to **Vite + React / Express / raw SQL** conventions.

## Configuration

| File | Purpose |
|------|---------|
| `opencode.jsonc` | Provider config (Anthropic primary, Z.AI GLM optional), permissions, MCP servers, instruction loading |

## Imported Agents (`.opencode/agent/`)

### Design
| File | Purpose |
|------|---------|
| `design-brand-guardian.md` | Brand consistency |
| `design-image-prompt-engineer.md` | AI image prompts |
| `design-inclusive-visuals-specialist.md` | Accessible visual design |
| `design-ui-designer.md` | UI/visual design |
| `design-ux-architect.md` | UX architecture |
| `design-ux-researcher.md` | User research |
| `design-visual-storyteller.md` | Visual narrative |
| `design-whimsy-injector.md` | UI delight |
| `bulk-selection-specialist.md` | Bulk selection UX |
| `ui-designer.md` | General UI design |

### Frontend / Development
| File | Purpose |
|------|---------|
| `frontend-developer.md` | Frontend development |
| `react-specialist.md` | React patterns |
| `javascript-pro.md` | JavaScript expertise |
| `typescript-pro.md` | TypeScript expertise |
| `nextjs-app-router-expert.md` | Adapted for Vite routing |
| `nextjs-seo-expert.md` | SEO expertise (Vite-adapted) |
| `tanstack-router-expert.md` | Routing patterns |
| `e2e-playwright-specialist.md` | Playwright E2E testing |
| `pwa-specialist.md` | PWA patterns |

### Content / Marketing
| File | Purpose |
|------|---------|
| `blog-developer.md` | Blog development |
| `marketing-content-creator.md` | Content creation |
| `marketing-seo-specialist.md` | SEO strategy |
| `marketing-instagram-curator.md` | Instagram content |
| `marketing-podcast-strategist.md` | Podcast strategy |
| `marketing-wechat-official-account.md` | WeChat content |
| `marketing-weibo-strategist.md` | Weibo strategy |
| `marketing-zhihu-strategist.md` | Zhihu strategy |
| `marketing-baidu-seo-specialist.md` | Baidu SEO |
| `marketing-bilibili-content-strategist.md` | Bilibili content |
| `marketing-ai-citation-strategist.md` | AI citation strategy |
| `marketing-app-store-optimizer.md` | App store optimization |
| `marketing-book-co-author.md` | Book co-authoring |
| `marketing-carousel-growth-engine.md` | Carousel growth |
| `marketing-china-ecommerce-operator.md` | China e-commerce |
| `marketing-cross-border-ecommerce.md` | Cross-border e-commerce |
| `marketing-douyin-strategist.md` | Douyin strategy |
| `marketing-growth-hacker.md` | Growth hacking |
| `marketing-kuaishou-strategist.md` | Kuaishou platform |
| `marketing-linkedin-content-creator.md` | LinkedIn content |
| `marketing-livestream-commerce-coach.md` | Livestream commerce |
| `marketing-short-video-editing-coach.md` | Short video editing |
| `marketing-social-media-strategist.md` | Social media strategy |
| `marketing-tiktok-strategist.md` | TikTok strategy |
| `marketing-twitter-engager.md` | Twitter engagement |

### Paid Media
| File | Purpose |
|------|---------|
| `paid-media-auditor.md` | Paid media auditing |
| `paid-media-creative-strategist.md` | Creative strategy |
| `paid-media-paid-social-strategist.md` | Paid social strategy |
| `paid-media-ppc-strategist.md` | PPC strategy |
| `paid-media-programmatic-buyer.md` | Programmatic buying |
| `paid-media-search-query-analyst.md` | Search query analysis |
| `paid-media-tracking-specialist.md` | Tracking and attribution |

### Payment
| File | Purpose |
|------|---------|
| `lemonsqueezy-payment-expert.md` | LemonSqueezy integration |
| `moyasar-payment-expert.md` | Moyasar payment integration |
| `stripe-billing-specialist.md` | Stripe billing |
| `stripe-mcp-manager.md` | Stripe MCP tools |

### Product
| File | Purpose |
|------|---------|
| `product-manager.md` | Product management |
| `product-behavioral-nudge-engine.md` | Behavioral nudges |
| `product-feedback-synthesizer.md` | Feedback synthesis |
| `product-sprint-prioritizer.md` | Sprint prioritization |
| `product-trend-researcher.md` | Trend research |
| `conversion-optimizer.md` | Conversion optimization |
| `growth-strategist.md` | Growth strategy |

### i18n / Translation
| File | Purpose |
|------|---------|
| `translation-manager.md` | Translation management |
| `backend-i18n-developer.md` | Backend i18n implementation |

### Testing / QA
| File | Purpose |
|------|---------|
| `qa-expert.md` | QA expertise |
| `test-automator.md` | Test automation |
| `auth-tester.md` | Authentication testing |
| `performance-test-engineer.md` | Performance testing |
| `production-validator.md` | Production validation |
| `testing-*.md` (8 files) | Various testing specialties |

### Spec / Development Workflow
| File | Purpose |
|------|---------|
| `base-template-generator.md` | Template scaffolding |
| `spec-coordinator.md` | Spec coordination |
| `skill-creator.md` | Skill creation |
| `meta-prompt-engineer.md` | Meta-prompt engineering |
| `agents-orchestrator.md` | Multi-agent orchestration |
| `agents-prompt-engineer.md` | Agent prompt engineering |
| `code-reviewer.md` | Code review |
| `implementer-sparc-coder.md` | SPARC implementation |

## Speckit Commands (`.opencode/command/`)

| File | Purpose |
|------|---------|
| `speckit.analyze.md` | Analyze specs |
| `speckit.checklist.md` | Spec checklist |
| `speckit.clarify.md` | Clarify requirements |
| `speckit.constitution.md` | Constitution / principles |
| `speckit.implement.md` | Implementation workflow |
| `speckit.plan.md` | Planning workflow |
| `speckit.specify.md` | Specification writing |
| `speckit.tasks.md` | Task breakdown |
| `speckit.taskstoissues.md` | Tasks to issues conversion |

## Excluded from Import

- **DevOps**: `devops-engineer`, `deployment-engineer`, `docker-swarm-specialist`
- **Backend-core**: `backend-developer`, `dev-backend-api`, `drizzle-orm-expert`, `trpc-api-specialist`
- **Infra**: `opentofu-specialist`, `nginx-proxy-specialist`, `traefik-routing-specialist`
- **Caching**: `redis-caching-specialist`
- **Game dev**: All `unity-*`, `unreal-*`, `godot-*`, `roblox-*`, `blender-*`
- **Stalwart**: All `stalwart-*` agents
- **Sales/Support**: All `sales-*`, `support-*` agents
- **Data/ML**: `data-ml-model`, `data-consolidation-agent`, `clickhouse-analytics-expert`
- **Monitoring**: `external-service-monitor`, `uptime-monitor-specialist`, `cost-optimization-specialist`
- **Platform-specific**: `wp-compose-specialist`, `clawdbot-*`, `postal-transactional-specialist`
