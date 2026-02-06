# Stage 1: Builder
FROM node:23-slim AS builder

WORKDIR /app

# Upgrade npm to version 11 for lock file compatibility
RUN npm install -g npm@latest

# Copy package files
COPY package*.json ./

# Install dependencies
# Use npm install with legacy-peer-deps to handle peer dependency conflicts
RUN npm install --legacy-peer-deps

# Copy source files
COPY . .

# Generate Prisma Client (must be before TypeScript build)
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Optional: Run tests in builder stage
# Uncomment to run tests during build:
# RUN npm run test

# Stage 2: Production
FROM node:23-slim

# Install openssl (required for Prisma), curl (required for health checks), and Chromium (required for Puppeteer)
RUN apt-get update && apt-get install -y \
    openssl \
    curl \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Configure Puppeteer to skip Chromium download (use system Chromium)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy package files and install production deps only
COPY --from=builder --chown=node:node /app/package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copy built application from builder
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma

# Copy generated Prisma client from builder
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=node:node /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Set production environment
ENV NODE_ENV=production

# Create cache and uploads directories with proper permissions
RUN mkdir -p /app/cache /app/uploads/meter-photos && chown -R node:node /app

# Use non-root user
USER node

# Expose backend port
EXPOSE 3000

# Run migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
