# Setup and Deployment

> Complete guide for setting up and deploying RealTrackApp.
> For environment variables, see `/docs/development/environment-variables.md`.

---

## Quick Start (Docker)

### Prerequisites

- Docker Desktop or Docker Engine
- Docker Compose
- Git

### 1. Clone and Configure

```bash
git clone <repository>
cd realtrackapp

# Copy environment template
cp .env.example .env

# Edit .env with your secrets
# Required: JWT_SECRET
# Recommended: Change DB_PASSWORD, set Redis password
```

### 2. Start Services

```bash
# Build and start all services
docker compose up -d --build

# Follow logs
docker compose logs -f

# Or follow specific service
docker compose logs -f backend
docker compose logs -f frontend
```

### 3. Access Application

| Service | URL | Notes |
|---------|-----|-------|
| Frontend | http://localhost:8050 | Nginx served |
| API | http://localhost:4191/api | NestJS backend |
| Swagger | http://localhost:4191/api/docs | API documentation |
| PostgreSQL | localhost:5432 | External port |
| Redis | localhost:6379 | External port |

### 4. Stop Services

```bash
# Stop all
docker compose down

# Stop and remove volumes (data loss!)
docker compose down -v
```

---

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL 16 (local or Docker)
- Redis 7 (local or Docker)

### 1. Start Dependencies

```bash
# Option A: Use Docker for dependencies only
docker compose up -d postgres redis

# Option B: Use local PostgreSQL and Redis
# Ensure they're running on default ports
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env:
# - DB_HOST=localhost (or docker host)
# - REDIS_HOST=localhost
# - JWT_SECRET=your-secret

# Run migrations
npm run migration:run

# Start development server
npm run start:dev
```

Backend runs on http://localhost:4191

### 3. Frontend Setup

```bash
# In project root (new terminal)
npm install

# Start Vite dev server
npm run dev
```

Frontend runs on http://localhost:3911

### 4. Development Workflow

```bash
# Terminal 1: Backend
cd backend && npm run start:dev

# Terminal 2: Frontend
npm run dev

# Terminal 3: Logs (optional)
docker compose logs -f postgres redis
```

---

## Environment Configuration

### Required Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `JWT_SECRET` | JWT signing | `your-super-secret-jwt-key-min-32-chars` |

### Database Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | **Change this!** |
| `DB_NAME` | `listingpro` | Database name |
| `DB_SYNCHRONIZE` | `false` | **Never true in production** |
| `DB_MIGRATIONS_RUN` | `true` | Auto-run migrations |

### Redis Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | (empty) | Set for security |

### eBay Integration

| Variable | Required | Description |
|----------|----------|-------------|
| `EBAY_CLIENT_ID` | Yes | eBay App ID |
| `EBAY_CLIENT_SECRET` | Yes | eBay Cert ID |
| `EBAY_DEV_ID` | Yes | eBay Dev ID |
| `EBAY_ENVIRONMENT` | Yes | `SANDBOX` or `PRODUCTION` |
| `EBAY_REDIRECT_URI` | Yes | OAuth callback URL |

### OpenAI Integration

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | For AI features | OpenAI API key |
| `OPENAI_CHAT_MODEL` | No | Default: `gpt-4o-mini` |
| `OPENAI_EMBEDDING_MODEL` | No | Default: `text-embedding-3-small` |

### AWS S3 Storage

| Variable | Required | Description |
|----------|----------|-------------|
| `AWS_S3_BUCKET` | For images | S3 bucket name |
| `AWS_S3_PREFIX` | No | Key prefix (e.g., `mhn/`) |
| `AWS_S3_REGION` | No | Default: `us-east-1` |
| `AWS_ACCESS_KEY_ID` | Yes | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS secret key |

---

## Database Migrations

### Run Migrations

```bash
cd backend

# Run pending migrations
npm run migration:run

# Check status
npm run migration:show

# Revert last migration
npm run migration:revert
```

### Generate Migration

```bash
cd backend

# After modifying entities, generate migration
npm run migration:generate

# This creates a new migration file in src/migrations/
```

### Migration Naming

Migrations use timestamp prefix:
```
1775400000000-RbacFoundation.ts
1775400000001-ClientSettings.ts
```

---

## Production Deployment

### Docker Compose Production

```bash
# 1. Set production environment
export NODE_ENV=production

# 2. Configure .env with production values
# - Strong JWT_SECRET
# - Production DB credentials
# - Production eBay credentials
# - CORS_ORIGIN set to production domain

# 3. Build and start
docker compose -f docker-compose.yml up -d --build

# 4. Verify health
curl http://localhost:4191/api/health
```

### PM2 Deployment

```bash
# Install PM2
npm install -g pm2

# Use ecosystem config
pm2 start ecosystem.config.cjs

# Save PM2 config
pm2 save
pm2 startup
```

### Manual Server Deployment

```bash
# 1. Build backend
cd backend
npm install
npm run build

# 2. Build frontend
cd ..
npm install
npm run build

# 3. Configure nginx (see nginx.conf)
# 4. Start backend
# 5. Serve frontend dist/ via nginx
```

---

## Health Checks

### Backend Health

```bash
curl http://localhost:4191/api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-05-29T...",
  "services": {
    "database": "up",
    "redis": "up"
  }
}
```

### Docker Health Checks

Services include health checks:
- PostgreSQL: `pg_isready`
- Redis: `redis-cli ping`
- Backend: HTTP health endpoint

---

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker compose ps

# Check logs
docker compose logs postgres

# Verify connection
docker compose exec postgres pg_isready -U postgres
```

### Migration Failures

```bash
# Check migration status
cd backend
npm run migration:show

# If stuck, revert and retry
npm run migration:revert
npm run migration:run
```

### Redis Connection Issues

```bash
# Check Redis
docker compose logs redis
docker compose exec redis redis-cli ping
```

### Backend Won't Start

```bash
# Check for port conflicts
lsof -i :4191

# Check logs
docker compose logs backend

# Verify environment
docker compose exec backend env | grep DB_
```

### Frontend Won't Connect to API

```bash
# Check Vite proxy config (vite.config.ts)
# Verify backend is running
curl http://localhost:4191/api/health

# Check browser console for CORS errors
```

---

## Backup and Restore

### Database Backup

```bash
# Backup PostgreSQL
docker compose exec postgres pg_dump -U postgres listingpro > backup.sql

# Or with compression
docker compose exec postgres pg_dump -U postgres listingpro | gzip > backup.sql.gz
```

### Database Restore

```bash
# Restore from backup
docker compose exec -T postgres psql -U postgres listingpro < backup.sql

# Or from seed dump
docker compose exec postgres psql -U postgres listingpro < listingpro.dump
```

### S3 Backup

```bash
# Sync uploads to S3
aws s3 sync uploads/ s3://your-bucket/backups/uploads/
```

---

## Scaling Considerations

### Horizontal Scaling

- **Backend**: Stateless, can run multiple instances behind load balancer
- **Database**: Use managed PostgreSQL (RDS, Cloud SQL)
- **Redis**: Use managed Redis (ElastiCache, Redis Cloud)
- **S3**: Unlimited scaling

### Performance Tuning

```typescript
// Database pool (app.module.ts)
extra: {
  max: 20,      // Increase for high load
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
}

// BullMQ concurrency
processors: {
  concurrency: 5  // Adjust per processor
}
```

---

## Monitoring

### Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend

# Since specific time
docker compose logs --since 10m backend
```

### Metrics

- Database: PostgreSQL logs, connection count
- Redis: `INFO` command, memory usage
- Application: Request logs, error rates
- Queues: BullMQ dashboard (if configured)

---

## Related Documentation

- **Environment Variables**: `/docs/development/environment-variables.md`
- **Security Checklist**: `/docs/operations/security-checklist.md`
- **Deployment Runbook**: `/docs/operations/deployment-runbook.md`
- **Architecture**: `/docs/architecture/overview.md`

---

*Last updated: 2026-05-29*
