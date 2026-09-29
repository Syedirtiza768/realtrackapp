# Catalog pipeline coverage audit

The September 20, 2026 catalog run covers all 866 source rows from the NAPA, SKF, Mevotech, and Delphi import (`31fe3770-48c8-4667-9351-af4a1fad99ad`). It keeps a parent row for every source item and writes expanded eBay compatibility continuation rows only after eBay US MVL 2026-05 validation.

The staged export contains 491 validated image URLs, 147 rows with validated vehicle fitment, and 146 rows ready for publication with both. The remaining 720 rows remain in the pipeline with explicit blocked or pending statuses: 375 lack a validated image, 31 have an image but still need fitment, and one validated-fitment row still lacks an image. No live eBay publish was performed.

Evidence sources are exact brand/MPN eBay Browse item details and official NAPA CDN product assets. GPT-5.6 Luna extracts only applications explicitly present in those descriptions; each accepted application is checked against the local eBay US MVL before export. The source evidence and candidate audit are stored beside the exports as `napa_exact_catalog_evidence.json`, `napa_fitment_evidence_candidates.json`, and `napa_fitment_all_candidates.json`.
