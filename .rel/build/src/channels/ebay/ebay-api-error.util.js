"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatEbayApiError = formatEbayApiError;
exports.isEbayOverseasWarehouseBlockError = isEbayOverseasWarehouseBlockError;
exports.formatEbayOverseasWarehouseBlockError = formatEbayOverseasWarehouseBlockError;
exports.isEbayInvalidAccessTokenError = isEbayInvalidAccessTokenError;
exports.extractEbayErrorParameter = extractEbayErrorParameter;
exports.isEbayOfferAlreadyExistsError = isEbayOfferAlreadyExistsError;
exports.isEbayOfferUnavailableError = isEbayOfferUnavailableError;
exports.isEbayDuplicateActiveListingError = isEbayDuplicateActiveListingError;
exports.isEbayInvalidItemConditionError = isEbayInvalidItemConditionError;
exports.isEbayInvalidBusinessPolicyError = isEbayInvalidBusinessPolicyError;
exports.isEbayPartsAccessoriesReturnPolicyError = isEbayPartsAccessoriesReturnPolicyError;
exports.isEbaySellingLimitError = isEbaySellingLimitError;
exports.isEbayInvalidCategoryError = isEbayInvalidCategoryError;
exports.isEbayInvalidCompatibilitiesError = isEbayInvalidCompatibilitiesError;
exports.isEbayRecoverableBusinessPolicyError = isEbayRecoverableBusinessPolicyError;
exports.isEbayTitleMissingTransientError = isEbayTitleMissingTransientError;
exports.isEbayAvailabilityMissingTransientError = isEbayAvailabilityMissingTransientError;
function formatEbayApiError(err, fallback = 'eBay API request failed') {
    if (typeof err === 'string') {
        return err.trim() || fallback;
    }
    if (!err || typeof err !== 'object') {
        return fallback;
    }
    const axiosData = err.response?.data;
    const candidates = [axiosData, err];
    const parts = [];
    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'object')
            continue;
        const data = candidate;
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
                            if (!parts.includes(line))
                                parts.push(line);
                        }
                    }
                }
                if (e.errorId != null && msg) {
                    const idLine = `[${e.errorId}] ${msg}`;
                    if (!parts.includes(idLine) && !parts.includes(msg)) {
                    }
                }
            }
        }
    }
    if (!parts.length) {
        const message = err.message;
        return typeof message === 'string' && message.trim()
            ? message.trim()
            : fallback;
    }
    const generic = 'The request has errors. For help, see the documentation for this API.';
    const specific = parts.filter((p) => p !== generic);
    return specific.length ? specific.join('; ') : parts.join('; ');
}
function isEbayOverseasWarehouseBlockError(err) {
    const formatted = formatEbayApiError(err, '').toLowerCase();
    if (!formatted)
        return false;
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
function formatEbayOverseasWarehouseBlockError(err, context = {}) {
    if (!isEbayOverseasWarehouseBlockError(err))
        return null;
    const storeName = context.storeName?.trim();
    const locationKey = context.merchantLocationKey?.trim();
    const storePart = storeName ? ' for store ' + storeName : '';
    const locationPart = locationKey ? ' at location ' + locationKey : '';
    return ('eBay blocked this operation' +
        storePart +
        ' because inventory location' +
        locationPart +
        ' is in a different country than the seller registered eBay address (Overseas Warehouse Block Policy). ' +
        'Set the merchant location to a real enabled location in the registered country, or request eBay authorization for forward-deployed inventory at whappeals@ebay.com, then retry. ' +
        'This is a permanent account/location policy block (eBay reference 1276646).');
}
function isEbayInvalidAccessTokenError(err) {
    if (!err || typeof err !== 'object')
        return false;
    const status = err.status ??
        err.response?.status;
    if (status === 401)
        return true;
    const formatted = formatEbayApiError(err, '');
    if (/invalid access token/i.test(formatted))
        return true;
    const bodies = [
        err.response?.data,
        err,
    ];
    for (const body of bodies) {
        if (!body || typeof body !== 'object')
            continue;
        const errors = body.errors;
        if (!Array.isArray(errors))
            continue;
        for (const e of errors) {
            if (String(e.errorId) === '1001')
                return true;
            const msg = e.longMessage ?? e.message ?? '';
            if (/invalid access token/i.test(msg))
                return true;
        }
    }
    return false;
}
function extractEbayErrorParameter(err, paramName) {
    if (!err || typeof err !== 'object')
        return undefined;
    const bodies = [
        err.response?.data,
        err,
    ];
    for (const body of bodies) {
        if (!body || typeof body !== 'object')
            continue;
        const errors = body.errors;
        if (!Array.isArray(errors))
            continue;
        for (const e of errors) {
            if (!Array.isArray(e.parameters))
                continue;
            for (const p of e.parameters) {
                if (p.name?.trim() === paramName && p.value?.trim()) {
                    return p.value.trim();
                }
            }
        }
    }
    return undefined;
}
function isEbayOfferAlreadyExistsError(err) {
    if (!err || typeof err !== 'object')
        return false;
    const bodies = [
        err.response?.data,
        err,
    ];
    for (const body of bodies) {
        if (!body || typeof body !== 'object')
            continue;
        const errors = body.errors;
        if (!Array.isArray(errors))
            continue;
        for (const e of errors) {
            if (String(e.errorId) === '25002')
                return true;
            const msg = e.longMessage ?? e.message ?? '';
            if (/offer entity already exists/i.test(msg))
                return true;
        }
    }
    return /offer entity already exists/i.test(formatEbayApiError(err, ''));
}
function isEbayOfferUnavailableError(err) {
    if (!err || typeof err !== 'object')
        return false;
    const bodies = [
        err.response?.data,
        err,
    ];
    for (const body of bodies) {
        if (!body || typeof body !== 'object')
            continue;
        const errors = body.errors;
        if (!Array.isArray(errors))
            continue;
        for (const e of errors) {
            if (String(e.errorId) === '25713')
                return true;
            const msg = e.longMessage ?? e.message ?? '';
            if (/this offer is not available/i.test(msg))
                return true;
        }
    }
    return /this offer is not available/i.test(formatEbayApiError(err, ''));
}
function isEbayDuplicateActiveListingError(err) {
    const formatted = formatEbayApiError(err, '');
    return (/already have on eBay/i.test(formatted) ||
        /identical items from the same seller/i.test(formatted) ||
        /don't allow listings for identical items/i.test(formatted));
}
function isEbayInvalidItemConditionError(err) {
    if (!err || typeof err !== 'object')
        return false;
    const bodies = [
        err.response?.data,
        err,
    ];
    for (const body of bodies) {
        if (!body || typeof body !== 'object')
            continue;
        const errors = body.errors;
        if (!Array.isArray(errors))
            continue;
        for (const e of errors) {
            if (String(e.errorId) === '25021')
                return true;
            const msg = e.longMessage ?? e.message ?? '';
            if (/invalid item condition/i.test(msg))
                return true;
            if (/condition id is invalid/i.test(msg))
                return true;
        }
    }
    const formatted = formatEbayApiError(err, '');
    return (/invalid item condition/i.test(formatted) ||
        /condition id is invalid/i.test(formatted));
}
function isEbayInvalidBusinessPolicyError(err) {
    const formatted = formatEbayApiError(err, '');
    if (!formatted)
        return false;
    if (/invalid.*fulfillment policy/i.test(formatted) ||
        /invalid.*shipping policy/i.test(formatted) ||
        /invalid.*payment policy/i.test(formatted) ||
        /invalid.*return policy/i.test(formatted) ||
        /Fulfillment policy/i.test(formatted) ||
        /Rücknahmebedingungen.*ungültig/i.test(formatted) ||
        /Versandbedingungen.*ungültig/i.test(formatted) ||
        /Zahlungsbedingungen.*ungültig/i.test(formatted))
        return true;
    if (!err || typeof err !== 'object')
        return false;
    const bodies = [
        err.response?.data,
        err,
    ];
    for (const body of bodies) {
        if (!body || typeof body !== 'object')
            continue;
        const errors = body.errors;
        if (!Array.isArray(errors))
            continue;
        for (const e of errors) {
            if (String(e.errorId) === '25009')
                return true;
        }
    }
    return false;
}
function isEbayPartsAccessoriesReturnPolicyError(err) {
    const formatted = formatEbayApiError(err, '');
    if (!formatted)
        return false;
    return (/non-compliant domestic return policy/i.test(formatted) ||
        /parts.accessories return policy/i.test(formatted) ||
        /minimum return period of 30/i.test(formatted) ||
        /return window to 30-days/i.test(formatted) ||
        /ShippingCostPaidByOption/i.test(formatted));
}
function isEbaySellingLimitError(err) {
    if (!err || typeof err !== 'object')
        return false;
    const bodies = [
        err.response?.data,
        err,
    ];
    for (const body of bodies) {
        if (!body || typeof body !== 'object')
            continue;
        const errors = body.errors;
        if (!Array.isArray(errors))
            continue;
        for (const e of errors) {
            const id = String(e.errorId);
            if (id === '21919024' || id === '21919023' || id === '21919144')
                return true;
            const msg = e.longMessage ?? e.message ?? '';
            if (/selling limit/i.test(msg))
                return true;
            if (/Höchstbetrag/i.test(msg))
                return true;
            if (/active listings allowed/i.test(msg))
                return true;
        }
    }
    const formatted = formatEbayApiError(err, '');
    return (/selling limit/i.test(formatted) ||
        /Höchstbetrag/i.test(formatted) ||
        /active listings allowed/i.test(formatted));
}
function isEbayInvalidCategoryError(err) {
    if (!err || typeof err !== 'object')
        return false;
    const bodies = [
        err.response?.data,
        err,
    ];
    for (const body of bodies) {
        if (!body || typeof body !== 'object')
            continue;
        const errors = body.errors;
        if (!Array.isArray(errors))
            continue;
        for (const e of errors) {
            if (String(e.errorId) === '25005')
                return true;
            const msg = e.longMessage ?? e.message ?? '';
            if (/invalid categor/i.test(msg))
                return true;
        }
    }
    const formatted = formatEbayApiError(err, '');
    return /invalid categor/i.test(formatted);
}
function isEbayInvalidCompatibilitiesError(err) {
    if (!err || typeof err !== 'object')
        return false;
    const bodies = [
        err.response?.data,
        err,
    ];
    for (const body of bodies) {
        if (!body || typeof body !== 'object')
            continue;
        const errors = body.errors;
        if (!Array.isArray(errors))
            continue;
        for (const e of errors) {
            if (String(e.errorId) !== '25002')
                continue;
            const msg = e.longMessage ?? e.message ?? '';
            if (/compatibilit/i.test(msg))
                return true;
        }
    }
    const formatted = formatEbayApiError(err, '');
    return /compatibilit/i.test(formatted) && /invalid/i.test(formatted);
}
function isEbayRecoverableBusinessPolicyError(err) {
    return (isEbayInvalidBusinessPolicyError(err) ||
        isEbayPartsAccessoriesReturnPolicyError(err));
}
function isEbayTitleMissingTransientError(err) {
    if (!err || typeof err !== 'object')
        return false;
    const bodies = [
        err.response?.data,
        err,
    ];
    for (const body of bodies) {
        if (!body || typeof body !== 'object')
            continue;
        const errors = body.errors;
        if (!Array.isArray(errors))
            continue;
        for (const e of errors) {
            if (String(e.errorId) === '25016')
                return true;
            const msg = e.longMessage ?? e.message ?? '';
            if (/seller provided title value is missing/i.test(msg))
                return true;
        }
    }
    const formatted = formatEbayApiError(err, '');
    return /seller provided title value is missing/i.test(formatted);
}
function isEbayAvailabilityMissingTransientError(err) {
    if (!err || typeof err !== 'object')
        return false;
    const bodies = [
        err.response?.data,
        err,
    ];
    for (const body of bodies) {
        if (!body || typeof body !== 'object')
            continue;
        const errors = body.errors;
        if (!Array.isArray(errors))
            continue;
        for (const e of errors) {
            if (String(e.errorId) === '25604')
                return true;
            const msg = e.longMessage ?? e.message ?? '';
            if (/availability not found/i.test(msg))
                return true;
        }
    }
    const formatted = formatEbayApiError(err, '');
    return /availability not found/i.test(formatted);
}
//# sourceMappingURL=ebay-api-error.util.js.map