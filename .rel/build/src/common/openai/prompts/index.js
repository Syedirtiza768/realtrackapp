"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROMPT_REGISTRY = exports.TITLE_POSITION_PART_NAME_PROMPT = exports.TITLE_PART_VERIFICATION_PROMPT = exports.VIN_PARTS_COMPATIBILITY_COMPACT_PROMPT = exports.VIN_PARTS_COMPATIBILITY_PROMPT = exports.PRICING_ANALYSIS_PROMPT = exports.CROSS_REFERENCE_PROMPT = exports.IMAGE_ANALYSIS_PROMPT = exports.FITMENT_EXTRACTION_PROMPT = exports.CATEGORY_CLASSIFICATION_PROMPT = exports.COMPETITIVE_ANALYSIS_PROMPT = exports.LISTING_GENERATION_BATCH_DE_PROMPT = exports.LISTING_GENERATION_BATCH_PROMPT = exports.LISTING_GENERATION_DE_PROMPT = exports.LISTING_GENERATION_PROMPT = exports.DATA_ENRICHMENT_PROMPT = void 0;
exports.renderPrompt = renderPrompt;
var data_enrichment_prompt_js_1 = require("./data-enrichment.prompt.js");
Object.defineProperty(exports, "DATA_ENRICHMENT_PROMPT", { enumerable: true, get: function () { return data_enrichment_prompt_js_1.DATA_ENRICHMENT_PROMPT; } });
var listing_generation_prompt_js_1 = require("./listing-generation.prompt.js");
Object.defineProperty(exports, "LISTING_GENERATION_PROMPT", { enumerable: true, get: function () { return listing_generation_prompt_js_1.LISTING_GENERATION_PROMPT; } });
var listing_generation_de_prompt_js_1 = require("./listing-generation-de.prompt.js");
Object.defineProperty(exports, "LISTING_GENERATION_DE_PROMPT", { enumerable: true, get: function () { return listing_generation_de_prompt_js_1.LISTING_GENERATION_DE_PROMPT; } });
var listing_generation_batch_prompt_js_1 = require("./listing-generation-batch.prompt.js");
Object.defineProperty(exports, "LISTING_GENERATION_BATCH_PROMPT", { enumerable: true, get: function () { return listing_generation_batch_prompt_js_1.LISTING_GENERATION_BATCH_PROMPT; } });
var listing_generation_batch_de_prompt_js_1 = require("./listing-generation-batch-de.prompt.js");
Object.defineProperty(exports, "LISTING_GENERATION_BATCH_DE_PROMPT", { enumerable: true, get: function () { return listing_generation_batch_de_prompt_js_1.LISTING_GENERATION_BATCH_DE_PROMPT; } });
var competitive_analysis_prompt_js_1 = require("./competitive-analysis.prompt.js");
Object.defineProperty(exports, "COMPETITIVE_ANALYSIS_PROMPT", { enumerable: true, get: function () { return competitive_analysis_prompt_js_1.COMPETITIVE_ANALYSIS_PROMPT; } });
var category_classification_prompt_js_1 = require("./category-classification.prompt.js");
Object.defineProperty(exports, "CATEGORY_CLASSIFICATION_PROMPT", { enumerable: true, get: function () { return category_classification_prompt_js_1.CATEGORY_CLASSIFICATION_PROMPT; } });
var fitment_extraction_prompt_js_1 = require("./fitment-extraction.prompt.js");
Object.defineProperty(exports, "FITMENT_EXTRACTION_PROMPT", { enumerable: true, get: function () { return fitment_extraction_prompt_js_1.FITMENT_EXTRACTION_PROMPT; } });
var image_analysis_prompt_js_1 = require("./image-analysis.prompt.js");
Object.defineProperty(exports, "IMAGE_ANALYSIS_PROMPT", { enumerable: true, get: function () { return image_analysis_prompt_js_1.IMAGE_ANALYSIS_PROMPT; } });
var cross_reference_prompt_js_1 = require("./cross-reference.prompt.js");
Object.defineProperty(exports, "CROSS_REFERENCE_PROMPT", { enumerable: true, get: function () { return cross_reference_prompt_js_1.CROSS_REFERENCE_PROMPT; } });
var pricing_analysis_prompt_js_1 = require("./pricing-analysis.prompt.js");
Object.defineProperty(exports, "PRICING_ANALYSIS_PROMPT", { enumerable: true, get: function () { return pricing_analysis_prompt_js_1.PRICING_ANALYSIS_PROMPT; } });
var vin_parts_compatibility_prompt_js_1 = require("./vin-parts-compatibility.prompt.js");
Object.defineProperty(exports, "VIN_PARTS_COMPATIBILITY_PROMPT", { enumerable: true, get: function () { return vin_parts_compatibility_prompt_js_1.VIN_PARTS_COMPATIBILITY_PROMPT; } });
Object.defineProperty(exports, "VIN_PARTS_COMPATIBILITY_COMPACT_PROMPT", { enumerable: true, get: function () { return vin_parts_compatibility_prompt_js_1.VIN_PARTS_COMPATIBILITY_COMPACT_PROMPT; } });
var title_part_verification_prompt_js_1 = require("./title-part-verification.prompt.js");
Object.defineProperty(exports, "TITLE_PART_VERIFICATION_PROMPT", { enumerable: true, get: function () { return title_part_verification_prompt_js_1.TITLE_PART_VERIFICATION_PROMPT; } });
var title_position_part_name_prompt_js_1 = require("./title-position-part-name.prompt.js");
Object.defineProperty(exports, "TITLE_POSITION_PART_NAME_PROMPT", { enumerable: true, get: function () { return title_position_part_name_prompt_js_1.TITLE_POSITION_PART_NAME_PROMPT; } });
const data_enrichment_prompt_js_2 = require("./data-enrichment.prompt.js");
const listing_generation_prompt_js_2 = require("./listing-generation.prompt.js");
const listing_generation_de_prompt_js_2 = require("./listing-generation-de.prompt.js");
const listing_generation_batch_prompt_js_2 = require("./listing-generation-batch.prompt.js");
const listing_generation_batch_de_prompt_js_2 = require("./listing-generation-batch-de.prompt.js");
const competitive_analysis_prompt_js_2 = require("./competitive-analysis.prompt.js");
const category_classification_prompt_js_2 = require("./category-classification.prompt.js");
const fitment_extraction_prompt_js_2 = require("./fitment-extraction.prompt.js");
const image_analysis_prompt_js_2 = require("./image-analysis.prompt.js");
const cross_reference_prompt_js_2 = require("./cross-reference.prompt.js");
const pricing_analysis_prompt_js_2 = require("./pricing-analysis.prompt.js");
const vin_parts_compatibility_prompt_js_2 = require("./vin-parts-compatibility.prompt.js");
const title_part_verification_prompt_js_2 = require("./title-part-verification.prompt.js");
const title_position_part_name_prompt_js_2 = require("./title-position-part-name.prompt.js");
exports.PROMPT_REGISTRY = {
    [data_enrichment_prompt_js_2.DATA_ENRICHMENT_PROMPT.name]: data_enrichment_prompt_js_2.DATA_ENRICHMENT_PROMPT,
    [listing_generation_prompt_js_2.LISTING_GENERATION_PROMPT.name]: listing_generation_prompt_js_2.LISTING_GENERATION_PROMPT,
    [listing_generation_de_prompt_js_2.LISTING_GENERATION_DE_PROMPT.name]: listing_generation_de_prompt_js_2.LISTING_GENERATION_DE_PROMPT,
    [listing_generation_batch_prompt_js_2.LISTING_GENERATION_BATCH_PROMPT.name]: listing_generation_batch_prompt_js_2.LISTING_GENERATION_BATCH_PROMPT,
    [listing_generation_batch_de_prompt_js_2.LISTING_GENERATION_BATCH_DE_PROMPT.name]: listing_generation_batch_de_prompt_js_2.LISTING_GENERATION_BATCH_DE_PROMPT,
    [competitive_analysis_prompt_js_2.COMPETITIVE_ANALYSIS_PROMPT.name]: competitive_analysis_prompt_js_2.COMPETITIVE_ANALYSIS_PROMPT,
    [category_classification_prompt_js_2.CATEGORY_CLASSIFICATION_PROMPT.name]: category_classification_prompt_js_2.CATEGORY_CLASSIFICATION_PROMPT,
    [fitment_extraction_prompt_js_2.FITMENT_EXTRACTION_PROMPT.name]: fitment_extraction_prompt_js_2.FITMENT_EXTRACTION_PROMPT,
    [image_analysis_prompt_js_2.IMAGE_ANALYSIS_PROMPT.name]: image_analysis_prompt_js_2.IMAGE_ANALYSIS_PROMPT,
    [cross_reference_prompt_js_2.CROSS_REFERENCE_PROMPT.name]: cross_reference_prompt_js_2.CROSS_REFERENCE_PROMPT,
    [pricing_analysis_prompt_js_2.PRICING_ANALYSIS_PROMPT.name]: pricing_analysis_prompt_js_2.PRICING_ANALYSIS_PROMPT,
    [vin_parts_compatibility_prompt_js_2.VIN_PARTS_COMPATIBILITY_PROMPT.name]: vin_parts_compatibility_prompt_js_2.VIN_PARTS_COMPATIBILITY_PROMPT,
    [vin_parts_compatibility_prompt_js_2.VIN_PARTS_COMPATIBILITY_COMPACT_PROMPT.name]: vin_parts_compatibility_prompt_js_2.VIN_PARTS_COMPATIBILITY_COMPACT_PROMPT,
    [title_part_verification_prompt_js_2.TITLE_PART_VERIFICATION_PROMPT.name]: title_part_verification_prompt_js_2.TITLE_PART_VERIFICATION_PROMPT,
    [title_position_part_name_prompt_js_2.TITLE_POSITION_PART_NAME_PROMPT.name]: title_position_part_name_prompt_js_2.TITLE_POSITION_PART_NAME_PROMPT,
};
function renderPrompt(template, variables) {
    let systemPrompt = template.systemPrompt;
    let userPrompt = template.userPrompt;
    for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        systemPrompt = systemPrompt.replaceAll(placeholder, value);
        userPrompt = userPrompt.replaceAll(placeholder, value);
    }
    return { systemPrompt, userPrompt };
}
//# sourceMappingURL=index.js.map