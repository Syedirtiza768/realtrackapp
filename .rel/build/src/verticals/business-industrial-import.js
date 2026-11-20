"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.businessIndustrialAttributesFromImportRow = businessIndustrialAttributesFromImportRow;
const business_industrial_config_js_1 = require("./business-industrial.config.js");
function businessIndustrialAttributesFromImportRow(data) {
    const attributes = {};
    for (const key of (0, business_industrial_config_js_1.businessIndustrialImportAttributeKeys)()) {
        const value = data[key];
        if (value !== undefined && value.trim() !== '')
            attributes[key] = value.trim();
    }
    return attributes;
}
//# sourceMappingURL=business-industrial-import.js.map