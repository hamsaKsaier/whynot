FROM node:20-slim

WORKDIR /app/gateway

# Copy package files
COPY gateway/package*.json ./
COPY gateway/tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY gateway/src/ ./src/

# Copy shared into /app/gateway/shared. All gateway src imports resolve
# to this one location (see tsconfig.json include), so no symlinks are
# needed. Module resolution from shared/*.ts walks up to
# /app/gateway/node_modules/.
COPY shared/ /app/gateway/shared/
# Overlay gateway-specific shared files (e.g. platform-ai-config-repository,
# extended billing-config-repository) on top of the base shared directory.
COPY gateway/shared/ /app/gateway/shared/

# Build TypeScript (excludes tests via gateway/tsconfig.json)
RUN npm run build

# Copy entrypoint script
COPY gateway/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose port
EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
