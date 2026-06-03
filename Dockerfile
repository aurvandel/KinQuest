# --- Stage 1: Build Stage ---
FROM node:24-alpine AS builder
WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm install --package-lock-only && npm ci

# Copy application source and build configuration
COPY . .

# Run build (transpiles front-end and bundles back-end server via esbuild)
RUN npm run build

# --- Stage 2: Production Runtime Stage ---
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package descriptors
COPY package*.json ./

# Install only production dependencies to keep the image slim
RUN npm ci --only=production

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Create data directory and copy initial database file for local fallback persistence
RUN mkdir -p /app/data
COPY db.json ./data/db.json

# Expose server port
EXPOSE 3000

# Start WilderHunt Full-Stack application
CMD ["npm", "run", "start"]
