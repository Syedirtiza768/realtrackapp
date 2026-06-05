# ADR 0001: Documentation as Project Memory

## Status
Accepted

## Context
Large AI-assisted codebases lose continuity when project knowledge lives only in chat history.

## Decision
Use Markdown docs as persistent project memory. `README.md`, `CONTEXT.md`, `CLAUDE.md`, `AGENTS.md`, and `/docs/**` are the authoritative handover system.

## Consequences
Future agents must read the docs before changes and update relevant docs after meaningful changes.

## Related Files
- README.md
- CONTEXT.md
- CLAUDE.md
- AGENTS.md
- /docs/**
