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

# Build TypeScript (excludes tests via gateway/tsconfig.json)
RUN npm run build

# Expose port
EXPOSE 3000

# Run application
CMD ["npm", "start"]
