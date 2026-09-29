#!/usr/bin/env python3
import csv
import json

base = '/app/output/ebay-pipeline'
csv_path = f'{base}/napa_ebay_shopify_listings.complete-fitment-enriched.csv'
ready_path = f'{base}/napa_ebay_shopify_listings.complete.ebay-listings-ready.csv'
manifest_path = f'{base}/napa_ebay_shopify_listings.complete.manifest.json'
with open(csv_path, encoding='utf-8-sig', newline='') as handle:
    rows = list(csv.DictReader(handle))
with open(ready_path, encoding='utf-8-sig', newline='') as handle:
    ready = list(csv.DictReader(handle))
with open(manifest_path, encoding='utf-8') as handle:
    manifest = json.load(handle)
status_counts = {}
for row in rows:
    status = row.get('Publish Status', '')
    status_counts[status] = status_counts.get(status, 0) + 1
manifest.update({
    'sourceRowsCovered': len(rows),
    'parentRows': len(rows),
    'compatibilityContinuationRows': sum(row.get('Relationship') == 'Compatibility' for row in ready),
    'readyExportRows': len(ready),
    'publishStatusCounts': status_counts,
    'coverage': {
        'allSourceRowsRepresented': len(rows) == manifest.get('sourceRows', len(rows)),
        'validatedImageRows': sum(bool(row.get('Image URL')) for row in rows),
        'validatedFitmentRows': sum(row.get('Fitment Status') == 'verified_mvl' for row in rows),
        'publishReadyRows': sum(row.get('Publish Status') == 'content_ready_fitment_verified' for row in rows),
        'imagePendingRows': sum(not row.get('Image URL') for row in rows),
        'fitmentPendingRows': sum(row.get('Fitment Status') != 'verified_mvl' for row in rows),
    },
})
with open(manifest_path, 'w', encoding='utf-8') as handle:
    json.dump(manifest, handle, indent=2)
    handle.write('\n')
print(json.dumps(manifest, indent=2))
