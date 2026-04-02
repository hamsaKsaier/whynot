# Stage 1: Copy k6 binary from official image (avoids SSL/download issues on Railway)
FROM grafana/k6:0.54.0 AS k6

# Stage 2: Build the actual service
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Install ffmpeg for video stitching (screenshot frames → MP4)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

# Copy k6 binary from stage 1
COPY --from=k6 /usr/bin/k6 /usr/local/bin/k6

# Install Chromium browser WITH all system dependencies.
# --with-deps tells Playwright to auto-install all required OS packages for the browser.
# Chromium is used instead of Firefox because Firefox crashes in Railway's container environment.
RUN npx playwright install --with-deps chromium

# Copy shared directory to /shared/ (root level) because source files use
# relative imports like ../../../shared/ which resolve above /app/
COPY shared/ /shared/

# Create symlink so shared folder can find node_modules
RUN ln -s /app/node_modules /shared/node_modules

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Run application
CMD ["npm", "start"]
