# ───────────────────────────────────────────────────────────────
# Backend — Multi-stage build for NestJS (Node 20 slim)
# ───────────────────────────────────────────────────────────────

# ── Stage 1: Install ALL dependencies (including devDeps) ──
FROM node:20-slim AS deps
WORKDIR /app
# Override host/compose NODE_ENV=production so devDeps (@nestjs/cli) are installed
ENV NODE_ENV=development
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
# npm ci intermittently fails in Docker ("Exit handler never called"); install matches frontend
RUN npm install --no-audit --no-fund
RUN test -x node_modules/.bin/nest

# ── Stage 2: Build the NestJS app ──
FROM node:20-slim AS builder
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node node_modules/@nestjs/cli/bin/nest.js build

# ── Stage 3: Production image (no devDeps, no source) ──
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Healthcheck in docker-compose.yml uses wget
RUN apt-get update \
  && apt-get install -y --no-install-recommends wget python3 python3-pip \
  && pip3 install --no-cache-dir --break-system-packages msoffcrypto-tool \
  && ln -sf /usr/bin/python3 /usr/bin/python \
  && rm -rf /var/lib/apt/lists/*

# Reuse installed modules from deps and drop devDependencies (avoids a second npm install)
COPY package.json package-lock.json* ./
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --omit=dev --no-audit --no-fund

# Copy compiled output + shared platform data (runtime lookup: /app/shared/...)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/shared ./shared

# Create uploads directory
RUN mkdir -p uploads/catalog

# Entrypoint runs migrations on container start when DB_MIGRATIONS_RUN=true
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# Strip Windows CRLF so the shebang interpreter resolves on Linux
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 4191

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
