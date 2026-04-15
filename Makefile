# ============================================
# whynot Platform - Docker Orchestration
# ============================================
# All commands run against docker/compose/docker-compose.yml
# Ports and credentials load from .env (copy from .env.example).

-include .env
export

COMPOSE_FILE      := docker/compose/docker-compose.yml
COMPOSE_TEST_FILE := docker/compose/docker-compose.test.yml
ENV_FILE          := .env

PROJECT_NAME := whynot

DC     := DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 docker compose -p $(PROJECT_NAME)
DC_RUN  = $(DC) -f $(COMPOSE_FILE) --env-file $(ENV_FILE)
DC_TST  = $(DC) -f $(COMPOSE_TEST_FILE) --env-file $(ENV_FILE)

.DEFAULT_GOAL := help

# ============================================
# HELP
# ============================================

.PHONY: help
help: ## Show this help message
	@awk 'BEGIN{FS=":.*##"; printf "\nwhynot — available targets:\n\n"} \
	     /^[a-zA-Z_-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 } \
	     /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0,5) }' $(MAKEFILE_LIST)
	@echo ""

# ============================================
# PREREQUISITES
# ============================================

.PHONY: check-env
check-env: ## Ensure .env exists (copy from .env.example if not)
	@if [ ! -f $(ENV_FILE) ]; then \
	  echo "No .env found — copying from .env.example"; \
	  cp .env.example $(ENV_FILE); \
	fi

##@ Core lifecycle

.PHONY: start
start: check-env ## Start all services in the background
	@echo "Starting whynot services..."
	$(DC_RUN) up -d

.PHONY: start-build
start-build: check-env ## Start all services with rebuild
	@echo "Building and starting whynot services..."
	$(DC_RUN) up -d --build

.PHONY: stop
stop: ## Stop services (keeps containers and volumes)
	$(DC_RUN) stop

.PHONY: down
down: ## Stop and remove containers (keeps volumes)
	$(DC_RUN) down

.PHONY: restart
restart: ## Restart all services (no rebuild)
	$(DC_RUN) restart

.PHONY: rebuild
rebuild: check-env ## Rebuild all images without cache and restart
	$(DC_RUN) build --no-cache
	$(DC_RUN) up -d

.PHONY: clean
clean: ## Remove containers, networks, volumes, and local images (destructive)
	$(DC_RUN) down -v --rmi local

##@ Logs

.PHONY: logs
logs: ## Tail logs from all services
	$(DC_RUN) logs -f

.PHONY: logs-gateway
logs-gateway: ## Tail gateway logs
	$(DC_RUN) logs -f gateway

.PHONY: logs-frontend
logs-frontend: ## Tail frontend logs
	$(DC_RUN) logs -f frontend

.PHONY: logs-admin
logs-admin: ## Tail admin-frontend logs
	$(DC_RUN) logs -f admin-frontend

.PHONY: logs-ai
logs-ai: ## Tail ai-service logs
	$(DC_RUN) logs -f ai-service

.PHONY: logs-db
logs-db: ## Tail database logs
	$(DC_RUN) logs -f database

.PHONY: logs-test-executor
logs-test-executor: ## Tail test-executor logs
	$(DC_RUN) logs -f test-executor

.PHONY: logs-qa-loop
logs-qa-loop: ## Tail qa-loop-executor logs
	$(DC_RUN) logs -f qa-loop-executor

##@ Status and inspection

.PHONY: ps
ps: ## List running services
	$(DC_RUN) ps

.PHONY: status
status: ps ## Alias for ps

.PHONY: ports
ports: ## Show port bindings
	$(DC_RUN) ps --format 'table {{.Name}}\t{{.Ports}}'

.PHONY: config
config: ## Render the fully interpolated compose config
	$(DC_RUN) config

##@ Shell access

.PHONY: shell-gateway
shell-gateway: ## Open a shell inside the gateway container
	$(DC_RUN) exec gateway sh

.PHONY: shell-frontend
shell-frontend: ## Open a shell inside the frontend container
	$(DC_RUN) exec frontend sh

.PHONY: shell-admin
shell-admin: ## Open a shell inside the admin-frontend container
	$(DC_RUN) exec admin-frontend sh

.PHONY: shell-ai
shell-ai: ## Open a shell inside the ai-service container
	$(DC_RUN) exec ai-service sh

.PHONY: shell-test-executor
shell-test-executor: ## Open a shell inside the test-executor container
	$(DC_RUN) exec test-executor sh

.PHONY: shell-qa-loop
shell-qa-loop: ## Open a shell inside the qa-loop-executor container
	$(DC_RUN) exec qa-loop-executor sh

.PHONY: psql
psql: ## Open a psql shell in the database container
	$(DC_RUN) exec database psql -U $${POSTGRES_USER:-whynot} -d $${POSTGRES_DB:-whynot}

.PHONY: shell-db
shell-db: psql ## Alias for psql

##@ Tests

.PHONY: test
test: check-env ## Run gateway + frontend + admin + shared tests
	$(DC_TST) run --rm gateway-test
	$(DC_TST) run --rm frontend-test
	$(DC_TST) run --rm admin-frontend-test
	$(DC_TST) run --rm shared-test

.PHONY: test-gateway
test-gateway: check-env ## Run gateway tests
	$(DC_TST) run --rm gateway-test

.PHONY: test-frontend
test-frontend: check-env ## Run frontend tests
	$(DC_TST) run --rm frontend-test

.PHONY: test-admin
test-admin: check-env ## Run admin-frontend tests
	$(DC_TST) run --rm admin-frontend-test

.PHONY: test-shared
test-shared: check-env ## Run shared tests
	$(DC_TST) run --rm shared-test

.PHONY: test-e2e
test-e2e: check-env ## Run Playwright end-to-end tests
	$(DC_TST) run --rm playwright

.PHONY: test-down
test-down: ## Remove test containers, networks, and volumes
	$(DC_TST) down -v

##@ Code review graph

.PHONY: graph-install graph-build graph-update graph-recheck graph-watch graph-status graph-eval graph-viz graph-clean graph-help

graph-install: ## Install code-review-graph and configure MCP for detected AI tools
	@echo "Installing code-review-graph..."
	@if command -v uvx >/dev/null 2>&1; then \
	  uvx code-review-graph install; \
	elif command -v pipx >/dev/null 2>&1; then \
	  pipx install code-review-graph && code-review-graph install; \
	else \
	  pip install --user code-review-graph && code-review-graph install; \
	fi

graph-build: ## Build the initial code review graph (first run may take several minutes)
	@echo "Building code review graph (this may take a while on the first run)..."
	code-review-graph build

graph-update: ## Incremental re-index of changed files (fast, <2s typical)
	code-review-graph update

graph-recheck: ## Force a full rescan of the codebase (slower than graph-update)
	code-review-graph build

graph-watch: ## Continuous watch mode: keep the graph fresh as files change
	code-review-graph watch

graph-status: ## Print graph statistics (nodes, edges, languages, last update)
	code-review-graph status

graph-eval: ## Run the token-reduction benchmark against recent commits
	code-review-graph eval --all

graph-viz: ## Launch the interactive graph visualization on http://localhost:8765
	code-review-graph visualize --serve

graph-clean: ## Remove the local graph database (next build will be from scratch)
	rm -rf .code-review-graph

graph-help: ## Show all code-review-graph commands
	code-review-graph --help
