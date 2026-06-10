/**
 * Expand year-range fitment rows into per-year MVL rows (post-AI, pre-dedupe).
 */

export function expandFitmentYearRanges(rows) {
  const out = [];

  for (const row of rows) {
    if (row.yearStart != null || row.yearEnd != null) {
      const start = Number(row.yearStart ?? row.year);
      const end = Number(row.yearEnd ?? row.yearStart ?? row.year);
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        const lo = Math.min(start, end);
        const hi = Math.max(start, end);
        const { yearStart, yearEnd, ...rest } = row;
        for (let y = lo; y <= hi; y++) {
          out.push({ ...rest, year: String(y) });
        }
        continue;
      }
    }

    if (typeof row.year === 'string' && row.year.includes('-')) {
      const [a, b] = row.year.split('-').map((s) => Number(s.trim()));
      if (!Number.isNaN(a) && !Number.isNaN(b)) {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        const { year, ...rest } = row;
        for (let y = lo; y <= hi; y++) {
          out.push({ ...rest, year: String(y) });
        }
        continue;
      }
    }

    out.push(row);
  }

  return out;
}
