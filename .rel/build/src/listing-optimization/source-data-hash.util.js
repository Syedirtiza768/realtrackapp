"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeSourceDataHash = computeSourceDataHash;
const node_crypto_1 = require("node:crypto");
function computeSourceDataHash(product) {
    const payload = {
        title: product.title,
        description: product.description,
        brand: product.brand,
        mpn: product.mpn,
        oemPartNumber: product.oemPartNumber,
        partType: product.partType,
        placement: product.placement,
        categoryId: product.categoryId,
        fitmentData: product.fitmentData,
        imageUrls: product.imageUrls,
        price: product.price,
        quantity: product.quantity,
        conditionId: product.conditionId,
        donorVin: product.donorVin,
        donorYear: product.donorYear,
        donorMake: product.donorMake,
        donorModel: product.donorModel,
    };
    return (0, node_crypto_1.createHash)('sha256').update(JSON.stringify(payload)).digest('hex');
}
//# sourceMappingURL=source-data-hash.util.js.map