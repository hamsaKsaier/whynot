# Local Staging

Test a feature branch on your own machine without touching your running
local stack or your deployment.

Staging runs on **different ports** so it can coexist with your normal
dev environment.

| Service        | Staging URL                    | Normal (local) |
|----------------|-------------------------------|----------------|
| Frontend       | http://localhost:5283          | :5183          |
| Admin          | http://localhost:5284          | :5184          |
| Gateway API    | http://localhost:3110          | :3010          |
| QA Loop WS     | ws://localhost:3112            | :3012          |
| Database       | localhost:5434                 | :5433          |

---

## Prerequisites

- Docker Desktop is running (`docker --version` should work)
- You're in the repo root
- A `.env.staging` file exists (it is gitignored — copy `.env.example`
  and adjust, or copy your `.env` and change `POSTGRES_DB` so staging
  gets its own database)

---

## Start staging on a branch

```bash
./scripts/staging.sh up <branch-name>
```

This will:
1. Fetch + checkout the branch
2. Build all Docker images from that branch
3. Start the full stack with a **separate staging database**

First run takes ~5 min (image builds). Subsequent runs are fast.

---

## Common commands

```bash
# Start on a branch
./scripts/staging.sh up <branch-name>

# Check all services are healthy
./scripts/staging.sh ps

# Tail logs for a specific service
./scripts/staging.sh logs qa-loop-executor
./scripts/staging.sh logs gateway
./scripts/staging.sh logs frontend

# After new commits land on the branch — pull and rebuild
./scripts/staging.sh pull <branch-name>

# Rebuild just the frontend (fastest for UI-only changes)
./scripts/staging.sh rebuild frontend

# Stop staging
./scripts/staging.sh down

# Wipe staging database (fresh start)
./scripts/staging.sh reset-db
```

---

## Reviewing a contributor's PR

1. **Start staging on their branch:**
   ```bash
   ./scripts/staging.sh up <branch-name>
   ```

2. **Open** http://localhost:5283 and exercise whatever the PR touches —
   at minimum, run one scan end to end.

3. **If you find a bug**, grab the log and attach it to the PR:
   ```bash
   ./scripts/staging.sh logs qa-loop-executor
   ```

4. **After they push a fix:**
   ```bash
   ./scripts/staging.sh pull <branch-name>
   ```

5. **If everything works** → approve and merge the PR.

6. **Stop staging when done:**
   ```bash
   ./scripts/staging.sh down
   ```

---

## Troubleshooting

**Port already in use?**
```bash
lsof -i :5283   # frontend
lsof -i :3110   # gateway
lsof -i :5434   # database
# kill the conflicting process or change ports in docker-compose.staging.yml
```

**Service not starting?**
```bash
./scripts/staging.sh logs <service-name>
```

**Database migration issues?**
```bash
./scripts/staging.sh reset-db   # wipes and reruns migrations
```

**Build fails?**
```bash
docker compose -f docker-compose.staging.yml --env-file .env.staging build --no-cache
```

---

## Files involved

| File | Purpose |
|------|---------|
| `.env.staging` | Staging env vars — separate DB, your own API keys (gitignored) |
| `docker-compose.staging.yml` | Staging compose — offset ports, separate volumes |
| `scripts/staging.sh` | Helper script for common staging commands |

**Staging never touches `docker-compose.yml` or `.env`** — those drive your
normal stack.
