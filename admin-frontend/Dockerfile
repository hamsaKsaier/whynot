# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build args become VITE_ env vars at build time
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Stage 2: Serve with nginx ──────────────────────────────────────────────
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config template
COPY nginx.conf.template /etc/nginx/nginx.conf.template

# Default env vars for nginx template (Docker Compose defaults)
ENV PORT=80
ENV GATEWAY_URL=gateway:3000

EXPOSE 80

# Substitute env vars at startup, auto-detect DNS resolver from /etc/resolv.conf.
# Wrap IPv6 addresses in brackets for nginx resolver directive. This is the same
# pattern as frontend/Dockerfile — required so nginx can re-resolve
# *.railway.internal hosts per-request (Railway DNS is IPv6 and changes on redeploy).
CMD ["/bin/sh", "-c", "RAW_NS=$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf) && case \"$RAW_NS\" in *:*) export RESOLVER=\"[$RAW_NS]\";; *) export RESOLVER=\"$RAW_NS\";; esac && envsubst '${PORT} ${GATEWAY_URL} ${RESOLVER}' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
