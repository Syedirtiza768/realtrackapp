"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EBAY_MAX_PUBLISH_QUANTITY = void 0;
exports.capEbayPublishQuantity = capEbayPublishQuantity;
exports.EBAY_MAX_PUBLISH_QUANTITY = 10;
function capEbayPublishQuantity(quantity) {
    return Math.min(quantity, exports.EBAY_MAX_PUBLISH_QUANTITY);
}
//# sourceMappingURL=ebay-publish-quantity.util.js.map