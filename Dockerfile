# === Stage 1: Build ===
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code and config
COPY . .

# Build the app
RUN npm run build

# === Stage 2: Production ===
FROM node:20-alpine AS production

WORKDIR /app

# Set NODE_ENV
ENV NODE_ENV=production

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy built app from builder stage
COPY --from=builder /app/dist ./dist

# Copy threat intelligence JSON (kay ginabasa ni sa runtime)
COPY --from=builder /app/src/threat-intelligence ./dist/threat-intelligence
COPY --from=builder /app/src/threat-intelligence ./src/threat-intelligence

# Expose the port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -q --spider http://localhost:3000/v1/blockchain/status || exit 1

# Run the app
CMD ["node", "dist/main.js"]