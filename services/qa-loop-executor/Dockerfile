FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Install ffmpeg for video stitching (screenshot frames → MP4)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

# Install Firefox browser WITH all system dependencies
RUN npx playwright install --with-deps firefox

# Create directory structure that matches local dev environment
RUN mkdir -p /shared

# Copy shared directory to the location expected by relative imports
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
