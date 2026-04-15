# 18 — Superadmin Subdomain: Nginx + Routing + CORS

## Agent
`api-designer`

## Skills referenced
- `.claude/skills/spec-driven-development/`

## Task

Today `whynot.skrum.io` → frontend (5183) and `admin.whynot.skrum.io` → admin-frontend (5184). The user wants superadmin to live at `superadmin.whynot.skrum.io`. Since all superadmin pages already live inside `admin-frontend` (13 pages role-gated on `super_admin`), the decision is to add `superadmin.whynot.skrum.io` as a hostname alias that proxies to the same `admin-frontend:5184` upstream — no separate SPA.

The repo copy is at `docker/nginx/whynot.skrum.io`. The production host file is `/etc/nginx/sites-available/whynot`.

### Scope / Requirements

1. **Edit `docker/nginx/whynot.skrum.io`**
   - Add a new `server { }` block with `server_name superadmin.whynot.skrum.io;`
   - Upstream: reuse `whynot_admin_frontend` (127.0.0.1:5184).
   - Same TLS, same `/api/` proxy to `whynot_gateway` (127.0.0.1:3010), same rate limiting zones.
   - Same buffer/timeout/upload config as the existing `admin.whynot.skrum.io` block.
   - Security headers identical.
   - Add to the header comment at the top of the file: `- superadmin.whynot.skrum.io → Admin Frontend SPA (superadmin namespace): 5184` and a note that this is a hostname alias for the superadmin namespace.

2. **Update the install instructions comment**
   - `sudo ln -s /home/serverlessbase/whynot/docker/nginx/whynot.skrum.io /etc/nginx/sites-available/whynot.skrum.io`
   - `sudo ln -s /etc/nginx/sites-available/whynot.skrum.io /etc/nginx/sites-enabled/whynot.skrum.io`
   - `sudo nginx -t && sudo systemctl reload nginx`
   - `sudo certbot --nginx -d whynot.skrum.io -d admin.whynot.skrum.io -d superadmin.whynot.skrum.io`
   - Include a note that if the host file at `/etc/nginx/sites-available/whynot` already exists (the old non-versioned copy), the operator must remove or replace it before the symlink works.

3. **Host nginx file sync**
   - After editing `docker/nginx/whynot.skrum.io`, the same changes must be mirrored onto `/etc/nginx/sites-available/whynot` (or `/etc/nginx/sites-available/whynot.skrum.io`) on the host. Since this prompt is remediation, include operator steps in the prompt for the user to run:
     1. `sudo cp /home/serverlessbase/whynot/docker/nginx/whynot.skrum.io /etc/nginx/sites-available/whynot.skrum.io`
     2. `sudo nginx -t`
     3. `sudo systemctl reload nginx`
   - OR document a symlink-based approach: `sudo ln -sf /home/serverlessbase/whynot/docker/nginx/whynot.skrum.io /etc/nginx/sites-available/whynot.skrum.io`. Prefer the symlink so future edits auto-propagate.

4. **CORS allowlist in gateway**
   - `gateway/src/main.ts` (or wherever CORS is configured) must include `https://superadmin.whynot.skrum.io` in the allowlist alongside `https://whynot.skrum.io` and `https://admin.whynot.skrum.io`.
   - Env var: add `CORS_ALLOWED_ORIGINS` as comma-separated list in `.env.example` (coordinate with prompt 20).
   - Include localhost dev origins (`http://localhost:5183`, `http://localhost:5184`).

5. **Admin frontend hostname awareness (optional)**
   - `admin-frontend/src/lib/hostname.ts` — helper that returns `"admin" | "superadmin"` based on `window.location.hostname`.
   - When loaded via `superadmin.whynot.skrum.io`, the landing redirect on successful login goes to `/users` (or the superadmin dashboard index) instead of the general admin home.
   - Sidebar shows only superadmin nav groups when on the superadmin hostname.
   - Non-superadmin users who somehow reach `superadmin.whynot.skrum.io` get a clear "access denied — contact administrator" page in their language, then redirected to `admin.whynot.skrum.io`.

6. **Stripe webhook endpoint**
   - Verify the Stripe webhook endpoint (`/api/webhooks/stripe`) is accessible via all three hostnames OR explicitly pinned to one (preferred). Document the pinned hostname in the nginx config.

7. **DNS note**
   - This prompt is nginx + app-side only. DNS records for `superadmin.whynot.skrum.io` must already exist (A/AAAA record pointing to the same host). Document this prerequisite in the PR description.

### Tests (MANDATORY — 100% coverage for new logic)
- **Nginx config parse**: `nginx -t` inside a test container — assert exit 0.
- **Hostname helper test**: `admin-frontend/src/lib/hostname.test.ts` — mock `window.location.hostname` and assert correct mode returned.
- **Role gating test**: e2e test using `superadmin.whynot.skrum.io` as the origin asserts non-superadmin users cannot load the superadmin pages.
- **CORS test**: fire a preflight from `https://superadmin.whynot.skrum.io` to the gateway and assert `Access-Control-Allow-Origin` header matches.
- **Integration**: in CI, use a local nginx container with the updated config and hit all three hostnames via `curl -k --resolve` and assert 200 / 200 / 200.

### i18n (5 languages)
- New "access denied" page for non-superadmins reaching the superadmin host → keys under `admin.accessDenied.*`.
- Translated via prompts 02-05.

### Documentation
- Update `/docs/en/deployment/nginx-setup.md` — full walkthrough of installing the nginx config, running `certbot`, adding all three hostnames.
- Update `/docs/en/admin/superadmin/access.md` — how to reach the superadmin area, who has access, what changes between `admin.` and `superadmin.` hostnames.
- 5-language variants for both docs.
- Update `README.md` (coordinate with prompt 21).

### Constraints
- Docker-only for app changes: `make shell-admin`, `make shell-gateway`.
- Nginx edits are non-Docker (host-level) but must be symlinked from the repo file for consistency.
- No DNS automation in code — document as prerequisite.
- Preserve existing `whynot.skrum.io` and `admin.whynot.skrum.io` routing.
- Reuse existing upstream blocks — don't duplicate `whynot_admin_frontend`.
- Certbot renewal must cover all three hostnames.
- Security headers identical across all three hostnames.

### Verification steps
1. `make shell-gateway npm run typecheck && make shell-gateway npm run lint && make shell-gateway npm test -- cors`
2. `make shell-admin npm run typecheck && make shell-admin npm run lint && make shell-admin npm test -- hostname`
3. `nginx -t -c /home/serverlessbase/whynot/docker/nginx/whynot.skrum.io` (if that's a valid test path — otherwise test inside a container).
4. Operator runs on host:
   - `sudo ln -sf /home/serverlessbase/whynot/docker/nginx/whynot.skrum.io /etc/nginx/sites-available/whynot.skrum.io`
   - `sudo nginx -t && sudo systemctl reload nginx`
   - `sudo certbot --nginx -d whynot.skrum.io -d admin.whynot.skrum.io -d superadmin.whynot.skrum.io`
5. `curl -I https://superadmin.whynot.skrum.io` returns 200.
6. Sign in as `super_admin` via `https://superadmin.whynot.skrum.io/login` and confirm the superadmin dashboard loads.
7. Sign in as a regular user (non-superadmin) and confirm access denied flow.
