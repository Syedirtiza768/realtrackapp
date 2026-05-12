# RealTrackApp — Claude Code Guide

## Project overview

RealTrackApp is a full-stack eBay listing management and inventory pipeline tool.

- **Frontend**: React + Vite + TypeScript + Tailwind CSS (port 8050)
- **Backend**: NestJS + TypeORM + PostgreSQL + Redis (port 4191)
- **Infra**: Docker Compose (postgres, redis, backend, frontend)

## Dev commands

```bash
# Frontend
npm run dev          # start Vite dev server

# Backend
cd backend && npm run start:dev   # start NestJS in watch mode

# Docker (production-like)
docker compose up -d --build
docker compose logs -f
```

## gstack

Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.

Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy, /canary, /benchmark, /browse, /open-gstack-browser, /qa, /qa-only, /design-review, /setup-browser-cookies, /setup-deploy, /setup-gbrain, /sync-gbrain, /retro, /investigate, /document-release, /codex, /cso, /autoplan, /pair-agent, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade, /learn.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool.

- Product ideas/brainstorming → /office-hours
- Strategy/scope → /plan-ceo-review
- Architecture → /plan-eng-review
- Design system/plan review → /design-consultation or /plan-design-review
- Full review pipeline → /autoplan
- Bugs/errors → /investigate
- QA/testing site behavior → /qa or /qa-only
- Code review/diff check → /review
- Visual polish → /design-review
- Ship/deploy/PR → /ship or /land-and-deploy
- Security audit → /cso
