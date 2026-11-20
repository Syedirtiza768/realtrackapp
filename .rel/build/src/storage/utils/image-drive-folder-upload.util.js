"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeFolderUploadPath = normalizeFolderUploadPath;
exports.isLikelyPartNumberFolderName = isLikelyPartNumberFolderName;
exports.resolveFolderUploadPath = resolveFolderUploadPath;
exports.isSupportedImageUpload = isSupportedImageUpload;
const GENERIC_FOLDER_NAMES = new Set([
    'asset',
    'assets',
    'image',
    'images',
    'photo',
    'photos',
    'picture',
    'pictures',
    'pic',
    'pics',
    'media',
    'files',
    'parts',
    'products',
    'uploads',
]);
function normalizeFolderUploadPath(raw) {
    const value = String(raw ?? '')
        .replace(/\\/g, '/')
        .trim();
    if (!value || value.startsWith('/') || /^[a-zA-Z]:\//.test(value)) {
        return null;
    }
    const rawSegments = value.split('/');
    if (rawSegments.some((segment) => segment.trim() === '..'))
        return null;
    const segments = rawSegments
        .map((segment) => segment.trim())
        .filter((segment) => segment && segment !== '.' && segment !== '..')
        .map((segment) => segment
        .replace(/[^a-zA-Z0-9 _().-]/g, '_')
        .replace(/\s+/g, ' ')
        .slice(0, 180))
        .filter(Boolean);
    return segments.length > 0 ? segments.join('/') : null;
}
function isLikelyPartNumberFolderName(raw) {
    const name = String(raw ?? '').trim();
    const normalized = name
        .toLowerCase()
        .replace(/[\s\-_./\\]+/g, '')
        .replace(/[^a-z0-9]/g, '');
    return (normalized.length >= 2 &&
        !GENERIC_FOLDER_NAMES.has(normalized) &&
        /\d/.test(normalized));
}
function resolveFolderUploadPath(rawPath, fallbackTopLevelFolderName = 'Folder Upload') {
    const relativePath = normalizeFolderUploadPath(rawPath);
    if (!relativePath)
        return null;
    const segments = relativePath.split('/');
    const fileName = segments[segments.length - 1];
    if (!fileName || !fileName.includes('.'))
        return null;
    let partIndex = -1;
    for (let i = segments.length - 2; i >= 0; i -= 1) {
        if (isLikelyPartNumberFolderName(segments[i])) {
            partIndex = i;
            break;
        }
    }
    const topLevelFolderName = fallbackTopLevelFolderName.trim() || segments[0] || 'Folder Upload';
    const partNumber = partIndex >= 0 ? segments[partIndex] : null;
    const assetSegments = partIndex >= 0 ? segments.slice(partIndex + 1) : segments.slice(1);
    return {
        relativePath,
        topLevelFolderName: topLevelFolderName.slice(0, 180),
        partNumber,
        assetPath: (assetSegments.length > 0 ? assetSegments : [fileName]).join('/'),
    };
}
function isSupportedImageUpload(filename, mimeType) {
    if (mimeType?.toLowerCase().startsWith('image/'))
        return true;
    return /\.(avif|bmp|gif|heic|jpeg|jpg|png|tif|tiff|webp)$/i.test(filename);
}
//# sourceMappingURL=image-drive-folder-upload.util.js.map