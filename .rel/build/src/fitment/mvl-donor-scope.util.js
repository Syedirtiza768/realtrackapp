"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_UNSCOPED_MVL_ROWS = exports.MAX_FITMENT_YEAR_SPAN = void 0;
exports.scopeMvlRowsByDonorYear = scopeMvlRowsByDonorYear;
exports.isOverExpandedFitment = isOverExpandedFitment;
exports.yearRangeFromRows = yearRangeFromRows;
exports.pickDonorYear = pickDonorYear;
exports.MAX_FITMENT_YEAR_SPAN = 12;
exports.MAX_UNSCOPED_MVL_ROWS = 80;
function scopeMvlRowsByDonorYear(rows, donorYear, opts) {
    const nearYears = opts?.nearYears ?? 5;
    const wideYears = opts?.wideYears ?? 8;
    const minScoped = opts?.minScoped ?? 3;
    const all = Array.isArray(rows) ? rows : [];
    if (all.length === 0) {
        return { rows: [], scoped: true, reason: 'empty' };
    }
    const yearNum = parseInt(String(donorYear ?? ''), 10);
    if (!Number.isFinite(yearNum) || yearNum < 1900 || yearNum > 2100) {
        return { rows: [], scoped: false, reason: 'missing_donor_year' };
    }
    const near = all.filter((r) => Math.abs(Number(r.year) - yearNum) <= nearYears);
    if (near.length >= minScoped) {
        return { rows: near, scoped: true, reason: `donor_pm_${nearYears}` };
    }
    const wide = all.filter((r) => Math.abs(Number(r.year) - yearNum) <= wideYears);
    if (wide.length > 0) {
        return {
            rows: wide,
            scoped: true,
            reason: `donor_pm_${wideYears}_fallback`,
        };
    }
    const exact = all.filter((r) => Number(r.year) === yearNum);
    return {
        rows: exact,
        scoped: exact.length > 0,
        reason: exact.length > 0 ? 'donor_exact' : 'no_rows_in_window',
    };
}
function isOverExpandedFitment(rows, opts) {
    const maxSpan = opts?.maxSpan ?? exports.MAX_FITMENT_YEAR_SPAN;
    if (!Array.isArray(rows) || rows.length === 0)
        return false;
    const years = rows
        .map((r) => parseInt(String(r.year ?? r.Year ?? ''), 10))
        .filter((y) => Number.isFinite(y) && y >= 1900 && y <= 2100);
    if (years.length === 0)
        return false;
    const minY = Math.min(...years);
    const maxY = Math.max(...years);
    return maxY - minY > maxSpan;
}
function yearRangeFromRows(rows, fallbackYear) {
    const years = (rows || [])
        .map((r) => parseInt(String(r.year ?? ''), 10))
        .filter((y) => Number.isFinite(y) && y >= 1900);
    if (years.length === 0) {
        const fb = parseInt(String(fallbackYear ?? ''), 10);
        return Number.isFinite(fb) && fb >= 1900 ? String(fb) : '';
    }
    const minY = Math.min(...years);
    const maxY = Math.max(...years);
    return minY === maxY ? String(minY) : `${minY}-${maxY}`;
}
function pickDonorYear(candidates) {
    for (const c of candidates) {
        const y = parseInt(String(c ?? ''), 10);
        if (Number.isFinite(y) && y >= 1900 && y <= 2100)
            return y;
    }
    return null;
}
//# sourceMappingURL=mvl-donor-scope.util.js.map