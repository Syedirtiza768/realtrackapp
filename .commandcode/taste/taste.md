# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# ebay
- Use eBay's Taxonomy API for category lookups rather than AI-powered category suggestions. Confidence: 0.65
- Rate limit eBay MVL/Taxonomy API calls to 10 requests per second. Confidence: 0.50

# pipeline
- When a pipeline checkpoint file exists (`.pipeline-checkpoint.json` in the output directory), use it to resume progress rather than re-running the enrichment pipeline from scratch. Confidence: 0.65

# database
- Use camelCase column names (e.g., `createdAt`, `updatedAt`, `customLabelSku`) for PostgreSQL tables in this project. Confidence: 0.78

