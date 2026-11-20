"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_SKU_LENGTH = exports.MAX_TARGETS_PER_SKU = exports.CROSS_STORE_SALE_SYNC_QUEUE = exports.CROSS_STORE_SALE_SYNC_FLAG = void 0;
exports.normalizeSku = normalizeSku;
exports.rejectSku = rejectSku;
exports.planTarget = planTarget;
exports.tradingAvailable = tradingAvailable;
exports.isLiveTradingStatus = isLiveTradingStatus;
exports.isListingNotFoundError = isListingNotFoundError;
exports.samePartVerdict = samePartVerdict;
exports.isSamePart = isSamePart;
exports.CROSS_STORE_SALE_SYNC_FLAG = 'ebay_cross_store_sale_sync';
exports.CROSS_STORE_SALE_SYNC_QUEUE = 'ebay-cross-store-sale-sync';
exports.MAX_TARGETS_PER_SKU = 40;
exports.MIN_SKU_LENGTH = 3;
function normalizeSku(sku) {
    const trimmed = (sku ?? '').trim();
    return trimmed ? trimmed : null;
}
function rejectSku(sku) {
    if (!sku)
        return 'no_sku';
    if (sku.length < exports.MIN_SKU_LENGTH)
        return 'sku_too_short';
    return null;
}
function planTarget(available, soldQty) {
    const avail = Math.max(0, Math.trunc(Number.isFinite(available) ? available : 0));
    const sold = Math.max(1, Math.trunc(Number.isFinite(soldQty) ? soldQty : 1));
    if (avail <= 0)
        return { action: 'none', reason: 'already_zero', available: avail };
    const remaining = avail - sold;
    if (remaining <= 0)
        return { action: 'end', available: avail, remaining: 0 };
    return { action: 'set_quantity', available: avail, remaining };
}
function tradingAvailable(quantity, quantitySold) {
    return Math.max(0, (quantity ?? 0) - (quantitySold ?? 0));
}
function isLiveTradingStatus(status) {
    return (status ?? 'Active').toLowerCase() === 'active';
}
function isListingNotFoundError(message) {
    return /listing has been deleted|you are not the seller/i.test(message ?? '');
}
const HTML_ENTITIES = {
    amp: '&',
    apos: "'",
    quot: '"',
    lt: '<',
    gt: '>',
    nbsp: ' ',
};
const GENERIC_WORDS = new Set(('the and for with without from used new oem genuine original part parts assembly assy ' +
    'front rear left right upper lower inner outer driver passenger side pair set kit ' +
    'mens men women womens woman man unisex size sizes regular fit condition excellent euc nwt ' +
    'black white blue red green grey gray navy brown beige pink purple yellow orange silver ' +
    'long short sleeve new des der die das und mit fur von pour homme femme avec taille ' +
    'para hombre mujer con talla per uomo donna gebraucht usato usado occasion herren damen').split(/\s+/));
const CAR_MAKES = new Set(('acura alfa audi bentley bmw buick cadillac chevrolet chevy chrysler citroen dacia dodge ' +
    'ferrari fiat ford genesis gmc holden honda hummer hyundai infiniti isuzu jaguar jeep kia ' +
    'lamborghini lancia lexus lincoln lotus maserati mazda mclaren mercedes mercury mini ' +
    'mitsubishi nissan opel peugeot pontiac porsche ram renault rover saab saturn scion seat ' +
    'skoda smart subaru suzuki tesla toyota vauxhall volkswagen volvo vw').split(/\s+/));
const SIZE_WORDS = new Set([
    'xxs',
    'xs',
    's',
    'm',
    'l',
    'xl',
    'xxl',
    'xxxl',
    '2xl',
    '3xl',
    '4xl',
    '5xl',
    'small',
    'medium',
    'large',
]);
const SIZE_ALIASES = {
    small: 's',
    medium: 'm',
    large: 'l',
};
function decodeEntities(text) {
    return text.replace(/&(#\d+|[a-z]+);/gi, (m, name) => {
        if (name.startsWith('#'))
            return String.fromCharCode(Number(name.slice(1)));
        return HTML_ENTITIES[name.toLowerCase()] ?? m;
    });
}
function rawTokens(title) {
    return decodeEntities(title ?? '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/'s\b/g, '')
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
}
function isPartNumber(t) {
    return ((t.length >= 7 && /\d/.test(t) && /[a-z]/.test(t)) ||
        (t.length >= 6 && /^\d+$/.test(t)));
}
function isYearLike(t) {
    return /^(19|20)\d\d$/.test(t);
}
function distinctiveWords(tokens) {
    return new Set(tokens.filter((t) => !GENERIC_WORDS.has(t) &&
        !isYearLike(t) &&
        !SIZE_WORDS.has(t) &&
        (t.length >= 3 || (t.length === 2 && /\d/.test(t) && /[a-z]/.test(t)))));
}
const SIZE_LABELS = new Set([
    'size',
    'taille',
    'talla',
    'taglia',
    'grosse',
    'gr',
    'tamano',
]);
function sizes(title) {
    const words = decodeEntities(title ?? '')
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean);
    const out = new Set();
    words.forEach((w, i) => {
        const t = w.toLowerCase();
        if (!SIZE_WORDS.has(t))
            return;
        if (t.length === 1 &&
            w !== w.toUpperCase() &&
            i !== words.length - 1 &&
            !SIZE_LABELS.has((words[i - 1] ?? '').toLowerCase())) {
            return;
        }
        out.add(SIZE_ALIASES[t] ?? t);
    });
    return out;
}
function intersects(a, b) {
    for (const x of a)
        if (b.has(x))
            return true;
    return false;
}
function samePartVerdict(soldTitle, otherTitle) {
    const a = rawTokens(soldTitle);
    const b = rawTokens(otherTitle);
    if (!a.length || !b.length)
        return 'no_title';
    const pnA = a.filter(isPartNumber);
    const pnB = b.filter(isPartNumber);
    const samePn = (x, y) => x.startsWith(y) || y.startsWith(x);
    if (pnA.some((x) => pnB.some((y) => samePn(x, y))))
        return 'part_number';
    if (pnA.length && pnB.length)
        return 'different_part_number';
    const makesA = new Set(a.filter((t) => CAR_MAKES.has(t)));
    const makesB = new Set(b.filter((t) => CAR_MAKES.has(t)));
    if (makesA.size && makesB.size && !intersects(makesA, makesB))
        return 'different_make';
    const sizeA = sizes(soldTitle);
    const sizeB = sizes(otherTitle);
    if (sizeA.size && sizeB.size && !intersects(sizeA, sizeB))
        return 'different_size';
    const setA = new Set(a.filter((t) => t.length >= 2));
    const setB = new Set(b.filter((t) => t.length >= 2));
    let shared = 0;
    for (const t of setA)
        if (setB.has(t))
            shared++;
    const union = setA.size + setB.size - shared;
    if (union > 0 && shared / union >= 0.5)
        return 'similar_title';
    const wordsA = distinctiveWords(a);
    const wordsB = distinctiveWords(b);
    let sharedWords = 0;
    for (const t of wordsA)
        if (wordsB.has(t))
            sharedWords++;
    if (intersects(sizeA, sizeB))
        sharedWords++;
    if (sharedWords >= 2)
        return 'shared_words';
    return 'unrelated_title';
}
function isSamePart(verdict) {
    return ['part_number', 'similar_title', 'shared_words', 'no_title'].includes(verdict);
}
//# sourceMappingURL=cross-store-sale-sync.util.js.map