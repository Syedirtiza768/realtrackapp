# Decision log

**Last reviewed:** 2026-08-06

Running log of non-obvious decisions, workarounds, and their reasons. Newest first.
Add an entry whenever a change is driven by something that isn't obvious from the
code alone (a past incident, an external constraint, a workaround for a broken
dependency).

This is a lightweight, chronological companion to the older ADR-style records in
[docs/decisions/](decisions/) (currently just `0001-documentation-as-project-memory.md`)
and the narrative log in [docs/context/DECISION_LOG.md](context/DECISION_LOG.md). Use
this file for quick day-to-day entries; promote something to a full ADR only if it
needs that level of ceremony.

Format:
```
## YYYY-MM-DD — Short title
**Decision:** what was decided/done.
**Why:** the constraint or incident that drove it.
**Revisit when:** condition under which this should be reconsidered (optional).
```

---

## 2026-08-04 — `EbayMvlService` injection made optional in `EbayPublishService`
**Decision:** `backend/src/channels/ebay/ebay-publish.service.ts` injects
`EbayMvlService` as an optional dependency instead of a hard constructor dependency.
**Why:** The two modules (`channels`/eBay and `fitment`/MVL) had a circular
dependency; making the injection optional was the fix (commit `39683f3`).
**Revisit when:** If the `channels` ↔ `fitment` module boundary is ever restructured,
re-check whether this workaround is still needed or can be replaced with a proper
module restructure (e.g. extracting a shared interface).

## 2026-07-23 — Non-Trading writers must never touch `lastSuccessfulSyncAt`
**Decision:** Only the Trading-API sync path may update the published-listings
`lastSuccessfulSyncAt` watermark. Other writers (e.g. policy sync) are hard-gated
from touching it, and self-heal logic checks for watermark drift.
**Why:** Policy sync was stamping `lastSuccessfulSyncAt` ahead of every listing.
Since the reader API filters on that watermark, PartsBazar360's reader endpoints
returned `total: 0` even though the Blackline/SalvageA mirrors held 83,986 / 24,899
real rows — the data was fine, the watermark was lying. See
[docs/context/CURRENT_STATE.md](context/CURRENT_STATE.md) for the full incident
writeup.
**Revisit when:** If another writer needs to legitimately bump this watermark, give
it its own field rather than reusing the Trading-sync one.

---

*(These two entries were backfilled from recent commit history and
`docs/context/CURRENT_STATE.md` when this log was created on 2026-08-06. Keep adding
to it going forward — don't let it go stale.)*
