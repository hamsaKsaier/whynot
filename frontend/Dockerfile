FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 5173

# Run development server (for POC)
# In production, use: npm run build && npm run preview
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]













