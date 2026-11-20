"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PIPELINE_CONDITION_OPTIONS = void 0;
exports.mapPipelineDisplayStatus = mapPipelineDisplayStatus;
exports.PIPELINE_CONDITION_OPTIONS = {
    Used: '3000',
    New: '1000',
    Refurbished: '2500',
};
function mapPipelineDisplayStatus(status) {
    if (status === 'pending')
        return 'queued';
    if (status === 'completed')
        return 'uploaded';
    if (status === 'failed' || status === 'cancelled')
        return 'failed';
    return 'processing';
}
//# sourceMappingURL=pipeline.constants.js.map