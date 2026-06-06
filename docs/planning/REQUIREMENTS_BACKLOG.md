# Requirements Backlog

> **Note**: No formal requirements backlog currently exists for RealTrackApp. Feature requests are tracked ad-hoc via the codebase, git history, and the CHANGELOG.

## Current Prioritization Sources

- **Feature Registry**: [/docs/context/FEATURE_REGISTRY.md](../context/FEATURE_REGISTRY.md) — tracks implementation status of all features
- **Next Steps**: [/docs/context/NEXT_STEPS.md](../context/NEXT_STEPS.md) — prioritized action items
- **Known Issues**: [/docs/context/KNOWN_ISSUES.md](../context/KNOWN_ISSUES.md) — bugs, risks, and technical debt
- **Roadmap**: [/docs/context/ROADMAP.md](../context/ROADMAP.md) — phased development plan

## How to Add Requirements

When a new feature request or requirement is identified, it should be:

1. **If it's a bug**: Add to [/docs/context/KNOWN_ISSUES.md](../context/KNOWN_ISSUES.md)
2. **If it's a planned feature**: Add to [/docs/context/FEATURE_REGISTRY.md](../context/FEATURE_REGISTRY.md) with status "Planned"
3. **If it's a priority change**: Update [/docs/context/NEXT_STEPS.md](../context/NEXT_STEPS.md)
4. **If it's a roadmap change**: Update [/docs/context/ROADMAP.md](../context/ROADMAP.md)
5. **Significant decisions**: Add to [/docs/context/DECISION_LOG.md](../context/DECISION_LOG.md)

## Open Questions (Needs Decision)

- Should non-eBay channels (Shopify/Amazon/Walmart) be completed or removed?
- Should the project standardize on "RealTrackApp" or "ListingPro" branding?
- Should JWT token revocation be implemented via blacklist or refresh rotation?
- Should PostgreSQL partitioning be prioritized for high-volume tables?

---

*Created: 2026-06-06 (stub).*
