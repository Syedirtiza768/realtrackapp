"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeJson = sanitizeJson;
function sanitizeJson(raw) {
    if (!raw || typeof raw !== 'string') {
        throw new Error('sanitizeJson: input must be a non-empty string');
    }
    let cleaned = raw.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '');
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let start = -1;
    let isArray = false;
    if (firstBrace >= 0 && firstBracket >= 0) {
        if (firstBracket < firstBrace) {
            start = firstBracket;
            isArray = true;
        }
        else {
            start = firstBrace;
        }
    }
    else if (firstBrace >= 0) {
        start = firstBrace;
    }
    else if (firstBracket >= 0) {
        start = firstBracket;
        isArray = true;
    }
    if (start < 0) {
        throw new Error('sanitizeJson: no JSON object or array found in input');
    }
    cleaned = cleaned.substring(start);
    const openChar = isArray ? '[' : '{';
    const closeChar = isArray ? ']' : '}';
    let depth = 0;
    let lastClose = -1;
    let inString = false;
    let escape = false;
    for (let i = 0; i < cleaned.length; i++) {
        const ch = cleaned[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (ch === '\\' && inString) {
            escape = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (inString)
            continue;
        if (ch === openChar) {
            depth++;
        }
        else if (ch === closeChar) {
            depth--;
            if (depth === 0) {
                lastClose = i;
                break;
            }
        }
    }
    if (lastClose > 0) {
        cleaned = cleaned.substring(0, lastClose + 1);
    }
    try {
        return JSON.parse(cleaned);
    }
    catch {
    }
    let fixed = cleaned.replace(/,(\s*[}\]])/g, '$1');
    fixed = fixed.replace(/,(\s*\n\s*[}\]])/g, '$1');
    try {
        return JSON.parse(fixed);
    }
    catch {
    }
    let inStr = false;
    let esc = false;
    const chars = [...fixed];
    const result = [];
    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (esc) {
            result.push(ch);
            esc = false;
            continue;
        }
        if (ch === '\\' && inStr) {
            result.push(ch);
            esc = true;
            continue;
        }
        if (ch === '"') {
            inStr = !inStr;
            result.push(ch);
            continue;
        }
        if (inStr) {
            if (ch === '\n') {
                result.push('\\n');
            }
            else if (ch === '\r') {
                result.push('\\r');
            }
            else if (ch === '\t') {
                result.push('\\t');
            }
            else {
                result.push(ch);
            }
        }
        else {
            result.push(ch);
        }
    }
    const escaped = result.join('');
    try {
        return JSON.parse(escaped);
    }
    catch {
    }
    const collapsed = escaped.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');
    try {
        return JSON.parse(collapsed);
    }
    catch (finalError) {
        throw new Error(`sanitizeJson: unable to parse JSON after all fixes. Last error: ${finalError.message}`);
    }
}
//# sourceMappingURL=json-sanitizer.js.map