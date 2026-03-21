FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Install ffmpeg for video stitching (screenshot frames → MP4)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

# Install Chromium browser WITH all system dependencies.
# --with-deps tells Playwright to auto-install all required OS packages for the browser.
# Chromium is used instead of Firefox because Firefox crashes in Railway's container environment.
RUN npx playwright install --with-deps chromium

# Copy shared directory (already copied into service dir for Railway builds)
COPY shared/ ./shared/

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
