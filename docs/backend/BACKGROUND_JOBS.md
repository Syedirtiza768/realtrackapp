# Background Jobs

> **Note**: Extracted from `docs/architecture/integrations.md` and `docs/SYSTEM_OVERVIEW.md` (2026-05-29).
> For the architecture-level integration overview, see [/docs/architecture/INTEGRATIONS.md](../architecture/INTEGRATIONS.md).

---

## BullMQ Queues (~16)

All queues run on Redis 7, configured globally in `app.module.ts` via `BullModule.forRootAsync`. Queue registrations and processors (`@Processor`) are module-specific.

| Queue | Processor Location | Concurrency | Purpose |
|-------|-------------------|-------------|---------|
| `ingestion` | `ingestion/processors/ingestion.processor.ts` | 3 | Image/data ingestion |
| `pipeline` | `ingestion/processors/pipeline.processor.ts` | `MAX_CONCURRENT_PIPELINE_JOBS` (default `2`) | Enrichment pipeline; enqueues `listing-optimization` |
| `listing-optimization` | `listing-optimization/` | 1 | Listing optimization |
| `catalog-import` | `catalog-import/processors/csv-import.processor.ts` | 1 | CSV/catalog import (memory-heavy) |
| `fitment` | `fitment/processors/fitment-import.processor.ts` | 1 | Fitment import |
| `inventory` | `inventory/processors/inventory-sync.processor.ts` | 1 | Inventory sync |
| `orders` | `orders/processors/order-import.processor.ts` | 1 | Order import |
| `dashboard` | `dashboard/processors/aggregation.processor.ts` | 1 | KPI aggregation |
| `channels` | `channels/processors/channel-publish.processor.ts` | 2 | Channel publish |
| `openai` | `common/openai/openai-queue.service.ts` | 3 | Queued OpenAI calls (rate-limited) |
| `motors-pipeline` | `motors-intelligence/processors/motors-pipeline.processor.ts` | default | Motors AI pipeline |
| `storage-thumbnails` | `storage/processors/thumbnail.processor.ts` | 5 | Thumbnail generation |
| `storage-cleanup` | `storage/processors/cleanup.processor.ts` | 1 | Orphan cleanup |
| `ebay-inventory-sync` | `integrations/ebay/processors/ebay-inventory-sync.processor.ts` | default | eBay inventory sync |
| `ebay-order-sync` | `integrations/ebay/processors/ebay-order-sync.processor.ts` | default | eBay order pull |
| `ebay-listing-publish` | `integrations/ebay/processors/ebay-listing-publish.processor.ts` | default | eBay listing publish |

---

## Scheduled Jobs

`common/scheduler/scheduler.service.ts` uses `@nestjs/schedule` cron to enqueue work into:

- `storage-cleanup` — periodic orphan asset cleanup
- `inventory` — inventory reconciliation
- `orders` — order import from channels
- `dashboard` — KPI aggregation
- `channels` — channel data sync

---

## Realtime / Events

- **WebSocket**: Socket.IO `notifications` namespace (`notifications/notifications.gateway.ts`). Pushes live notifications to the frontend.
- **EventEmitter2** (`@nestjs/event-emitter`) for in-process domain events (e.g., `notification.created`).

---

## Adding a New Queue

1. Register in the owning module:
   ```typescript
   BullModule.registerQueue({ name: 'new-queue' })
   ```
2. Create a processor:
   ```typescript
   @Processor('new-queue')
   export class NewProcessor {
     @Process() async handle(job: Job) { ... }
   }
   ```
3. Inject the queue where you need to add jobs:
   ```typescript
   constructor(@InjectQueue('new-queue') private queue: Queue) {}
   ```
4. Redis connection comes from `REDIS_HOST/PORT/PASSWORD` (configured globally in `app.module.ts`)
5. Document here and in [/docs/architecture/INTEGRATIONS.md](../architecture/INTEGRATIONS.md)

---

## Performance Considerations

- **CSV import** (`catalog-import` queue) is memory-heavy — requires elevated heap (`NODE_OPTIONS=--max-old-space-size=8192`)
- **OpenAI** queue has concurrency 3 to rate-limit API calls
- **Thumbnail** queue runs at concurrency 5 (CPU-bound, parallelizable)
- All processing is idempotent — retries are safe
- Redis persistence (`redisdata` volume) ensures queue durability across restarts

---

*Created: 2026-06-06.*
