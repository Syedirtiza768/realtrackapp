# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# ebay
- Use eBay's Taxonomy API for category lookups rather than AI-powered category suggestions. Confidence: 0.65
- Rate limit eBay MVL/Taxonomy API calls to 10 requests per second. Confidence: 0.50

# pipeline
- When a pipeline checkpoint file exists (`.pipeline-checkpoint.json` in the output directory), use it to resume progress rather than re-running the enrichment pipeline from scratch. Confidence: 0.65

# communication
- Distinguish clearly between **pipeline enrichment** (processing input XLSX files through the enrichment pipeline) and **published listings enrichment** (optimizing already-published eBay listing records). User corrects the agent if these are conflated. Confidence: 0.85
- When explaining differences between route areas or architectural concepts, use structured comparisons (tables, side-by-side sections) with clear labels for purpose, data model, and workflow relationships. Confidence: 0.65
- Provide complete time estimates (per-phase and total) when analyzing sync or batch operations, not just high-level summaries. Confidence: 0.80
- During long-running operations, proactively self-schedule periodic progress checks (via cron_create or sleep) and report status in tables with phase, progress %, rate, and per-phase ETA — don't wait for the user to ask again. User explicitly requested "show progress periodically give clear ETA". Confidence: 0.90

# workflow
- Before running any sync or batch operation that calls external APIs (eBay Trading, Browse, Inventory, etc.), provide a full API call budget: total calls expected, rate limits in place, and headroom vs daily quotas. Confidence: 0.70

# database
- Use camelCase column names (e.g., `createdAt`, `updatedAt`, `customLabelSku`) for PostgreSQL tables in this project. Confidence: 0.78

# pipeline
- Prefer deterministic offline approaches (input XLSX data + local MVL database) over API calls (Browse API, AI API, Taxonomy API) for pipeline processing to keep it fast and avoid redundant lookups. Confidence: 0.60

# listings
- eBay listing titles must follow this nomenclature: `[Year Range] [Make] [Model/Generation] [Position] [Part Name] [OEM Part Number] [OEM][Used]`. Confidence: 0.85
- Warehouse intake items (source_file='warehouse-intake') must receive the same title optimization and compatibility-row enrichment as pipeline-sourced listings — parity across all data entry paths is a hard requirement. Confidence: 0.80
- Zero tolerance for failed or pending optimization items; actively check `optimization_status` counts in the database and fix all failures until every record is optimized. Confidence: 0.80

# workflow
See [workflow/taste.md](workflow/taste.md)
