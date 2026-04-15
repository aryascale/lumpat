# Build stage for frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install pnpm and dependencies
RUN npm install -g pnpm && pnpm install

# Copy frontend source
COPY . .

# Build frontend
RUN pnpm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies needed for tsx)
RUN pnpm install

# Copy built frontend from builder
COPY --from=frontend-builder /app/dist ./dist

# Copy server and API files
COPY server.ts ./
COPY api ./api
COPY src ./src
COPY tsconfig.json ./
COPY tsconfig.server.json ./

# Generate Prisma client
RUN npx prisma generate

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Set default port (Railways will override this with PORT env var)
ENV PORT=3001

# Expose port
EXPOSE 3001

# Start with entrypoint (runs migrations then server)
ENTRYPOINT ["./docker-entrypoint.sh"]
