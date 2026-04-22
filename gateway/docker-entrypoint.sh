#!/bin/sh
set -eu

# ── Persistent secrets directory ──────────────────────────────────────────────
# When a Docker named volume is mounted at /app/gateway/secrets, generated keys
# survive container restarts. Without the volume, keys are regenerated each time.

SECRETS_DIR="/app/gateway/secrets"
SECRETS_FILE="${SECRETS_DIR}/encryption-keys.env"

# ── Helper: generate a base64-encoded 32-byte key ────────────────────────────
generate_key() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32
  else
    node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  fi
}

# ── Save original env values (Docker/compose take precedence) ─────────────────
ORIG_SECRETS_KEY="${SECRETS_ENCRYPTION_KEY:-}"
ORIG_ENCRYPTION_KEY="${ENCRYPTION_KEY:-}"

# ── Load previously persisted keys (if any) ──────────────────────────────────
if [ -f "$SECRETS_FILE" ]; then
  echo "[entrypoint] Loading persisted encryption keys from ${SECRETS_FILE}"
  . "$SECRETS_FILE"
  export SECRETS_ENCRYPTION_KEY ENCRYPTION_KEY 2>/dev/null || true
fi

# ── Explicit env var takes precedence over persisted file ─────────────────────
if [ -n "$ORIG_SECRETS_KEY" ]; then
  SECRETS_ENCRYPTION_KEY="$ORIG_SECRETS_KEY"
  export SECRETS_ENCRYPTION_KEY
fi
if [ -n "$ORIG_ENCRYPTION_KEY" ]; then
  ENCRYPTION_KEY="$ORIG_ENCRYPTION_KEY"
  export ENCRYPTION_KEY
fi

# ── Generate SECRETS_ENCRYPTION_KEY if still empty ────────────────────────────
if [ -z "${SECRETS_ENCRYPTION_KEY:-}" ]; then
  SECRETS_ENCRYPTION_KEY="$(generate_key)"
  export SECRETS_ENCRYPTION_KEY
  echo "[entrypoint] Generated new SECRETS_ENCRYPTION_KEY"
fi

# ── Generate ENCRYPTION_KEY if still empty ────────────────────────────────────
if [ -z "${ENCRYPTION_KEY:-}" ]; then
  ENCRYPTION_KEY="$(generate_key)"
  export ENCRYPTION_KEY
  echo "[entrypoint] Generated new ENCRYPTION_KEY"
fi

# ── Persist keys for next restart ─────────────────────────────────────────────
mkdir -p "$SECRETS_DIR"
cat > "$SECRETS_FILE" <<EOF
SECRETS_ENCRYPTION_KEY="${SECRETS_ENCRYPTION_KEY}"
ENCRYPTION_KEY="${ENCRYPTION_KEY}"
EOF
chmod 600 "$SECRETS_FILE"

# ── Hand off to the original CMD ─────────────────────────────────────────────
exec "$@"
