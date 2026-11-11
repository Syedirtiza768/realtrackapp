import * as XLSX from 'xlsx';

export const PRE_ENRICHED_FEBEST_MODE = 'pre_enriched_febest_v1' as const;
export const PRE_ENRICHED_FEBEST_SCHEMA_VERSION = PRE_ENRICHED_FEBEST_MODE;

export const PRE_ENRICHED_FEBEST_PRODUCT_HEADERS = [
  'SKU',
  'Part Number',
  'Brand',
  'Title',
  'Description',
  'Description HTML',
  'Price',
  'Currency',
  'Quantity',
  'Condition ID',
  'Category ID',
  'Image URLs',
  'Item Specifics JSON',
  'Source Record ID',
  'Evidence Hash',
] as const;

export const PRE_ENRICHED_FEBEST_FITMENT_HEADERS = [
  'SKU',
  'Marketplace',
  'Year',
  'Make',
  'Model',
  'Trim',
  'Engine',
  'Submodel',
  'Body Style',
  'Drivetrain',
  'Notes',
  'Source Application ID',
  'Source URL',
  'Validation Status',
] as const;

export const PRE_ENRICHED_FEBEST_MANIFEST_HEADERS = ['Key', 'Value'] as const;

export type PreEnrichedFebestProduct = {
  rowNumber: number;
  sku: string;
  partNumber: string;
  brand: string;
  title: string;
  description: string;
  descriptionHtml: string;
  price: number | null;
  currency: string | null;
  quantity: number;
  conditionId: string;
  categoryId: string | null;
  imageUrls: string[];
  itemSpecifics: Record<string, unknown>;
  sourceRecordId: string;
  evidenceHash: string;
};

export type PreEnrichedFebestFitment = {
  rowNumber: number;
  sku: string;
  marketplace: string;
  year: string;
  make: string;
  model: string;
  trim: string | null;
  engine: string | null;
  submodel: string | null;
  bodyStyle: string | null;
  drivetrain: string | null;
  notes: string | null;
  sourceApplicationId: string;
  sourceUrl: string;
  validationStatus: string;
};

export type PreEnrichedFebestError = {
  code: string;
  sheet: string;
  row: number | null;
  field: string | null;
  message: string;
};

export type PreEnrichedFebestValidationResult = {
  ok: boolean;
  readyForImport: boolean;
  manifest: Record<string, string>;
  products: PreEnrichedFebestProduct[];
  fitments: PreEnrichedFebestFitment[];
  errors: PreEnrichedFebestError[];
  warnings: PreEnrichedFebestError[];
  summary: {
    productRows: number;
    fitmentRows: number;
    acceptedFitmentRows: number;
    reviewFitmentRows: number;
    rejectedFitmentRows: number;
    productsWithPrice: number;
    productsWithImages: number;
    productsWithAcceptedFitment: number;
    duplicateSkus: number;
    duplicatePartNumbers: number;
  };
};

const REQUIRED_SHEETS = ['Manifest', 'Products', 'Fitments'] as const;
const ALLOWED_CONDITION_IDS = new Set(['1000', '2500', '3000']);
const ALLOWED_VALIDATION_STATUSES = new Set([
  'accepted',
  'needs_review',
  'rejected',
]);

function text(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function nullableText(value: unknown): string | null {
  const result = text(value);
  return result ? result : null;
}

function normalizeHeader(value: unknown): string {
  return text(value);
}

function addIssue(
  target: PreEnrichedFebestError[],
  code: string,
  sheet: string,
  row: number | null,
  field: string | null,
  message: string,
): void {
  target.push({ code, sheet, row, field, message });
}

function readRows(
  workbook: XLSX.WorkBook,
  sheetName: string,
  expectedHeaders: readonly string[],
  errors: PreEnrichedFebestError[],
): unknown[][] {
  const ws = workbook.Sheets[sheetName];
  if (!ws) {
    addIssue(errors, 'missing_sheet', sheetName, null, null, `Missing required sheet ${sheetName}`);
    return [];
  }

  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][];
  const headers = (rows[0] ?? []).map(normalizeHeader);
  const expected = [...expectedHeaders];
  const duplicateHeaders = headers.filter(
    (header, index) => header && headers.indexOf(header) !== index,
  );
  if (duplicateHeaders.length > 0) {
    addIssue(
      errors,
      'duplicate_header',
      sheetName,
      1,
      null,
      `Duplicate header(s): ${[...new Set(duplicateHeaders)].join(', ')}`,
    );
  }

  if (headers.length !== expected.length || headers.some((header, index) => header !== expected[index])) {
    addIssue(
      errors,
      'schema_mismatch',
      sheetName,
      1,
      null,
      `Expected exact headers ${expected.join(', ')}, received ${headers.join(', ')}`,
    );
    return [];
  }
  return rows.slice(1);
}

function parseNumber(value: unknown): number | null {
  if (value == null || text(value) === '') return null;
  const number = typeof value === 'number' ? value : Number(text(value));
  return Number.isFinite(number) ? number : null;
}

function parseItemSpecifics(
  raw: unknown,
  row: number,
  errors: PreEnrichedFebestError[],
): Record<string, unknown> {
  const value = text(raw);
  if (!value) {
    addIssue(errors, 'missing_item_specifics', 'Products', row, 'Item Specifics JSON', 'Item Specifics JSON is required');
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('must be a JSON object');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    addIssue(
      errors,
      'invalid_item_specifics_json',
      'Products',
      row,
      'Item Specifics JSON',
      error instanceof Error ? error.message : 'Invalid JSON object',
    );
    return {};
  }
}

function hasForbiddenHtml(value: string): boolean {
  return /<\s*script\b|<\s*form\b|javascript\s*:|\son[a-z]+\s*=|<\s*iframe\b/i.test(value);
}

function getSpecificValue(specifics: Record<string, unknown>, names: string[]): string {
  for (const name of names) {
    const value = specifics[name];
    if (Array.isArray(value)) {
      const first = value.find((entry) => text(entry));
      if (first != null) return text(first);
    } else if (text(value)) {
      return text(value);
    }
  }
  return '';
}

function manifestValue(manifest: Record<string, string>, key: string): string {
  return manifest[key] ?? manifest[key.toLowerCase()] ?? '';
}

export function parsePreEnrichedFebestWorkbook(
  fileBuffer: Buffer,
): PreEnrichedFebestValidationResult {
  const errors: PreEnrichedFebestError[] = [];
  const warnings: PreEnrichedFebestError[] = [];
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(fileBuffer, { type: 'buffer', cellStyles: true });
  } catch (error) {
    addIssue(
      errors,
      'invalid_workbook',
      'Workbook',
      null,
      null,
      error instanceof Error ? error.message : 'Could not read XLSX workbook',
    );
    return {
      ok: false,
      readyForImport: false,
      manifest: {},
      products: [],
      fitments: [],
      errors,
      warnings,
      summary: {
        productRows: 0,
        fitmentRows: 0,
        acceptedFitmentRows: 0,
        reviewFitmentRows: 0,
        rejectedFitmentRows: 0,
        productsWithPrice: 0,
        productsWithImages: 0,
        productsWithAcceptedFitment: 0,
        duplicateSkus: 0,
        duplicatePartNumbers: 0,
      },
    };
  }

  for (const sheetName of REQUIRED_SHEETS) {
    if (!workbook.Sheets[sheetName]) {
      addIssue(errors, 'missing_sheet', sheetName, null, null, `Missing required sheet ${sheetName}`);
    }
  }

  const manifestRows = readRows(workbook, 'Manifest', PRE_ENRICHED_FEBEST_MANIFEST_HEADERS, errors);
  const productRows = readRows(workbook, 'Products', PRE_ENRICHED_FEBEST_PRODUCT_HEADERS, errors);
  const fitmentRows = readRows(workbook, 'Fitments', PRE_ENRICHED_FEBEST_FITMENT_HEADERS, errors);

  const manifest: Record<string, string> = {};
  for (let index = 0; index < manifestRows.length; index += 1) {
    const rowNumber = index + 2;
    const key = text(manifestRows[index]?.[0]);
    const value = text(manifestRows[index]?.[1]);
    if (!key) {
      addIssue(errors, 'missing_manifest_key', 'Manifest', rowNumber, 'Key', 'Manifest key is required');
      continue;
    }
    if (manifest[key]) {
      addIssue(errors, 'duplicate_manifest_key', 'Manifest', rowNumber, 'Key', `Duplicate manifest key ${key}`);
      continue;
    }
    manifest[key] = value;
  }

  if (manifestValue(manifest, 'SchemaVersion') !== PRE_ENRICHED_FEBEST_SCHEMA_VERSION) {
    addIssue(
      errors,
      'unsupported_schema_version',
      'Manifest',
      null,
      'SchemaVersion',
      `SchemaVersion must be ${PRE_ENRICHED_FEBEST_SCHEMA_VERSION}`,
    );
  }
  if (!manifestValue(manifest, 'Marketplace')) {
    addIssue(errors, 'missing_marketplace', 'Manifest', null, 'Marketplace', 'Manifest Marketplace is required');
  }
  if (!manifestValue(manifest, 'SourceHash')) {
    addIssue(errors, 'missing_source_hash', 'Manifest', null, 'SourceHash', 'Manifest SourceHash is required');
  }
  if (!manifestValue(manifest, 'RunHash')) {
    addIssue(errors, 'missing_run_hash', 'Manifest', null, 'RunHash', 'Manifest RunHash is required');
  }

  const products: PreEnrichedFebestProduct[] = [];
  const productBySku = new Map<string, PreEnrichedFebestProduct>();
  const productByPartNumber = new Map<string, PreEnrichedFebestProduct>();
  let duplicateSkus = 0;
  let duplicatePartNumbers = 0;

  for (let index = 0; index < productRows.length; index += 1) {
    const row = productRows[index] ?? [];
    const rowNumber = index + 2;
    const sku = text(row[0]);
    const partNumber = text(row[1]);
    const brand = text(row[2]);
    const title = text(row[3]);
    const description = text(row[4]);
    const descriptionHtml = text(row[5]);
    const price = parseNumber(row[6]);
    const currency = nullableText(row[7]);
    const quantity = parseNumber(row[8]);
    const conditionId = text(row[9]);
    const categoryId = nullableText(row[10]);
    const imageUrls = text(row[11])
      .split(/[|\r\n]+/)
      .map((url) => url.trim())
      .filter(Boolean);
    const itemSpecifics = parseItemSpecifics(row[12], rowNumber, errors);
    const sourceRecordId = text(row[13]);
    const evidenceHash = text(row[14]);

    if (!sku) addIssue(errors, 'missing_sku', 'Products', rowNumber, 'SKU', 'SKU is required');
    if (!partNumber) addIssue(errors, 'missing_part_number', 'Products', rowNumber, 'Part Number', 'Part Number is required');
    if (brand.toLowerCase() !== 'febest') addIssue(errors, 'invalid_brand', 'Products', rowNumber, 'Brand', 'Brand must be FEBEST');
    if (!title || title.length > 80) addIssue(errors, 'invalid_title', 'Products', rowNumber, 'Title', 'Title is required and must be 80 characters or fewer');
    if (!description) addIssue(errors, 'missing_description', 'Products', rowNumber, 'Description', 'Plain description is required');
    if (!descriptionHtml) addIssue(errors, 'missing_description_html', 'Products', rowNumber, 'Description HTML', 'Description HTML is required');
    if (descriptionHtml && hasForbiddenHtml(descriptionHtml)) addIssue(errors, 'unsafe_html', 'Products', rowNumber, 'Description HTML', 'Description HTML contains a forbidden tag, protocol, or event handler');
    if (price != null && price < 0) addIssue(errors, 'invalid_price', 'Products', rowNumber, 'Price', 'Price must be zero or greater when supplied');
    if (price != null && !currency) addIssue(errors, 'missing_currency', 'Products', rowNumber, 'Currency', 'Currency is required when Price is supplied');
    if (currency && !/^[A-Z]{3}$/.test(currency)) addIssue(errors, 'invalid_currency', 'Products', rowNumber, 'Currency', 'Currency must be a 3-letter uppercase code');
    if (quantity == null || !Number.isInteger(quantity) || quantity < 0) addIssue(errors, 'invalid_quantity', 'Products', rowNumber, 'Quantity', 'Quantity must be an integer greater than or equal to zero');
    if (!ALLOWED_CONDITION_IDS.has(conditionId)) addIssue(errors, 'invalid_condition', 'Products', rowNumber, 'Condition ID', 'Condition ID must be one of 1000, 2500, or 3000');
    if (!categoryId) addIssue(errors, 'missing_category', 'Products', rowNumber, 'Category ID', 'Category ID is required for import readiness');
    if (imageUrls.length === 0) addIssue(errors, 'missing_images', 'Products', rowNumber, 'Image URLs', 'At least one official image URL is required');
    if (!sourceRecordId) addIssue(errors, 'missing_source_record', 'Products', rowNumber, 'Source Record ID', 'Source Record ID is required');
    if (!evidenceHash) addIssue(errors, 'missing_evidence_hash', 'Products', rowNumber, 'Evidence Hash', 'Evidence Hash is required');

    const specificsMpn = getSpecificValue(itemSpecifics, ['Manufacturer Part Number', 'MPN']);
    const specificsBrand = getSpecificValue(itemSpecifics, ['Brand']);
    if (specificsMpn && specificsMpn !== partNumber) addIssue(errors, 'mpn_mismatch', 'Products', rowNumber, 'Item Specifics JSON', 'Item Specifics MPN must exactly equal Part Number, including suffixes');
    if (!specificsMpn) addIssue(errors, 'missing_specific_mpn', 'Products', rowNumber, 'Item Specifics JSON', 'Item Specifics JSON must include Manufacturer Part Number or MPN');
    if (specificsBrand && specificsBrand.toLowerCase() !== 'febest') addIssue(errors, 'specific_brand_mismatch', 'Products', rowNumber, 'Item Specifics JSON', 'Item Specifics Brand must be FEBEST');

    const product: PreEnrichedFebestProduct = {
      rowNumber,
      sku,
      partNumber,
      brand,
      title,
      description,
      descriptionHtml,
      price,
      currency,
      quantity: quantity ?? 0,
      conditionId,
      categoryId,
      imageUrls,
      itemSpecifics,
      sourceRecordId,
      evidenceHash,
    };
    if (sku && productBySku.has(sku)) {
      duplicateSkus += 1;
      addIssue(errors, 'duplicate_sku', 'Products', rowNumber, 'SKU', `Duplicate SKU ${sku}`);
    } else if (sku) {
      productBySku.set(sku, product);
    }
    if (partNumber && productByPartNumber.has(partNumber)) {
      duplicatePartNumbers += 1;
      addIssue(errors, 'duplicate_part_number', 'Products', rowNumber, 'Part Number', `Duplicate Part Number ${partNumber}`);
    } else if (partNumber) {
      productByPartNumber.set(partNumber, product);
    }
    products.push(product);

    if (price == null) {
      addIssue(warnings, 'pricing_missing', 'Products', rowNumber, 'Price', 'Public price is unresolved; this row cannot be import-ready');
    }
  }

  const fitments: PreEnrichedFebestFitment[] = [];
  const fitmentKeys = new Set<string>();
  let acceptedFitmentRows = 0;
  let reviewFitmentRows = 0;
  let rejectedFitmentRows = 0;
  for (let index = 0; index < fitmentRows.length; index += 1) {
    const row = fitmentRows[index] ?? [];
    const rowNumber = index + 2;
    const fitment: PreEnrichedFebestFitment = {
      rowNumber,
      sku: text(row[0]),
      marketplace: text(row[1]),
      year: text(row[2]),
      make: text(row[3]),
      model: text(row[4]),
      trim: nullableText(row[5]),
      engine: nullableText(row[6]),
      submodel: nullableText(row[7]),
      bodyStyle: nullableText(row[8]),
      drivetrain: nullableText(row[9]),
      notes: nullableText(row[10]),
      sourceApplicationId: text(row[11]),
      sourceUrl: text(row[12]),
      validationStatus: text(row[13]).toLowerCase(),
    };
    if (!fitment.sku || !productBySku.has(fitment.sku)) addIssue(errors, 'unknown_fitment_sku', 'Fitments', rowNumber, 'SKU', 'Fitment SKU must reference a Products row');
    if (!fitment.marketplace) addIssue(errors, 'missing_fitment_marketplace', 'Fitments', rowNumber, 'Marketplace', 'Marketplace is required');
    if (!/^\d{4}$/.test(fitment.year) || Number(fitment.year) < 1886 || Number(fitment.year) > 2100) addIssue(errors, 'invalid_fitment_year', 'Fitments', rowNumber, 'Year', 'Year must be a four-digit model year');
    if (!fitment.make) addIssue(errors, 'missing_fitment_make', 'Fitments', rowNumber, 'Make', 'Make is required');
    if (!fitment.model) addIssue(errors, 'missing_fitment_model', 'Fitments', rowNumber, 'Model', 'Model is required');
    if (!fitment.sourceApplicationId) addIssue(errors, 'missing_source_application', 'Fitments', rowNumber, 'Source Application ID', 'Source Application ID is required');
    if (!/^https:\/\/(?:www\.)?(?:catalog\.febest\.eu|febestparts\.com|static\.febest\.de)\//i.test(fitment.sourceUrl)) addIssue(errors, 'invalid_fitment_source', 'Fitments', rowNumber, 'Source URL', 'Source URL must be an official FEBEST catalog page or official image host');
    if (!ALLOWED_VALIDATION_STATUSES.has(fitment.validationStatus)) addIssue(errors, 'invalid_fitment_status', 'Fitments', rowNumber, 'Validation Status', 'Validation Status must be accepted, needs_review, or rejected');

    const key = [fitment.sku, fitment.marketplace, fitment.year, fitment.make, fitment.model, fitment.trim ?? '', fitment.engine ?? '', fitment.submodel ?? '', fitment.bodyStyle ?? '', fitment.drivetrain ?? '', fitment.notes ?? ''].join('\u001f').toLowerCase();
    if (fitmentKeys.has(key)) addIssue(errors, 'duplicate_fitment', 'Fitments', rowNumber, null, 'Duplicate fitment row');
    else fitmentKeys.add(key);
    if (fitment.validationStatus === 'accepted') acceptedFitmentRows += 1;
    else if (fitment.validationStatus === 'rejected') rejectedFitmentRows += 1;
    else reviewFitmentRows += 1;
    fitments.push(fitment);
  }

  const productsWithAcceptedFitment = new Set(
    fitments.filter((fitment) => fitment.validationStatus === 'accepted').map((fitment) => fitment.sku),
  ).size;
  const qualityStatus = manifestValue(manifest, 'QualityStatus').toUpperCase();
  const productsWithPrice = products.filter((product) => product.price != null && !!product.currency).length;
  const productsWithImages = products.filter((product) => product.imageUrls.length > 0).length;
  const readyForImport =
    errors.length === 0 &&
    qualityStatus === 'READY' &&
    products.length > 0 &&
    productsWithPrice === products.length &&
    productsWithImages === products.length &&
    productsWithAcceptedFitment > 0 &&
    rejectedFitmentRows === 0 &&
    reviewFitmentRows === 0;

  if (qualityStatus !== 'READY') addIssue(warnings, 'quality_not_ready', 'Manifest', null, 'QualityStatus', 'Manifest QualityStatus is not READY');
  if (reviewFitmentRows > 0) addIssue(warnings, 'fitment_needs_review', 'Fitments', null, 'Validation Status', `${reviewFitmentRows} fitment row(s) are needs_review`);
  if (rejectedFitmentRows > 0) addIssue(warnings, 'fitment_rejected', 'Fitments', null, 'Validation Status', `${rejectedFitmentRows} fitment row(s) are rejected and will not be imported`);

  return {
    ok: errors.length === 0,
    readyForImport,
    manifest,
    products,
    fitments,
    errors,
    warnings,
    summary: {
      productRows: products.length,
      fitmentRows: fitments.length,
      acceptedFitmentRows,
      reviewFitmentRows,
      rejectedFitmentRows,
      productsWithPrice,
      productsWithImages,
      productsWithAcceptedFitment,
      duplicateSkus,
      duplicatePartNumbers,
    },
  };
}
