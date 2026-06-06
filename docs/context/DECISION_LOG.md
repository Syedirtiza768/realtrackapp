# Decision Log

> **Source**: Moved from `docs/decisions/adr-index.md` and `docs/decisions/0001-documentation-as-project-memory.md` (2026-05-29).
> Architecture Decision Records (ADRs) capture significant, hard-to-reverse decisions and their rationale.

---

## ADR Index

| # | Title | Status | Date |
|---|-------|--------|------|
| [0001](#adr-0001-documentation-as-project-memory) | Documentation as Project Memory | Accepted | 2026-05-29 |

---

## ADR 0001: Documentation as Project Memory

### Status

Accepted — 2026-05-29

### Context

RealTrackApp is a large, actively developed full-stack platform with 23 backend modules, ~79 entities, 21 migrations, ~16 BullMQ queues, and a React frontend with 40+ components. AI agents (Claude Code and others) work on the project and need durable context that persists across sessions. Without structured project memory, each new agent must reconstruct the system from code inspection, leading to inconsistent understanding, repeated work, and missed context.

### Decision

Documentation will serve as the project's permanent memory — durable across AI agent sessions, agent models, and human contributors. Specifically:

1. **A master entry point** (`AGENT_SYSTEM_MEMORY.md`) provides a comprehensive summary of the entire system — purpose, stack, architecture, workflows, database, API, RBAC, deployment, known gaps, and rules — with links to deeper documentation.
2. **A documentation set** organized by domain (architecture, development, product, operations, decisions, handover) covers the full system.
3. **Root files** (AGENTS.md, CLAUDE.md, CONTEXT.md, CHANGELOG.md, README.md) provide compact project context and operational rules.
4. **A Continuous Documentation Protocol** requires every meaningful code change to update relevant documentation in the same session.
5. **Trust code over docs** when they conflict — then fix the doc.

### Consequences

**What becomes easier:**
- New AI agents can bootstrap understanding quickly by reading AGENT_SYSTEM_MEMORY.md
- Cross-session context is preserved — agents don't repeat exploration
- Documentation stays aligned with code through the Continuous Documentation Protocol
- Handoffs between agents are structured and complete

**What becomes harder:**
- Every change requires documentation updates (overhead in the Continuous Documentation Protocol)
- Documentation maintenance is an additional responsibility beyond code changes
- Documents can drift from code if the protocol isn't followed

**Trade-offs:**
- Documentation volume vs. freshness: comprehensive docs risk staleness; the protocol mitigates this
- Centralization vs. distribution: a master entry point risks becoming a bottleneck, but distributed docs risk becoming disconnected

### Related Files

- `/docs/AGENT_SYSTEM_MEMORY.md` — Master entry point
- `/AGENTS.md` — Agent operational rules
- `/CLAUDE.md` — Claude Code specific guidance
- `/CONTEXT.md` — Compact project memory
- `/docs/architecture/ARCHITECTURE.md` — Architecture deep dive
- `/docs/context/CURRENT_STATE.md` — Current development state

---

## Future ADRs

When a significant decision is made (technology choice, architectural change, process change, product direction), add a new ADR here using this template:

```
## ADR NNNN: <title>

### Status
Proposed | Accepted | Superseded by ADR-XXXX

### Context
<forces at play, constraints, problem>

### Decision
<what was decided>

### Consequences
<trade-offs, follow-ups, what becomes easier/harder>

### Related Files
<paths>
```

---

*Reorganized: 2026-06-06.*
