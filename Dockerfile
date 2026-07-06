# ───────────────────────────────────────────────────────────────
# Frontend — Multi-stage: Vite build → Nginx
# ───────────────────────────────────────────────────────────────

# ── Stage 1: Install deps & build ──
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY . .
RUN npx vite build

# ── Stage 2: Serve with Nginx ──
FROM nginx:1.27-alpine AS runner

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our nginx config
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
