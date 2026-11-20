"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PIPELINE_GRIDX_REQUIRED_HEADERS = void 0;
exports.validatePipelineGridxHeaders = validatePipelineGridxHeaders;
exports.sheetToVisibleAoa = sheetToVisibleAoa;
exports.countHiddenDataRows = countHiddenDataRows;
exports.parsePipelineUploadRows = parsePipelineUploadRows;
exports.countHiddenDataRowsInUpload = countHiddenDataRowsInUpload;
exports.PIPELINE_GRIDX_REQUIRED_HEADERS = [
    'Part Number',
    'Price',
    'Quantity',
    'Vehicle Make',
    'Description',
    'Image URLs',
    'SKU',
];
function norm(value) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function findHeaderRow(rows) {
    for (let i = 0; i < Math.min(rows.length, 8); i++) {
        const row = rows[i];
        if (!row)
            continue;
        if (row.some((c) => /part\s*number/i.test(String(c ?? ''))))
            return i;
    }
    for (let i = 0; i < Math.min(rows.length, 8); i++) {
        const row = rows[i];
        if (!row)
            continue;
        if (row.some((c) => /^part$/i.test(String(c ?? '').trim())))
            return i;
    }
    return -1;
}
function validatePipelineGridxHeaders(rows) {
    if (!rows.length) {
        return {
            ok: false,
            missing: [...exports.PIPELINE_GRIDX_REQUIRED_HEADERS],
            headers: [],
            message: 'File is empty. Download the GridX sample template and keep the header row unchanged.',
        };
    }
    const headerIdx = findHeaderRow(rows);
    if (headerIdx < 0) {
        return {
            ok: false,
            missing: [...exports.PIPELINE_GRIDX_REQUIRED_HEADERS],
            headers: [],
            message: 'Could not find a header row with "Part Number". Download the GridX sample template from Pipeline.',
        };
    }
    const headers = (rows[headerIdx] ?? []).map((h) => String(h ?? '').trim());
    const unique = new Set(headers.map(norm).filter(Boolean));
    if (headers.filter(Boolean).length >= 4 && unique.size <= 2) {
        return {
            ok: false,
            missing: [...exports.PIPELINE_GRIDX_REQUIRED_HEADERS],
            headers,
            message: 'Header row looks corrupted (duplicate column names). Keep the sample headers exactly: Part Number, Price, Quantity, Vehicle Make, Description, Image URLs, SKU.',
        };
    }
    const missing = exports.PIPELINE_GRIDX_REQUIRED_HEADERS.filter((required) => {
        const want = norm(required);
        return !headers.some((h) => {
            const got = norm(h);
            return got === want || got.includes(want);
        });
    });
    if (missing.length) {
        return {
            ok: false,
            missing: [...missing],
            headers,
            message: `Missing required columns: ${missing.join(', ')}. Download the GridX sample template and do not rename those headers.`,
        };
    }
    return { ok: true, headers };
}
function sheetToVisibleAoa(ws) {
    const XLSX = require('xlsx');
    const rows = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: '',
    });
    const rowMeta = ws['!rows'] ?? [];
    if (!rowMeta.length)
        return rows;
    return rows.filter((_, index) => !rowMeta[index]?.hidden);
}
function countHiddenDataRows(ws) {
    const XLSX = require('xlsx');
    const rows = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: '',
    });
    const rowMeta = ws['!rows'] ?? [];
    if (!rowMeta.length)
        return 0;
    let skipped = 0;
    for (let i = 0; i < rows.length; i++) {
        if (!rowMeta[i]?.hidden)
            continue;
        const row = rows[i];
        if (!row)
            continue;
        const hasData = row.some((c) => String(c ?? '').trim() !== '');
        if (hasData)
            skipped++;
    }
    return skipped;
}
function parsePipelineUploadRows(fileBuffer) {
    const XLSX = require('xlsx');
    const wb = XLSX.read(fileBuffer, { type: 'buffer', cellStyles: true });
    const sheetName = wb.SheetNames.find((n) => !/instruction/i.test(n)) || wb.SheetNames[0];
    if (!sheetName)
        return [];
    const ws = wb.Sheets[sheetName];
    if (!ws)
        return [];
    return sheetToVisibleAoa(ws);
}
function countHiddenDataRowsInUpload(fileBuffer) {
    const XLSX = require('xlsx');
    const wb = XLSX.read(fileBuffer, { type: 'buffer', cellStyles: true });
    const sheetName = wb.SheetNames.find((n) => !/instruction/i.test(n)) || wb.SheetNames[0];
    if (!sheetName)
        return 0;
    const ws = wb.Sheets[sheetName];
    if (!ws)
        return 0;
    return countHiddenDataRows(ws);
}
//# sourceMappingURL=pipeline-gridx-format.js.map