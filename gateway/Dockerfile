FROM node:20-slim

WORKDIR /app

# Copy package files
COPY gateway/package*.json ./
COPY gateway/tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY gateway/src/ ./src/
# Copy shared types (needed for build)
COPY shared/ ./shared/

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Run application
CMD ["npm", "start"]

