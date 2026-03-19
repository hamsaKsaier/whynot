FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src/ ./src/
# Copy shared types (needed for build)
COPY shared/ ./shared/

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Run application
CMD ["npm", "start"]
