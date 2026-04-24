# ─── Stage 1: builder ────────────────────────────────────────────────
# Pre-compiles Python wheels and fetches external recon binaries so the
# runtime image stays lean (~300 MB vs ~1 GB for a single-stage build).
FROM python:3.12-slim AS builder

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        ca-certificates \
        unzip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY requirements.txt .
RUN pip wheel --wheel-dir=/wheels -r requirements.txt

# Official subfinder binary (projectdiscovery) — pinned version.
ARG SUBFINDER_VERSION=2.6.4
RUN curl -fsSL -o /tmp/subfinder.zip \
        "https://github.com/projectdiscovery/subfinder/releases/download/v${SUBFINDER_VERSION}/subfinder_${SUBFINDER_VERSION}_linux_amd64.zip" \
    && unzip /tmp/subfinder.zip -d /tmp/subfinder \
    && mv /tmp/subfinder/subfinder /usr/local/bin/subfinder \
    && chmod +x /usr/local/bin/subfinder \
    && rm -rf /tmp/subfinder /tmp/subfinder.zip

# ─── Stage 2: runtime ────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

# OS-level recon tooling + Chromium system deps (bookworm-compatible).
RUN apt-get update && apt-get install -y --no-install-recommends \
        nmap \
        whatweb \
        curl \
        ca-certificates \
        libnss3 \
        libnspr4 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libcups2 \
        libdrm2 \
        libdbus-1-3 \
        libxkbcommon0 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxrandr2 \
        libgbm1 \
        libasound2 \
        fonts-liberation \
        fonts-unifont \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /wheels /wheels
COPY --from=builder /usr/local/bin/subfinder /usr/local/bin/subfinder

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-index --find-links=/wheels -r /tmp/requirements.txt \
    && rm -rf /wheels /tmp/requirements.txt

# Install Chromium browser binary only (deps installed above).
RUN playwright install chromium

# Non-root user.
RUN useradd --create-home --shell /usr/sbin/nologin --uid 1001 recon \
    && mkdir -p /app \
    && chown -R recon:recon /app /home/recon

WORKDIR /app
COPY --chown=recon:recon app/ ./app/

USER recon

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -fsS http://localhost:8001/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
