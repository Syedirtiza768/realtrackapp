# ───────────────────────────────────────────────────────────────
# Backend — Multi-stage build for NestJS (Node 20 Alpine)
# ───────────────────────────────────────────────────────────────

# ── Stage 1: Install ALL dependencies (including devDeps) ──
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN \
  if [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \
  elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  else npm install; fi

# ── Stage 2: Build the NestJS app ──
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Stage 3: Production image (no devDeps, no source) ──
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install only production deps
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN \
  if [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --prod --frozen-lockfile; \
  elif [ -f yarn.lock ]; then yarn install --production --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci --omit=dev; \
  else npm install --omit=dev; fi

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Create uploads directory
RUN mkdir -p uploads/catalog

EXPOSE 4191

CMD ["node", "dist/main.js"]
