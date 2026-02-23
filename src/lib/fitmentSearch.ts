import type {
    ProductCatalogItem,
    SearchQuery,
    SearchResult,
} from '../types/platform';

function normalize(value: string): string {
    return value.trim().toLowerCase();
}

function matchesFitment(item: ProductCatalogItem, query: SearchQuery): boolean {
    const fitment = query.fitment;
    if (!fitment) {
        return true;
    }

    return item.fitment.some((record) => {
        const makeMatches = normalize(record.make) === normalize(fitment.make);
        const modelMatches = normalize(record.model) === normalize(fitment.model);
        const yearMatches =
            fitment.year === undefined ||
            (fitment.year >= record.yearFrom && fitment.year <= record.yearTo);
        const engineMatches =
            !fitment.engineVariant ||
            !record.engineVariant ||
            normalize(record.engineVariant) === normalize(fitment.engineVariant);
        const trimMatches =
            !fitment.trimLevel ||
            !record.trimLevel ||
            normalize(record.trimLevel) === normalize(fitment.trimLevel);

        return makeMatches && modelMatches && yearMatches && engineMatches && trimMatches;
    });
}

function matchesText(item: ProductCatalogItem, text?: string): boolean {
    if (!text) {
        return true;
    }

    const candidate = normalize(text);
    const haystack = [item.title, item.description, item.seoTitle, item.sku, item.brand ?? '']
        .map(normalize)
        .join(' ');

    return haystack.includes(candidate);
}

export function searchCatalog(
    items: ProductCatalogItem[],
    query: SearchQuery,
): SearchResult<ProductCatalogItem> {
    const filtered = items.filter((item) => matchesText(item, query.text) && matchesFitment(item, query));
    const start = (query.page - 1) * query.pageSize;
    const end = start + query.pageSize;

    return {
        total: filtered.length,
        page: query.page,
        pageSize: query.pageSize,
        results: filtered.slice(start, end),
    };
}
