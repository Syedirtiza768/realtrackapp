"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IMAGE_UPLOAD_MULTER_OPTIONS = exports.IMAGE_UPLOAD_MAX_FILE_BYTES = void 0;
exports.IMAGE_UPLOAD_MAX_FILE_BYTES = Number(process.env.IMAGE_UPLOAD_MAX_FILE_MB ?? '20') * 1024 * 1024;
exports.IMAGE_UPLOAD_MULTER_OPTIONS = {
    limits: { fileSize: exports.IMAGE_UPLOAD_MAX_FILE_BYTES },
};
//# sourceMappingURL=upload-limits.js.map