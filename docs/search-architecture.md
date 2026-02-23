# eBay Motors Search Architecture Upgrade Blueprint

## Scope
This blueprint describes backend and deployment patterns that align with the upgraded catalog UI without breaking existing API contracts.

## API-First Contract Strategy
- Keep existing endpoints stable as `v1`.
- Introduce versioned `v2` search endpoint with contract parity fields.
- Add optional extension blocks (`compatibility`, `rankingMeta`, `facets`) without removing existing fields.

## OpenSearch Index Design
Suggested index fields:
- `sku`, `title`, `description`
- `brand`, `placement`, `material`, `color`
- `oemPartNumbers[]`, `aftermarketPartNumbers[]`
- `compatibility[]` (`year`, `make`, `model`, `trim`)
- `epids[]`, `kTypes[]`
- `availability`, `condition`, `shippingType`, `sellerRating`
- `popularityScore`, `price`

Recommended analyzers:
- custom synonym analyzer for automotive dictionary terms
- edge-ngram or completion suggester for predictive input
- keyword analyzers for exact part-number fields

## Compatibility Mapping
- Keep compatibility in relational source tables for data integrity.
- Materialize compatibility arrays into index documents for fast search.
- Add VIN decode service to return normalized YMMT and feed into compatibility query clauses.

## Caching Layer
- Cache query + facet keyspace in Redis with short TTL.
- Separate inventory-quantity cache from search-response cache.
- Invalidate by SKU update events.

## Performance Targets
- P95 search latency target: <300ms (application-level)
- Result payload trimming + pagination
- Facet pre-aggregation where practical for hot categories

## Deployment Safety
- Blue/green or canary rollout for v2 search service
- Feature flag routing from v1 to v2
- Runtime fallback to v1 in case of error budget breach

## Rollback
- Preserve v1 path and schema
- Disable v2 feature flags
- Continue reads from legacy query service while v2 fixes are applied
