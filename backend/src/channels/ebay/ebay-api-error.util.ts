interface EbayErrorRow {
  message?: string;
  longMessage?: string;
  errorId?: number | string;
  domain?: string;
  category?: string;
  parameters?: Array<{ name?: string; value?: string }>;
}

/** Flatten eBay REST error payloads into a single user-facing message. */
export function formatEbayApiError(
  err: unknown,
  fallback = 'eBay API request failed',
): string {
  if (typeof err === 'string') {
    return err.trim() || fallback;
  }
  if (!err || typeof err !== 'object') {
    return fallback;
  }

  const axiosData = (err as { response?: { data?: unknown } }).response?.data;
  const candidates: unknown[] = [axiosData, err];

  const parts: string[] = [];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const data = candidate as {
      message?: string;
      errors?: EbayErrorRow[];
    };

    if (data.message?.trim() && !parts.includes(data.message.trim())) {
      parts.push(data.message.trim());
    }

    if (Array.isArray(data.errors)) {
      for (const e of data.errors) {
        const msg = e.longMessage?.trim() || e.message?.trim();
        if (msg && !parts.includes(msg)) {
          parts.push(msg);
        }
        if (Array.isArray(e.parameters)) {
          for (const p of e.parameters) {
            const name = p.name?.trim();
            const value = p.value?.trim();
            if (name && value) {
              const line = `${name}: ${value}`;
              if (!parts.includes(line)) parts.push(line);
            }
          }
        }
        if (e.errorId != null && msg) {
          const idLine = `[${e.errorId}] ${msg}`;
          if (!parts.includes(idLine) && !parts.includes(msg)) {
            // prefer message without duplicate id prefix
          }
        }
      }
    }
  }

  if (!parts.length) {
    const message = (err as { message?: unknown }).message;
    return typeof message === 'string' && message.trim()
      ? message.trim()
      : fallback;
  }

  // Drop generic wrapper when specific errors exist
  const generic =
    'The request has errors. For help, see the documentation for this API.';
  const specific = parts.filter((p) => p !== generic);
  return specific.length ? specific.join('; ') : parts.join('; ');
}

/** True when eBay blocks inventory from a country different from the seller address. */
export function isEbayOverseasWarehouseBlockError(err: unknown): boolean {
  const formatted = formatEbayApiError(err, '').toLowerCase();
  if (!formatted) return false;
  return [
    'srm_his_wh_location_mismatch_inventory_block',
    '1276646',
    'forward-deployed item',
    'forward deployed item',
    'overseas warehouse block policy',
    'overseas-warehouse-block-policy-authorization',
    'different from your registered address',
    'shipping from overseas warehouses',
    'ship from overseas warehouses',
  ].some((marker) => formatted.includes(marker));
}

/** Return an actionable message for eBay's permanent warehouse-location block. */
export function formatEbayOverseasWarehouseBlockError(
  err: unknown,
  context: { storeName?: string; merchantLocationKey?: string } = {},
): string | null {
  if (!isEbayOverseasWarehouseBlockError(err)) return null;
  const storeName = context.storeName?.trim();
  const locationKey = context.merchantLocationKey?.trim();
  const storePart = storeName ? ' for store ' + storeName : '';
  const locationPart = locationKey ? ' at location ' + locationKey : '';
  return (
    'eBay blocked this operation' +
    storePart +
    ' because inventory location' +
    locationPart +
    ' is in a different country than the seller registered eBay address (Overseas Warehouse Block Policy). ' +
    'Set the merchant location to a real enabled location in the registered country, or request eBay authorization for forward-deployed inventory at whappeals@ebay.com, then retry. ' +
    'This is a permanent account/location policy block (eBay reference 1276646).'
  );
}
/** True when eBay rejected the OAuth user token (errorId 1001 / HTTP 401). */
export function isEbayInvalidAccessTokenError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;

  const status =
    (err as { status?: number }).status ??
    (err as { response?: { status?: number } }).response?.status;
  if (status === 401) return true;

  const formatted = formatEbayApiError(err, '');
  if (/invalid access token/i.test(formatted)) return true;

  const bodies: unknown[] = [
    (err as { response?: { data?: unknown } }).response?.data,
    err,
  ];
  for (const body of bodies) {
    if (!body || typeof body !== 'object') continue;
    const errors = (body as { errors?: EbayErrorRow[] }).errors;
    if (!Array.isArray(errors)) continue;
    for (const e of errors) {
      if (String(e.errorId) === '1001') return true;
      const msg = e.longMessage ?? e.message ?? '';
      if (/invalid access token/i.test(msg)) return true;
    }
  }

  return false;
}

/** Extract a named parameter value from an eBay REST error payload. */
export function extractEbayErrorParameter(
  err: unknown,
  paramName: string,
): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const bodies: unknown[] = [
    (err as { response?: { data?: unknown } }).response?.data,
    err,
  ];
  for (const body of bodies) {
    if (!body || typeof body !== 'object') continue;
    const errors = (body as { errors?: EbayErrorRow[] }).errors;
    if (!Array.isArray(errors)) continue;
    for (const e of errors) {
      if (!Array.isArray(e.parameters)) continue;
      for (const p of e.parameters) {
        if (p.name?.trim() === paramName && p.value?.trim()) {
          return p.value.trim();
        }
      }
    }
  }
  return undefined;
}

/** True when createOffer failed because an unpublished offer already exists (errorId 25002). */
export function isEbayOfferAlreadyExistsError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const bodies: unknown[] = [
    (err as { response?: { data?: unknown } }).response?.data,
    err,
  ];
  for (const body of bodies) {
    if (!body || typeof body !== 'object') continue;
    const errors = (body as { errors?: EbayErrorRow[] }).errors;
    if (!Array.isArray(errors)) continue;
    for (const e of errors) {
      if (String(e.errorId) === '25002') return true;
      const msg = e.longMessage ?? e.message ?? '';
      if (/offer entity already exists/i.test(msg)) return true;
    }
  }
  return /offer entity already exists/i.test(formatEbayApiError(err, ''));
}

/** True when eBay returned an offer id that no longer resolves (errorId 25713). */
export function isEbayOfferUnavailableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const bodies: unknown[] = [
    (err as { response?: { data?: unknown } }).response?.data,
    err,
  ];
  for (const body of bodies) {
    if (!body || typeof body !== 'object') continue;
    const errors = (body as { errors?: EbayErrorRow[] }).errors;
    if (!Array.isArray(errors)) continue;
    for (const e of errors) {
      if (String(e.errorId) === '25713') return true;
      const msg = e.longMessage ?? e.message ?? '';
      if (/this offer is not available/i.test(msg)) return true;
    }
  }
  return /this offer is not available/i.test(formatEbayApiError(err, ''));
}

/** True when eBay blocks a new offer because an identical active listing exists (errorId 25002). */
export function isEbayDuplicateActiveListingError(err: unknown): boolean {
  const formatted = formatEbayApiError(err, '');
  return (
    /already have on eBay/i.test(formatted) ||
    /identical items from the same seller/i.test(formatted) ||
    /don't allow listings for identical items/i.test(formatted)
  );
}

/** True when publish failed due to invalid item condition for the category (errorId 25021). */
export function isEbayInvalidItemConditionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const bodies: unknown[] = [
    (err as { response?: { data?: unknown } }).response?.data,
    err,
  ];
  for (const body of bodies) {
    if (!body || typeof body !== 'object') continue;
    const errors = (body as { errors?: EbayErrorRow[] }).errors;
    if (!Array.isArray(errors)) continue;
    for (const e of errors) {
      if (String(e.errorId) === '25021') return true;
      const msg = e.longMessage ?? e.message ?? '';
      if (/invalid item condition/i.test(msg)) return true;
      if (/condition id is invalid/i.test(msg)) return true;
    }
  }
  const formatted = formatEbayApiError(err, '');
  return (
    /invalid item condition/i.test(formatted) ||
    /condition id is invalid/i.test(formatted)
  );
}

/** True when eBay rejected fulfillment/payment/return policy ids on an offer publish. */
export function isEbayInvalidBusinessPolicyError(err: unknown): boolean {
  const formatted = formatEbayApiError(err, '');
  if (!formatted) return false;
  if (
    /invalid.*fulfillment policy/i.test(formatted) ||
    /invalid.*shipping policy/i.test(formatted) ||
    /invalid.*payment policy/i.test(formatted) ||
    /invalid.*return policy/i.test(formatted) ||
    /Fulfillment policy/i.test(formatted) ||
    /Rücknahmebedingungen.*ungültig/i.test(formatted) ||
    /Versandbedingungen.*ungültig/i.test(formatted) ||
    /Zahlungsbedingungen.*ungültig/i.test(formatted)
  )
    return true;

  if (!err || typeof err !== 'object') return false;
  const bodies: unknown[] = [
    (err as { response?: { data?: unknown } }).response?.data,
    err,
  ];
  for (const body of bodies) {
    if (!body || typeof body !== 'object') continue;
    const errors = (body as { errors?: EbayErrorRow[] }).errors;
    if (!Array.isArray(errors)) continue;
    for (const e of errors) {
      if (String(e.errorId) === '25009') return true;
    }
  }
  return false;
}

/** True when eBay blocked publish for Parts & Accessories return-policy compliance. */
export function isEbayPartsAccessoriesReturnPolicyError(err: unknown): boolean {
  const formatted = formatEbayApiError(err, '');
  if (!formatted) return false;
  return (
    /non-compliant domestic return policy/i.test(formatted) ||
    /parts.accessories return policy/i.test(formatted) ||
    /minimum return period of 30/i.test(formatted) ||
    /return window to 30-days/i.test(formatted) ||
    /ShippingCostPaidByOption/i.test(formatted)
  );
}

/** True when eBay rejected the request due to seller selling limits (errorId 21919024 / 21919023 / 21919144). */
export function isEbaySellingLimitError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const bodies: unknown[] = [
    (err as { response?: { data?: unknown } }).response?.data,
    err,
  ];
  for (const body of bodies) {
    if (!body || typeof body !== 'object') continue;
    const errors = (body as { errors?: EbayErrorRow[] }).errors;
    if (!Array.isArray(errors)) continue;
    for (const e of errors) {
      const id = String(e.errorId);
      if (id === '21919024' || id === '21919023' || id === '21919144')
        return true;
      const msg = e.longMessage ?? e.message ?? '';
      if (/selling limit/i.test(msg)) return true;
      if (/Höchstbetrag/i.test(msg)) return true;
      if (/active listings allowed/i.test(msg)) return true;
    }
  }
  const formatted = formatEbayApiError(err, '');
  return (
    /selling limit/i.test(formatted) ||
    /Höchstbetrag/i.test(formatted) ||
    /active listings allowed/i.test(formatted)
  );
}

/** True when an offer update/publish failed because the existing eBay offer has an invalid or stale category (errorId 25005). */
export function isEbayInvalidCategoryError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const bodies: unknown[] = [
    (err as { response?: { data?: unknown } }).response?.data,
    err,
  ];
  for (const body of bodies) {
    if (!body || typeof body !== 'object') continue;
    const errors = (body as { errors?: EbayErrorRow[] }).errors;
    if (!Array.isArray(errors)) continue;
    for (const e of errors) {
      if (String(e.errorId) === '25005') return true;
      const msg = e.longMessage ?? e.message ?? '';
      if (/invalid categor/i.test(msg)) return true;
    }
  }
  const formatted = formatEbayApiError(err, '');
  return /invalid categor/i.test(formatted);
}

/** True when publish failed because eBay considers all compatibilities invalid (errorId 25002 with compatibility message). */
export function isEbayInvalidCompatibilitiesError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const bodies: unknown[] = [
    (err as { response?: { data?: unknown } }).response?.data,
    err,
  ];
  for (const body of bodies) {
    if (!body || typeof body !== 'object') continue;
    const errors = (body as { errors?: EbayErrorRow[] }).errors;
    if (!Array.isArray(errors)) continue;
    for (const e of errors) {
      if (String(e.errorId) !== '25002') continue;
      const msg = e.longMessage ?? e.message ?? '';
      if (/compatibilit/i.test(msg)) return true;
    }
  }
  const formatted = formatEbayApiError(err, '');
  return /compatibilit/i.test(formatted) && /invalid/i.test(formatted);
}

/** Policy errors where refresh or alternate policy selection may recover publish. */
export function isEbayRecoverableBusinessPolicyError(err: unknown): boolean {
  return (
    isEbayInvalidBusinessPolicyError(err) ||
    isEbayPartsAccessoriesReturnPolicyError(err)
  );
}

/**
 * True when publish failed because eBay's backend hasn't yet indexed a just-
 * written inventory item title (errorId 25016). Only seen when an offer
 * already existed and was updated immediately before publishing — a fresh
 * offer + publish (no prior existing offer) doesn't hit this. The title is
 * correct in both our DB and the inventory item we just upserted; this is a
 * read-after-write propagation lag on eBay's side, not a real data problem —
 * a short-delay retry resolves it.
 */
export function isEbayTitleMissingTransientError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const bodies: unknown[] = [
    (err as { response?: { data?: unknown } }).response?.data,
    err,
  ];
  for (const body of bodies) {
    if (!body || typeof body !== 'object') continue;
    const errors = (body as { errors?: EbayErrorRow[] }).errors;
    if (!Array.isArray(errors)) continue;
    for (const e of errors) {
      if (String(e.errorId) === '25016') return true;
      const msg = e.longMessage ?? e.message ?? '';
      if (/seller provided title value is missing/i.test(msg)) return true;
    }
  }
  const formatted = formatEbayApiError(err, '');
  return /seller provided title value is missing/i.test(formatted);
}

/**
 * True when eBay has accepted a just-written inventory item but has not yet
 * made its availability visible to the publish validator (error 25604).
 * Treat this as a short read-after-write propagation delay; callers must still
 * cap retries and verify the final published projection.
 */
export function isEbayAvailabilityMissingTransientError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const bodies: unknown[] = [
    (err as { response?: { data?: unknown } }).response?.data,
    err,
  ];
  for (const body of bodies) {
    if (!body || typeof body !== 'object') continue;
    const errors = (body as { errors?: EbayErrorRow[] }).errors;
    if (!Array.isArray(errors)) continue;
    for (const e of errors) {
      if (String(e.errorId) === '25604') return true;
      const msg = e.longMessage ?? e.message ?? '';
      if (/availability not found/i.test(msg)) return true;
    }
  }
  const formatted = formatEbayApiError(err, '');
  return /availability not found/i.test(formatted);
}
