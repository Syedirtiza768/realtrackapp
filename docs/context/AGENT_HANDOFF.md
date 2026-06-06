# Agent Handoff

> **Source**: Moved from `docs/AGENT_HANDOFF.md` (2026-05-29).
> Template for documenting work-in-progress and context for future agents.
> Copy this template and fill in relevant sections when handing off work.

---

## Session Summary

**Date**: YYYY-MM-DD  
**Agent**: [Agent identifier]  
**Task**: [Brief description of work done]  
**Status**: [In Progress / Complete / Blocked]  

---

## Work Completed

### Features Implemented
- [ ] Feature 1
- [ ] Feature 2
- [ ] Feature 3

### Bugs Fixed
- [ ] Bug 1
- [ ] Bug 2

### Documentation Updated
- [ ] Doc 1
- [ ] Doc 2

---

## Current State

### What's Working
- Item 1
- Item 2

### What's In Progress
- Item 1 (X% complete)
- Item 2 (blocked on Y)

### What's Not Started
- Item 1
- Item 2

---

## Code Changes

### Files Modified
```
src/components/feature/NewComponent.tsx     # New component
backend/src/module/module.controller.ts     # Added endpoint
backend/src/module/module.service.ts        # Updated logic
docs/ARCHITECTURE.md                       # Updated docs
```

### Database Changes
- Migration: `backend/src/migrations/XXXX-Description.ts`
- New entities: `EntityName`
- Modified entities: `EntityName`

### API Changes
- New endpoints:
  - `GET /api/module/endpoint`
  - `POST /api/module/endpoint`
- Modified endpoints:
  - `PUT /api/module/existing` (added field X)

### Permission Changes
- New permissions: `module.action`
- Added to roles: `admin`, `manager`

---

## Testing Status

### Tests Written
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests

### Manual Testing
- [ ] Tested locally
- [ ] Tested in Docker
- [ ] Tested with production-like data

### Known Issues
- Issue 1: [description]
- Issue 2: [description]

---

## Blockers and Risks

### Current Blockers
1. **Blocker**: [Description]
   - **Impact**: [What can't be done]
   - **Resolution needed**: [What would unblock]

### Risks Identified
1. **Risk**: [Description]
   - **Likelihood**: [Low/Med/High]
   - **Impact**: [Low/Med/High]
   - **Mitigation**: [How to address]

---

## Decisions Made

### Technical Decisions
1. **Decision**: [What was decided]
   - **Rationale**: [Why]
   - **Alternatives considered**: [Other options]

### Architectural Decisions
1. **Decision**: [What was decided]
   - **Rationale**: [Why]
   - **Trade-offs**: [Pros/cons]

---

## Next Steps

### Immediate (Next Session)
1. [ ] Task 1
2. [ ] Task 2

### Short Term (This Week)
1. [ ] Task 1
2. [ ] Task 2

### Long Term (Future)
1. [ ] Task 1
2. [ ] Task 2

---

## Context for Future Agent

### Key Files to Read
1. `src/components/feature/Component.tsx` - Main component
2. `backend/src/module/module.service.ts` - Business logic
3. `docs/ARCHITECTURE.md` - Architecture overview

### Important Context
- [Context item 1]
- [Context item 2]

### Gotchas
- [Gotcha 1: e.g., "Double /api prefix on feature-flag controller"]
- [Gotcha 2: e.g., "Must run migrations before testing"]

### Environment Setup
```bash
# Any special setup needed
cd backend && npm run migration:run
npm run dev
```

---

## Questions for User/Next Agent

1. [Question 1]
2. [Question 2]

---

## References

- Related PR: [link]
- Related Issue: [link]
- Design Doc: [link]
- Slack Thread: [link]

---

## Checklist

- [ ] Code committed (if applicable)
- [ ] Tests passing (if applicable)
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] This handoff document created
- [ ] No secrets in code
- [ ] No breaking changes without migration

---

*Reorganized: 2026-06-06.*
