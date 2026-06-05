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
    return typeof message === 'string' && message.trim() ? message.trim() : fallback;
  }

  // Drop generic wrapper when specific errors exist
  const generic = 'The request has errors. For help, see the documentation for this API.';
  const specific = parts.filter((p) => p !== generic);
  return specific.length ? specific.join('; ') : parts.join('; ');
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
  return (
    /invalid.*fulfillment policy/i.test(formatted) ||
    /invalid.*shipping policy/i.test(formatted) ||
    /invalid.*payment policy/i.test(formatted) ||
    /invalid.*return policy/i.test(formatted) ||
    /Fulfillment policy/i.test(formatted)
  );
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

/** Policy errors where refresh or alternate policy selection may recover publish. */
export function isEbayRecoverableBusinessPolicyError(err: unknown): boolean {
  return (
    isEbayInvalidBusinessPolicyError(err) ||
    isEbayPartsAccessoriesReturnPolicyError(err)
  );
}
