"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routePipelineListingRecords = routePipelineListingRecords;
exports.buildActiveIdBySku = buildActiveIdBySku;
function routePipelineListingRecords(listingRecords, activeIdBySku) {
    const rowsToUpdate = [];
    const rowsToInsert = [];
    const seenSku = new Set();
    let droppedDuplicates = 0;
    for (const lr of listingRecords) {
        const sku = lr.customLabelSku?.trim();
        if (!sku) {
            rowsToInsert.push(lr);
            continue;
        }
        if (seenSku.has(sku)) {
            droppedDuplicates++;
            continue;
        }
        seenSku.add(sku);
        const existingId = activeIdBySku.get(sku);
        if (existingId) {
            rowsToUpdate.push({ id: existingId, lr });
        }
        else {
            rowsToInsert.push(lr);
        }
    }
    return { rowsToUpdate, rowsToInsert, droppedDuplicates };
}
function buildActiveIdBySku(rows) {
    const map = new Map();
    for (const r of rows) {
        const sku = r.customLabelSku?.trim();
        if (sku)
            map.set(sku, r.id);
    }
    return map;
}
//# sourceMappingURL=pipeline-listing-routing.util.js.map