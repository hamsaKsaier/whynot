#!/usr/bin/env bash
# ============================================================================
# deploy-railway.sh -- Helper script for deploying WhyNot to Railway.app
#
# Prerequisites:
#   - Railway CLI installed: npm i -g @railway/cli
#   - Logged in: railway login
# ============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; }

# ── Pre-flight checks ────────────────────────────────────────────────────────
check_prerequisites() {
  info "Checking prerequisites..."

  if ! command -v railway &> /dev/null; then
    err "Railway CLI not found. Install with: npm i -g @railway/cli"
    exit 1
  fi
  ok "Railway CLI found"

  if ! railway whoami &> /dev/null 2>&1; then
    err "Not logged in. Run: railway login"
    exit 1
  fi
  ok "Logged in to Railway"
}

# ── Main menu ─────────────────────────────────────────────────────────────────
show_menu() {
  echo ""
  echo "========================================="
  echo "  WhyNot -- Railway Deployment Helper"
  echo "========================================="
  echo ""
  echo "  1) Create new Railway project"
  echo "  2) Add Postgres database"
  echo "  3) Deploy all services"
  echo "  4) Run database migrations"
  echo "  5) Show required environment variables"
  echo "  6) Open Railway dashboard"
  echo "  7) View service logs"
  echo "  8) Full setup (steps 1-4)"
  echo "  0) Exit"
  echo ""
  read -rp "Select option: " choice
}

create_project() {
  info "Creating Railway project..."
  railway init
  ok "Project created. Link it with: railway link"
}

add_postgres() {
  info "Adding Postgres plugin..."
  echo "Run the following in the Railway dashboard:"
  echo "  1. Open your project at https://railway.app/dashboard"
  echo "  2. Click '+ New' > 'Database' > 'Add PostgreSQL'"
  echo "  3. Railway will automatically set DATABASE_URL for linked services"
  echo ""
  warn "After adding Postgres, run option 4 to apply migrations."
}

deploy_services() {
  info "Deploying services to Railway..."
  echo ""
  echo "Railway services to create (via dashboard or CLI):"
  echo ""
  echo "  Service Name        | Root Directory              | Dockerfile"
  echo "  --------------------|-----------------------------|---------------------------------"
  echo "  gateway             | /                           | gateway/Dockerfile"
  echo "  ai-service          | services/ai-service         | Dockerfile"
  echo "  test-executor       | /                           | services/test-executor/Dockerfile"
  echo "  qa-loop-executor    | /                           | services/qa-loop-executor/Dockerfile"
  echo "  frontend            | frontend                    | Dockerfile"
  echo "  admin-frontend      | admin-frontend              | Dockerfile"
  echo ""
  echo "For each service, in the Railway dashboard:"
  echo "  1. Click '+ New' > 'GitHub Repo' > select your repo"
  echo "  2. Set the Root Directory and Dockerfile Path as shown above"
  echo "  3. Set the required environment variables (option 5)"
  echo "  4. Deploy"
  echo ""
  warn "Services that use the root context (gateway, test-executor, qa-loop-executor)"
  warn "need Root Directory set to '/' so they can access the 'shared/' directory."
}

run_migrations() {
  info "Running migrations via Railway..."
  echo ""
  echo "Make sure you have linked your project: railway link"
  echo "Then select the gateway service and run:"
  echo ""
  echo "  railway run bash scripts/run-migrations.sh"
  echo ""
  read -rp "Run migrations now? (y/n): " confirm
  if [[ "$confirm" == "y" ]]; then
    railway run bash scripts/run-migrations.sh
    ok "Migrations complete"
  fi
}

show_env_vars() {
  echo ""
  echo "========================================="
  echo "  Required Environment Variables"
  echo "========================================="
  echo ""
  echo "-- ALL BACKEND SERVICES (gateway, test-executor, qa-loop-executor) --"
  echo "  DATABASE_URL          (auto-set by Railway Postgres plugin)"
  echo "  NODE_ENV=production"
  echo ""
  echo "-- GATEWAY --"
  echo "  JWT_SECRET            (openssl rand -base64 64)"
  echo "  FRONTEND_URL          (e.g., https://app.yourdomain.com)"
  echo "  ADMIN_FRONTEND_URL    (e.g., https://admin.yourdomain.com)"
  echo "  AI_SERVICE_URL        (e.g., http://ai-service.railway.internal:8000)"
  echo "  TEST_EXECUTOR_URL     (e.g., http://test-executor.railway.internal:3001)"
  echo "  QA_LOOP_EXECUTOR_URL  (e.g., http://qa-loop-executor.railway.internal:3002)"
  echo "  GITHUB_CLIENT_ID      (from GitHub OAuth app)"
  echo "  GITHUB_CLIENT_SECRET"
  echo "  GITHUB_CALLBACK_URL   (https://api.yourdomain.com/api/auth/github/callback)"
  echo "  GOOGLE_CLIENT_ID      (from Google Cloud Console)"
  echo "  GOOGLE_CLIENT_SECRET"
  echo "  GOOGLE_CALLBACK_URL   (https://api.yourdomain.com/api/auth/google/callback)"
  echo "  STRIPE_SECRET_KEY"
  echo "  STRIPE_PUBLISHABLE_KEY"
  echo "  STRIPE_WEBHOOK_SECRET"
  echo "  STRIPE_SUCCESS_URL    (https://app.yourdomain.com/billing?success=true)"
  echo "  STRIPE_CANCEL_URL     (https://app.yourdomain.com/billing?canceled=true)"
  echo ""
  echo "-- AI SERVICE --"
  echo "  LLM_PROVIDER=anthropic"
  echo "  ANTHROPIC_API_KEY"
  echo "  ANTHROPIC_MODEL=claude-sonnet-4-6"
  echo "  CORS_ORIGINS          (comma-separated frontend URLs)"
  echo ""
  echo "-- TEST EXECUTOR --"
  echo "  AI_SERVICE_URL        (http://ai-service.railway.internal:8000)"
  echo "  PORT=3001"
  echo ""
  echo "-- QA LOOP EXECUTOR --"
  echo "  TEST_EXECUTOR_URL     (http://test-executor.railway.internal:3001)"
  echo "  PORT=3002"
  echo ""
  echo "-- FRONTEND (build args) --"
  echo "  VITE_API_URL          (https://api.yourdomain.com/api)"
  echo "  VITE_WS_URL           (wss://test-executor.yourdomain.com)"
  echo "  VITE_QA_LOOP_WS_URL   (wss://qa-loop.yourdomain.com)"
  echo ""
  echo "-- ADMIN FRONTEND (build args) --"
  echo "  VITE_API_URL          (https://api.yourdomain.com/api)"
  echo ""
}

open_dashboard() {
  info "Opening Railway dashboard..."
  railway open 2>/dev/null || echo "Visit: https://railway.app/dashboard"
}

view_logs() {
  info "Viewing logs..."
  railway logs
}

full_setup() {
  create_project
  echo ""
  add_postgres
  echo ""
  deploy_services
  echo ""
  show_env_vars
  echo ""
  ok "Setup guide complete. Follow the steps above in the Railway dashboard."
  ok "After deploying, run option 4 to apply database migrations."
}

# ── Entry point ───────────────────────────────────────────────────────────────
check_prerequisites

while true; do
  show_menu
  case $choice in
    1) create_project ;;
    2) add_postgres ;;
    3) deploy_services ;;
    4) run_migrations ;;
    5) show_env_vars ;;
    6) open_dashboard ;;
    7) view_logs ;;
    8) full_setup ;;
    0) echo "Bye!"; exit 0 ;;
    *) err "Invalid option" ;;
  esac
done
