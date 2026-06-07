import path from 'node:path';

export const DEFAULT_MODEL = 'minimax/minimax-m3';
export const MAX_EBAY_TITLE_LENGTH = 80;

const PART_NUMBER_PATTERN = /\b[A-Z0-9][A-Z0-9-]{4,}\b/g;
const STRONG_CLAIM_PATTERN = /\b(best|perfect fit|guaranteed fit|exact match|exact fit|oem quality|warranty|guarantee(?:d)?|easy installation|tested|verified|no returns?|free returns?)\b/i;
const FITMENT_RISK_PATTERN = /\b(fits all|fits any|fits most|guaranteed fit|exact fit|direct fit|plug and play)\b/i;
const OPERATIONAL_RISK_PATTERN = /\b(return policy|shipping policy|payment policy|handling time|worldwide shipping|dhl|fedex|aramex|days returns?)\b/i;

export function parseArgs(argv) {
  const options = {
    input: '',
    output: '',
    report: '',
    changes: '',
    model: DEFAULT_MODEL,
    batchSize: 5,
    sampleSize: 3,
    maxItems: Number.POSITIVE_INFINITY,
    delayMs: 0,
    dryRun: false,
    allowMissingKey: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case '--input':
        options.input = next;
        index += 1;
        break;
      case '--output':
        options.output = next;
        index += 1;
        break;
      case '--report':
        options.report = next;
        index += 1;
        break;
      case '--changes':
        options.changes = next;
        index += 1;
        break;
      case '--model':
        options.model = next || DEFAULT_MODEL;
        index += 1;
        break;
      case '--batch-size':
        options.batchSize = clampPositiveInteger(next, 5);
        index += 1;
        break;
      case '--sample-size':
        options.sampleSize = clampPositiveInteger(next, 3);
        index += 1;
        break;
      case '--max-items':
        options.maxItems = clampPositiveInteger(next, Number.POSITIVE_INFINITY);
        index += 1;
        break;
      case '--delay-ms':
        options.delayMs = clampNonNegativeInteger(next, 0);
        index += 1;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--allow-missing-key':
        options.allowMissingKey = true;
        break;
      default:
        break;
    }
  }

  return options;
}

export function defaultOutputPaths(sourcePath) {
  const directory = path.dirname(sourcePath);
  const sourceName = path.basename(sourcePath);
  const normalizedStem = sourceName
    .replace(/\.csv$/i, '')
    .replace(/\s*\(\d+\)$/, '');

  return {
    output: path.join(directory, `${normalizedStem}.enhanced.csv`),
    report: path.join(directory, `${normalizedStem}.enhancement-report.json`),
    changes: path.join(directory, `${normalizedStem}.changes.csv`),
  };
}

export function parseCsvDocument(sourceText) {
  const hasBom = sourceText.charCodeAt(0) === 0xfeff;
  const text = hasBom ? sourceText.slice(1) : sourceText;
  const rows = [];

  let row = createRow(1);
  let lineNumber = 1;
  let index = 0;
  let inQuotes = false;
  let wasQuoted = false;
  let justClosedQuote = false;
  let cellRaw = '';
  let cellValue = '';

  const finalizeCell = () => {
    row.cells.push({
      raw: cellRaw,
      value: cellValue,
      wasQuoted,
    });
    cellRaw = '';
    cellValue = '';
    wasQuoted = false;
    justClosedQuote = false;
  };

  const finalizeRow = (lineTerminator) => {
    row.lineTerminator = lineTerminator;
    rows.push(row);
    row = createRow(lineNumber + 1);
  };

  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1] ?? '';

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          cellRaw += '""';
          cellValue += '"';
          index += 2;
          continue;
        }

        cellRaw += char;
        inQuotes = false;
        justClosedQuote = true;
        index += 1;
        continue;
      }

      if (char === '\r' || char === '\n') {
        const lineBreak = char === '\r' && next === '\n' ? '\r\n' : char;
        cellRaw += lineBreak;
        cellValue += lineBreak;
        lineNumber += 1;
        index += lineBreak.length;
        continue;
      }

      cellRaw += char;
      cellValue += char;
      index += 1;
      continue;
    }

    if (justClosedQuote) {
      if (char === ',') {
        finalizeCell();
        index += 1;
        continue;
      }

      if (char === '\r' || char === '\n') {
        const lineBreak = char === '\r' && next === '\n' ? '\r\n' : char;
        finalizeCell();
        finalizeRow(lineBreak);
        lineNumber += 1;
        index += lineBreak.length;
        continue;
      }

      cellRaw += char;
      cellValue += char;
      justClosedQuote = false;
      index += 1;
      continue;
    }

    if (char === '"' && cellRaw.length === 0 && cellValue.length === 0) {
      inQuotes = true;
      wasQuoted = true;
      cellRaw += char;
      index += 1;
      continue;
    }

    if (char === ',') {
      finalizeCell();
      index += 1;
      continue;
    }

    if (char === '\r' || char === '\n') {
      const lineBreak = char === '\r' && next === '\n' ? '\r\n' : char;
      finalizeCell();
      finalizeRow(lineBreak);
      lineNumber += 1;
      index += lineBreak.length;
      continue;
    }

    cellRaw += char;
    cellValue += char;
    index += 1;
  }

  const hasOpenContent = row.cells.length > 0 || cellRaw.length > 0 || cellValue.length > 0;
  if (hasOpenContent) {
    finalizeCell();
    finalizeRow('');
  }

  return {
    hasBom,
    rows,
    newlineStyle: detectDominantNewline(rows),
  };
}

export function inspectStructure(document) {
  const headerRowIndex = document.rows.findIndex((row) => {
    const firstCell = row.cells[0]?.value ?? '';
    return firstCell.startsWith('*Action(');
  });

  if (headerRowIndex < 0) {
    throw new Error('Could not find the eBay header row.');
  }

  const headerRow = document.rows[headerRowIndex];
  const headerMap = buildHeaderMap(headerRow);
  const metadataRows = document.rows.slice(0, headerRowIndex).map((row) => row.csvRowNumber);
  const totalRows = document.rows.length;
  const totalColumns = headerRow.cells.length;

  const rowDetails = document.rows.map((row, rowIndex) => {
    const rowType = classifyRow(row, rowIndex, headerRowIndex, headerMap);
    return {
      rowIndex,
      csvRowNumber: row.csvRowNumber,
      type: rowType,
      columnCount: row.cells.length,
      customLabel: getCellValue(row, headerMap.CustomLabel),
    };
  });

  const itemRows = rowDetails.filter((row) => row.type === 'item');
  const compatibilityRows = rowDetails.filter((row) => row.type === 'compatibility');
  const blankRows = rowDetails.filter((row) => row.type === 'blank');

  return {
    headerRowIndex,
    headerRowNumber: headerRow.csvRowNumber,
    dataStartRowNumber: document.rows[headerRowIndex + 1]?.csvRowNumber ?? null,
    metadataRows,
    totalRows,
    totalColumns,
    itemRowCount: itemRows.length,
    compatibilityRowCount: compatibilityRows.length,
    blankRowCount: blankRows.length,
    headerValues: headerRow.cells.map((cell) => cell.value),
    headerMap,
    rowDetails,
  };
}

export function buildHeaderMap(headerRow) {
  const map = {};
  headerRow.cells.forEach((cell, index) => {
    map[cell.value] = index;
  });
  return map;
}

export function classifyRow(row, rowIndex, headerRowIndex, headerMap) {
  if (rowIndex < headerRowIndex) {
    return 'metadata';
  }

  if (rowIndex === headerRowIndex) {
    return 'header';
  }

  if (row.cells.every((cell) => cell.value === '')) {
    return 'blank';
  }

  const relationship = getCellValue(row, headerMap.Relationship);
  const firstCell = row.cells[0]?.value ?? '';
  if (relationship === 'Compatibility') {
    return 'compatibility';
  }

  if (firstCell) {
    return 'item';
  }

  return 'other';
}

export function getItemRows(document, inspection) {
  return inspection.rowDetails
    .filter((row) => row.type === 'item')
    .map((detail) => document.rows[detail.rowIndex]);
}

export function extractApprovedFields(row, headerMap) {
  return {
    customLabel: getCellValue(row, headerMap.CustomLabel),
    title: getCellValue(row, headerMap['*Title']),
    description: getCellValue(row, headerMap['*Description']),
    category: getCellValue(row, headerMap['*Category']),
    condition: getCellValue(row, headerMap['*ConditionID']),
    brand: getCellValue(row, headerMap['*C:Brand']),
    type: getCellValue(row, headerMap['C:Type']),
    placement: getCellValue(row, headerMap['C:Placement on Vehicle']),
    material: getCellValue(row, headerMap['C:Material']),
    features: getCellValue(row, headerMap['C:Features']),
    mpn: getCellValue(row, headerMap['C:Manufacturer Part Number']),
    oe_oem: getCellValue(row, headerMap['C:OE/OEM Part Number']),
  };
}

export function buildModelPayload(fields) {
  return {
    title: fields.title,
    description: stripHtml(fields.description),
    category: fields.category,
    condition: fields.condition,
    brand: fields.brand,
    type: fields.type,
    placement: fields.placement,
    material: fields.material,
    features: fields.features,
    mpn: fields.mpn,
    oe_oem: fields.oe_oem,
  };
}

export function buildPrompts(payload) {
  const systemPrompt = [
    'You enhance eBay Motors listing text only.',
    'Use only the provided row fields.',
    'Do not invent fitment, compatibility, OEM equivalence, specifications, warranty, returns, shipping, installation claims, or included items.',
    'Preserve factual accuracy and remain conservative if the data is incomplete.',
    'Return valid JSON only with keys: proposed_title, proposed_description, changed_fields, safety_flags, optional_reasoning_summary.',
    'proposed_title must be concise, marketplace-appropriate, and no longer than 80 characters.',
    'proposed_description must be plain text only, professional, compact, and free of HTML.',
    'If a field is already strong or information is insufficient, return the original field unchanged.',
  ].join(' ');

  const userPrompt = JSON.stringify(payload, null, 2);
  return { systemPrompt, userPrompt };
}

export function parseModelResponse(rawContent) {
  const parsed = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
  return {
    proposed_title: normalizeModelText(parsed?.proposed_title ?? ''),
    proposed_description: normalizeModelText(parsed?.proposed_description ?? ''),
    optional_reasoning_summary: normalizeModelText(parsed?.optional_reasoning_summary ?? ''),
    changed_fields: Array.isArray(parsed?.changed_fields)
      ? parsed.changed_fields.filter((entry) => entry === 'title' || entry === 'description')
      : [],
    safety_flags: Array.isArray(parsed?.safety_flags)
      ? parsed.safety_flags.map((flag) => normalizeModelText(flag)).filter(Boolean)
      : [],
  };
}

export function validateProposal(fields, proposal) {
  const warnings = [];
  const errors = [];
  const sourceSnapshot = JSON.stringify(buildModelPayload(fields)).toUpperCase();
  const allowedIdentifiers = collectAllowedIdentifiers(fields);
  const title = proposal.proposed_title || fields.title;
  const description = proposal.proposed_description || stripHtml(fields.description);

  if (!title) {
    errors.push('Empty title proposal.');
  }

  if (title.length > MAX_EBAY_TITLE_LENGTH) {
    errors.push(`Title exceeds ${MAX_EBAY_TITLE_LENGTH} characters.`);
  }

  if (containsUnsupportedClaims(title, sourceSnapshot)) {
    errors.push('Title contains unsupported claims.');
  }

  if (FITMENT_RISK_PATTERN.test(title)) {
    errors.push('Title contains suspicious fitment certainty.');
  }

  if (containsUnsupportedClaims(description, sourceSnapshot)) {
    errors.push('Description contains unsupported claims.');
  }

  if (FITMENT_RISK_PATTERN.test(description)) {
    errors.push('Description contains suspicious fitment certainty.');
  }

  if (OPERATIONAL_RISK_PATTERN.test(description)) {
    errors.push('Description includes operational policy text.');
  }

  if (/[<>]/.test(description)) {
    errors.push('Description must be plain text only.');
  }

  const unexpectedIdentifiers = findUnexpectedIdentifiers(`${title}\n${description}`, allowedIdentifiers);
  if (unexpectedIdentifiers.length > 0) {
    errors.push(`Unexpected identifiers found: ${unexpectedIdentifiers.join(', ')}`);
  }

  if (proposal.changed_fields.some((field) => field !== 'title' && field !== 'description')) {
    errors.push('Response attempted to change unsupported fields.');
  }

  if (proposal.safety_flags.length > 0) {
    warnings.push(...proposal.safety_flags);
  }

  const changedFields = [];
  if (title !== fields.title) {
    changedFields.push('title');
  }
  if (description !== stripHtml(fields.description)) {
    changedFields.push('description');
  }

  return {
    accepted: errors.length === 0,
    errors,
    warnings,
    changedFields,
    sanitizedTitle: title,
    sanitizedDescription: description,
  };
}

export function applyApprovedChanges(row, headerMap, validation) {
  if (validation.changedFields.includes('title')) {
    setCellValue(row, headerMap['*Title'], validation.sanitizedTitle);
  }

  if (validation.changedFields.includes('description')) {
    setCellValue(row, headerMap['*Description'], validation.sanitizedDescription);
  }
}

export function serializeCsvDocument(document) {
  const body = document.rows
    .map((row) => row.cells.map((cell) => cell.raw).join(',') + row.lineTerminator)
    .join('');
  return document.hasBom ? `\uFEFF${body}` : body;
}

export function verifyStructure(originalDocument, outputText, originalInspection) {
  const reparsed = parseCsvDocument(outputText);
  const outputInspection = inspectStructure(reparsed);
  const issues = [];

  if (originalDocument.rows.length !== reparsed.rows.length) {
    issues.push('Row count changed.');
  }

  if (originalInspection.totalColumns !== outputInspection.totalColumns) {
    issues.push('Column count changed.');
  }

  if (originalInspection.headerRowIndex !== outputInspection.headerRowIndex) {
    issues.push('Header row position changed.');
  }

  const originalHeader = originalInspection.headerValues.join('||');
  const outputHeader = outputInspection.headerValues.join('||');
  if (originalHeader !== outputHeader) {
    issues.push('Header row content changed.');
  }

  for (const metadataRowNumber of originalInspection.metadataRows) {
    const originalRow = originalDocument.rows[metadataRowNumber - 1];
    const outputRow = reparsed.rows[metadataRowNumber - 1];
    const originalCells = originalRow.cells.map((cell) => cell.value).join('||');
    const outputCells = outputRow.cells.map((cell) => cell.value).join('||');
    if (originalCells !== outputCells) {
      issues.push(`Metadata row ${metadataRowNumber} changed.`);
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    outputInspection,
  };
}

export function renderChangesCsv(entries) {
  const rows = [
    [
      'csv_row_number',
      'custom_label',
      'status',
      'old_title',
      'new_title',
      'old_description_preview',
      'new_description_preview',
      'warnings',
      'skip_reason',
    ],
  ];

  for (const entry of entries) {
    rows.push([
      String(entry.csvRowNumber ?? ''),
      entry.customLabel ?? '',
      entry.status ?? '',
      entry.oldTitle ?? '',
      entry.newTitle ?? '',
      entry.oldDescriptionPreview ?? '',
      entry.newDescriptionPreview ?? '',
      (entry.warnings ?? []).join(' | '),
      entry.skipReason ?? '',
    ]);
  }

  return rows.map((row) => row.map((value) => encodeCsvValue(value, true)).join(',')).join('\r\n');
}

export function createChangeEntry(row, fields, outcome) {
  return {
    csvRowNumber: row.csvRowNumber,
    customLabel: fields.customLabel,
    status: outcome.status,
    oldTitle: fields.title,
    newTitle: outcome.newTitle ?? fields.title,
    oldDescriptionPreview: previewText(stripHtml(fields.description), 180),
    newDescriptionPreview: previewText(outcome.newDescription ?? stripHtml(fields.description), 180),
    warnings: outcome.warnings ?? [],
    skipReason: outcome.skipReason ?? '',
  };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function summarizeExamples(entries, limit = 3) {
  return entries.slice(0, limit).map((entry) => ({
    csv_row_number: entry.csvRowNumber,
    custom_label: entry.customLabel,
    status: entry.status,
    old_title: entry.oldTitle,
    new_title: entry.newTitle,
    old_description_preview: entry.oldDescriptionPreview,
    new_description_preview: entry.newDescriptionPreview,
    warnings: entry.warnings,
    skip_reason: entry.skipReason,
  }));
}

function createRow(csvRowNumber) {
  return {
    csvRowNumber,
    cells: [],
    lineTerminator: '',
  };
}

function detectDominantNewline(rows) {
  const counts = { '\r\n': 0, '\n': 0, '\r': 0 };
  for (const row of rows) {
    if (row.lineTerminator in counts) {
      counts[row.lineTerminator] += 1;
    }
  }
  return Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] || '\r\n';
}

function clampPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clampNonNegativeInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function getCellValue(row, index) {
  if (!Number.isInteger(index) || index < 0) {
    return '';
  }
  return row.cells[index]?.value ?? '';
}

function setCellValue(row, index, value) {
  if (!Number.isInteger(index) || index < 0) {
    return;
  }

  while (row.cells.length <= index) {
    row.cells.push({ raw: '', value: '', wasQuoted: false });
  }

  const previous = row.cells[index];
  row.cells[index] = {
    raw: encodeCsvValue(value, previous?.wasQuoted ?? false),
    value,
    wasQuoted: shouldQuote(value, previous?.wasQuoted ?? false),
  };
}

function encodeCsvValue(value, preferQuoted) {
  const normalized = String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const quote = shouldQuote(normalized, preferQuoted);
  const escaped = normalized.replace(/"/g, '""');
  return quote ? `"${escaped}"` : escaped;
}

function shouldQuote(value, preferQuoted) {
  if (preferQuoted) {
    return true;
  }
  return /[",\n\r]/.test(value) || /^\s|\s$/.test(value);
}

function normalizeModelText(value) {
  return String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function containsUnsupportedClaims(text, sourceSnapshot) {
  if (!text) {
    return false;
  }

  if (STRONG_CLAIM_PATTERN.test(text)) {
    const match = text.match(STRONG_CLAIM_PATTERN)?.[0] ?? '';
    return !sourceSnapshot.includes(match.toUpperCase());
  }

  return false;
}

function collectAllowedIdentifiers(fields) {
  const tokens = new Set();
  const source = [
    fields.title,
    fields.description,
    fields.mpn,
    fields.oe_oem,
    fields.category,
    fields.brand,
    fields.type,
  ]
    .join(' ')
    .toUpperCase();

  for (const match of source.matchAll(PART_NUMBER_PATTERN)) {
    const token = match[0];
    if (/\d/.test(token)) {
      tokens.add(token);
    }
  }

  return tokens;
}

function findUnexpectedIdentifiers(text, allowedIdentifiers) {
  const unexpected = new Set();
  const source = String(text ?? '').toUpperCase();

  for (const match of source.matchAll(PART_NUMBER_PATTERN)) {
    const token = match[0];
    if (!/\d/.test(token)) {
      continue;
    }
    if (!allowedIdentifiers.has(token)) {
      unexpected.add(token);
    }
  }

  return Array.from(unexpected);
}

function previewText(value, maxLength) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}