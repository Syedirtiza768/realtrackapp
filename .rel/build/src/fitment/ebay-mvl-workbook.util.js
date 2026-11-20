"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.readMvlWorkbook = readMvlWorkbook;
exports.sheetToRows = sheetToRows;
const node_child_process_1 = require("node:child_process");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const XLSX = __importStar(require("xlsx"));
function resolveDecryptScript() {
    const candidates = [
        path.resolve(process.cwd(), 'scripts', 'ebay-mvl', 'decrypt_xlsx.py'),
        path.resolve(process.cwd(), '..', 'scripts', 'ebay-mvl', 'decrypt_xlsx.py'),
    ];
    return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}
function isPasswordProtectedError(err) {
    const message = err instanceof Error ? err.message : String(err);
    return message.toLowerCase().includes('password-protected');
}
function resolvePythonBinary() {
    const fromEnv = process.env.EBAY_MVL_PYTHON?.trim();
    if (fromEnv)
        return fromEnv;
    for (const candidate of ['python3', 'python']) {
        const check = (0, node_child_process_1.spawnSync)(candidate, ['--version'], { encoding: 'utf8' });
        if (!check.error && check.status === 0)
            return candidate;
    }
    return 'python3';
}
function readMvlWorkbook(filePath, password) {
    const buffer = fs.readFileSync(filePath);
    try {
        return XLSX.read(buffer, { type: 'buffer' });
    }
    catch (err) {
        if (!isPasswordProtectedError(err))
            throw err;
    }
    const scriptPath = resolveDecryptScript();
    if (!scriptPath) {
        throw new Error('Workbook is password-protected but scripts/ebay-mvl/decrypt_xlsx.py was not found. ' +
            'Install Python + msoffcrypto-tool or decrypt the file manually.');
    }
    const pw = password ?? process.env.EBAY_MVL_WORKBOOK_PASSWORD ?? 'VehicleList';
    const result = (0, node_child_process_1.spawnSync)(resolvePythonBinary(), [scriptPath, filePath], {
        env: {
            ...process.env,
            MVL_PASSWORD: pw,
            EBAY_MVL_WORKBOOK_PASSWORD: pw,
        },
        maxBuffer: 256 * 1024 * 1024,
    });
    if (result.error) {
        throw new Error(`Failed to run Python decrypt helper: ${result.error.message}`);
    }
    if (result.status !== 0) {
        const detail = (result.stderr?.toString() ||
            result.stdout?.toString() ||
            '').trim();
        throw new Error(`MVL workbook decrypt failed (exit ${result.status})${detail ? `: ${detail}` : ''}`);
    }
    if (!result.stdout?.length) {
        throw new Error('MVL workbook decrypt produced empty output');
    }
    return XLSX.read(result.stdout, { type: 'buffer' });
}
function sheetToRows(workbook, sheetName) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
        throw new Error(`Sheet "${sheetName}" not found in workbook`);
    }
    const matrix = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        raw: false,
    });
    const nonEmpty = matrix.filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim()));
    if (nonEmpty.length === 0) {
        return { headers: [], rows: [] };
    }
    const headers = nonEmpty[0].map((cell) => String(cell ?? '').trim());
    const rows = nonEmpty.slice(1);
    return { headers, rows };
}
//# sourceMappingURL=ebay-mvl-workbook.util.js.map