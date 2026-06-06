# Acceptance Criteria

> **Note**: No formal acceptance criteria currently exist for RealTrackApp features. For the definition of done for development tasks, see the task completion checklist referenced below.

## Definition of Done (Development)

Per the Continuous Documentation Protocol, every meaningful change must:

- [ ] Code compiles / builds successfully
- [ ] Lint passes (`npm run lint`)
- [ ] Tests pass where applicable (`npm run test`, `npm run test:e2e`)
- [ ] Relevant documentation updated (see protocol in AGENTS.md)
- [ ] CHANGELOG.md updated
- [ ] New risks/gaps documented
- [ ] No secrets committed
- [ ] UI changes exercised in browser

## When Formal Acceptance Criteria Are Needed

For major features or external-facing changes, formal acceptance criteria should be added to the feature's section in [/docs/context/FEATURE_REGISTRY.md](../context/FEATURE_REGISTRY.md) using this format:

```
### Acceptance Criteria
- [ ] Criterion 1: As a [role], I can [action] so that [outcome]
- [ ] Criterion 2: Edge case [X] should result in [Y]
- [ ] Criterion 3: Error case [X] should show message [Y]
```

## Areas Needing Criteria

Based on [KNOWN_ISSUES.md](../context/KNOWN_ISSUES.md), these areas would benefit from formal acceptance criteria:

- Auth/RBAC permission enforcement (login → permissioned route → 403/200)
- eBay multi-store publish (publish → verify on eBay → sync inventory)
- Catalog CSV import (large file → no OOM → correct products created)
- Forgot password flow (email → reset → login with new password)

---

*Created: 2026-06-06 (stub).*
