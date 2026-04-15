FROM node:20-slim

# Install Playwright dependencies
RUN apt-get update && apt-get install -y \
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
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY services/test-executor/package*.json ./
COPY services/test-executor/tsconfig.json ./

# Install dependencies
RUN npm install

# Install Playwright browsers and system dependencies
RUN npx playwright install chromium
RUN npx playwright install-deps chromium || true

# Copy shared directory (needed for TypeScript compilation)
COPY shared/ ./shared/
# Copy source code
COPY services/test-executor/src/ ./src/

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Run application
CMD ["npm", "start"]
