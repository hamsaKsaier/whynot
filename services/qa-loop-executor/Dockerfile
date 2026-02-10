FROM node:20-slim

WORKDIR /app

# Copy package files
COPY services/qa-loop-executor/package*.json ./
COPY services/qa-loop-executor/tsconfig.json ./

# Install dependencies
RUN npm install

# Create directory structure that matches local dev environment
# shared is at ../../shared relative to /app/src, which means /shared
RUN mkdir -p /shared

# Copy shared directory to the location expected by relative imports
COPY shared/ /shared/

# Create symlink so shared folder can find node_modules
RUN ln -s /app/node_modules /shared/node_modules

# Copy source code
COPY services/qa-loop-executor/src/ ./src/

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Run application
CMD ["npm", "start"]
