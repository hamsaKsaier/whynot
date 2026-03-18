# Deploying WhyNot to Railway

Step-by-step guide for deploying the WhyNot QA platform to [Railway.app](https://railway.app).

## Architecture Overview

WhyNot consists of 6 services + 1 database:

| Service | Port | Role |
|---------|------|------|
| **gateway** | 3000 | API gateway (Express) -- handles auth, routing, billing |
| **ai-service** | 8000 | AI provider proxy (FastAPI/Python) |
| **test-executor** | 3001 | Runs Playwright browser tests, exposes WebSocket |
| **qa-loop-executor** | 3002 | Orchestrates QA loop sessions with Firefox |
| **frontend** | 80 | React SPA (nginx) |
| **admin-frontend** | 80 | Admin React SPA (nginx) |
| **PostgreSQL** | 5432 | Database (Railway plugin) |

Services communicate internally via Railway's private networking (`*.railway.internal`).

---

## Prerequisites

- A [Railway](https://railway.app) account (Pro plan recommended for production)
- The repository pushed to GitHub
- API keys for Anthropic (or OpenAI)
- GitHub and/or Google OAuth app credentials
- Stripe keys (if billing is enabled)

---

## Step 1: Create the Railway Project

1. Go to [railway.app/new](https://railway.app/new)
2. Click **"Empty Project"**
3. Name it `whynot` (or your preferred name)

---

## Step 2: Add PostgreSQL

1. In your project, click **"+ New"** > **"Database"** > **"Add PostgreSQL"**
2. Railway auto-provisions the database and sets `DATABASE_URL`
3. Note: Migrations are run separately (Step 5)

---

## Step 3: Add Each Service

For each service below, click **"+ New"** > **"GitHub Repo"** > select your WhyNot repo.

### 3a. Gateway

| Setting | Value |
|---------|-------|
| **Root Directory** | `/` |
| **Dockerfile Path** | `gateway/Dockerfile` |
| **Port** | `3000` (Railway auto-detects from EXPOSE) |

**Environment variables:**
```
NODE_ENV=production
PORT=3000
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<generate with: openssl rand -base64 64>
FRONTEND_URL=https://<frontend-domain>
ADMIN_FRONTEND_URL=https://<admin-frontend-domain>
AI_SERVICE_URL=http://ai-service.railway.internal:8000
TEST_EXECUTOR_URL=http://test-executor.railway.internal:3001
QA_LOOP_EXECUTOR_URL=http://qa-loop-executor.railway.internal:3002
GITHUB_CLIENT_ID=<your-github-oauth-client-id>
GITHUB_CLIENT_SECRET=<your-github-oauth-secret>
GITHUB_CALLBACK_URL=https://<gateway-domain>/api/auth/github/callback
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<your-google-oauth-secret>
GOOGLE_CALLBACK_URL=https://<gateway-domain>/api/auth/google/callback
STRIPE_SECRET_KEY=<from-stripe-dashboard>
STRIPE_PUBLISHABLE_KEY=<from-stripe-dashboard>
STRIPE_WEBHOOK_SECRET=<from-stripe-webhooks>
STRIPE_SUCCESS_URL=https://<frontend-domain>/billing?success=true
STRIPE_CANCEL_URL=https://<frontend-domain>/billing?canceled=true
ALLOW_INTERNAL_SCAN=false
```

> Use `${{Postgres.DATABASE_URL}}` to reference the Railway Postgres variable.

### 3b. AI Service

| Setting | Value |
|---------|-------|
| **Root Directory** | `services/ai-service` |
| **Dockerfile Path** | `Dockerfile` |
| **Port** | `8000` |

**Environment variables:**
```
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=<your-key>
ANTHROPIC_MODEL=claude-sonnet-4-6
CORS_ORIGINS=https://<frontend-domain>,https://<admin-domain>,https://<gateway-domain>
```

### 3c. Test Executor

| Setting | Value |
|---------|-------|
| **Root Directory** | `/` |
| **Dockerfile Path** | `services/test-executor/Dockerfile` |
| **Port** | `3001` |

**Environment variables:**
```
NODE_ENV=production
PORT=3001
DATABASE_URL=${{Postgres.DATABASE_URL}}
AI_SERVICE_URL=http://ai-service.railway.internal:8000
DOCKER_ENV=true
PW_TEST_SCREENSHOT_NO_FONTS_READY=1
```

> This service needs the root directory set to `/` because it copies `shared/` during build.

### 3d. QA Loop Executor

| Setting | Value |
|---------|-------|
| **Root Directory** | `/` |
| **Dockerfile Path** | `services/qa-loop-executor/Dockerfile` |
| **Port** | `3002` |

**Environment variables:**
```
NODE_ENV=production
PORT=3002
DATABASE_URL=${{Postgres.DATABASE_URL}}
TEST_EXECUTOR_URL=http://test-executor.railway.internal:3001
```

### 3e. Frontend

| Setting | Value |
|---------|-------|
| **Root Directory** | `frontend` |
| **Dockerfile Path** | `Dockerfile` |
| **Port** | `80` |

**Build arguments** (set under Settings > Build):
```
VITE_API_URL=https://<gateway-domain>/api
VITE_WS_URL=wss://<test-executor-domain>
VITE_QA_LOOP_WS_URL=wss://<qa-loop-executor-domain>
```

**Environment variables** (for nginx proxy, if using `/api` relative path):
```
PORT=80
GATEWAY_URL=gateway.railway.internal:3000
WS_BACKEND_URL=test-executor.railway.internal:3001
QA_WS_BACKEND_URL=qa-loop-executor.railway.internal:3002
```

> If `VITE_API_URL` is set to the gateway's full URL (e.g., `https://api.whynot.com/api`), the frontend makes direct API calls and the nginx proxy is not used for API routes. The nginx proxy is a fallback for `/api` relative paths.

### 3f. Admin Frontend

| Setting | Value |
|---------|-------|
| **Root Directory** | `admin-frontend` |
| **Dockerfile Path** | `Dockerfile` |
| **Port** | `80` |

**Build arguments:**
```
VITE_API_URL=https://<gateway-domain>/api
```

**Environment variables:**
```
PORT=80
GATEWAY_URL=gateway.railway.internal:3000
```

---

## Step 4: Generate Domains

For each service that needs public access:

1. Click the service in Railway
2. Go to **Settings** > **Networking** > **Generate Domain** (or add custom domain)

Services that need public domains:
- **gateway** -- e.g., `api.yourdomain.com`
- **frontend** -- e.g., `app.yourdomain.com`
- **admin-frontend** -- e.g., `admin.yourdomain.com`
- **test-executor** -- e.g., `ws.yourdomain.com` (for WebSocket access)
- **qa-loop-executor** -- e.g., `qa-ws.yourdomain.com` (for WebSocket access)

Internal-only services (no public domain needed):
- **ai-service** -- accessed only by gateway/test-executor via private networking

---

## Step 5: Run Database Migrations

Option A -- via Railway CLI:
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and link project
railway login
railway link

# Select the gateway service, then run migrations
railway run bash scripts/run-migrations.sh
```

Option B -- via Railway dashboard:
1. Open the gateway service
2. Click **"Shell"** tab
3. Run: `bash scripts/run-migrations.sh`

The migration script tracks applied migrations in a `_migrations` table, so it is safe to run multiple times.

---

## Step 6: Custom Domains (Optional)

1. In Railway, go to each service > **Settings** > **Networking**
2. Click **"Custom Domain"** and add your domain
3. Configure DNS:
   - Add a `CNAME` record pointing to the Railway-provided domain
   - Railway handles SSL automatically
4. Update environment variables to reflect the new domains:
   - `FRONTEND_URL`, `ADMIN_FRONTEND_URL` on gateway
   - `GITHUB_CALLBACK_URL`, `GOOGLE_CALLBACK_URL` on gateway
   - `CORS_ORIGINS` on ai-service
   - Rebuild frontends with updated `VITE_API_URL`, `VITE_WS_URL`, `VITE_QA_LOOP_WS_URL`

---

## Step 7: Configure Stripe Webhooks

1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://<gateway-domain>/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET` on the gateway service

---

## Verification

After deployment, verify each service:

```bash
# Gateway health
curl https://<gateway-domain>/health

# AI Service (via gateway)
curl https://<gateway-domain>/health
# Check "dependencies.aiService.status" in response

# Frontend
curl -I https://<frontend-domain>/

# Admin Frontend
curl -I https://<admin-frontend-domain>/
```

---

## Cost Estimates

Railway pricing (as of 2025, Pro plan):

| Resource | Estimated Monthly Cost |
|----------|----------------------|
| **PostgreSQL** (1 GB) | ~$5 |
| **Gateway** (0.5 vCPU, 512 MB) | ~$5 |
| **AI Service** (0.5 vCPU, 512 MB) | ~$5 |
| **Test Executor** (2 vCPU, 4 GB) | ~$25-40 |
| **QA Loop Executor** (1 vCPU, 2 GB) | ~$15-20 |
| **Frontend** (nginx, minimal) | ~$2 |
| **Admin Frontend** (nginx, minimal) | ~$2 |
| **Bandwidth** (varies) | ~$5-10 |
| **Total estimate** | **~$65-90/month** |

Notes:
- Test Executor is the most resource-intensive (runs headless Chromium)
- QA Loop Executor runs Firefox for autonomous testing sessions
- Costs scale with usage -- idle services consume less
- Railway charges per second of usage, so costs decrease when services are idle
- The Hobby plan ($5/month) may work for low-traffic staging environments

---

## Troubleshooting

### Services can't reach each other
- Verify private networking is enabled (Railway Settings > Networking)
- Use `*.railway.internal` hostnames for internal communication
- Check that service ports match the `_URL` environment variables

### Frontend shows CORS errors
- Verify `FRONTEND_URL` and `ADMIN_FRONTEND_URL` match the actual domains
- Check `CORS_ORIGINS` on ai-service includes all frontend domains
- Gateway CORS is configured via `FRONTEND_URL` and `ADMIN_FRONTEND_URL`

### Database migrations fail
- Ensure `DATABASE_URL` is set (check Railway variables)
- Try running `psql $DATABASE_URL -c "SELECT 1"` first to test connectivity
- Check the `_migrations` table if specific migrations are failing

### WebSocket connections fail
- Ensure test-executor and qa-loop-executor have public domains
- Verify `VITE_WS_URL` and `VITE_QA_LOOP_WS_URL` use `wss://` (not `ws://`)
- Check Railway networking allows WebSocket upgrades (it does by default)

### Build failures for test-executor or qa-loop-executor
- These services need root directory set to `/` to access `shared/`
- The Playwright browser install step can take several minutes
- Ensure Railway has enough build resources (increase in Settings if needed)
