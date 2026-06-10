/**
 * Expand year-range fitment rows into per-year MVL rows (post-AI, pre-dedupe).
 */

export function expandFitmentYearRanges(
  rows: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const hasRange =
      row.yearStart != null ||
      row.yearEnd != null ||
      (typeof row.year === 'string' && row.year.includes('-'));

    if (row.yearStart != null || row.yearEnd != null) {
      const start = Number(row.yearStart ?? row.year);
      const end = Number(row.yearEnd ?? row.yearStart ?? row.year);
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        const lo = Math.min(start, end);
        const hi = Math.max(start, end);
        const { yearStart: _ys, yearEnd: _ye, ...rest } = row;
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
        const { year: _y, ...rest } = row;
        for (let y = lo; y <= hi; y++) {
          out.push({ ...rest, year: String(y) });
        }
        continue;
      }
    }

    if (!hasRange || row.year != null) {
      out.push(row);
    }
  }

  return out;
}
