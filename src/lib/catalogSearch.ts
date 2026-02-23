import { CatalogFilterState, CatalogItem, CatalogQueryContext, SearchResultItem } from '../types/catalog';

const SYNONYM_DICTIONARY: Record<string, string[]> = {
    bumper: ['fascia'],
    fascia: ['bumper'],
    'tail light': ['rear lamp'],
    'rear lamp': ['tail light'],
    alternator: ['generator'],
    headlight: ['front lamp'],
};

const TOKEN_SPLIT_REGEX = /[^a-zA-Z0-9]+/g;

const normalize = (value: string) => value.trim().toLowerCase();

const tokenize = (value: string) => normalize(value).split(TOKEN_SPLIT_REGEX).filter(Boolean);

const levenshteinDistance = (first: string, second: string) => {
    if (first === second) {
        return 0;
    }

    const matrix = Array.from({ length: first.length + 1 }, (_, row) => [row]);
    for (let column = 0; column <= second.length; column += 1) {
        matrix[0][column] = column;
    }

    for (let row = 1; row <= first.length; row += 1) {
        for (let column = 1; column <= second.length; column += 1) {
            const substitution = first[row - 1] === second[column - 1] ? 0 : 1;
            matrix[row][column] = Math.min(
                matrix[row - 1][column] + 1,
                matrix[row][column - 1] + 1,
                matrix[row - 1][column - 1] + substitution
            );
        }
    }

    return matrix[first.length][second.length];
};

const expandSynonyms = (query: string) => {
    const normalized = normalize(query);
    const candidates = new Set<string>([normalized]);

    Object.entries(SYNONYM_DICTIONARY).forEach(([key, synonyms]) => {
        if (normalized.includes(key)) {
            synonyms.forEach(synonym => candidates.add(normalized.replace(key, synonym)));
        }
    });

    return Array.from(candidates);
};

const isPartNumberMatch = (item: CatalogItem, query: string) => {
    const normalized = normalize(query);
    return [...item.oemPartNumbers, ...item.aftermarketPartNumbers, item.sku].some(part => normalize(part) === normalized);
};

const computeGuaranteedFit = (item: CatalogItem, context: CatalogQueryContext) => {
    const compatibility = context.compatibility;

    const yearMatch = compatibility.year ? item.compatibility.some(fit => fit.year === compatibility.year) : true;
    const makeMatch = compatibility.make ? item.compatibility.some(fit => fit.make.toLowerCase() === compatibility.make?.toLowerCase()) : true;
    const modelMatch = compatibility.model ? item.compatibility.some(fit => fit.model.toLowerCase() === compatibility.model?.toLowerCase()) : true;
    const trimMatch = compatibility.trim ? item.compatibility.some(fit => fit.trim.toLowerCase() === compatibility.trim?.toLowerCase()) : true;

    const epIdMatch = compatibility.epId
        ? item.epids.some(epId => normalize(epId) === normalize(compatibility.epId || ''))
        : true;

    const kTypeMatch = compatibility.kType
        ? item.kTypes.some(kType => normalize(kType) === normalize(compatibility.kType || ''))
        : true;

    return yearMatch && makeMatch && modelMatch && trimMatch && epIdMatch && kTypeMatch;
};

const computeSearchScore = (item: CatalogItem, context: CatalogQueryContext) => {
    if (!context.query.trim()) {
        return item.popularityScore;
    }

    const queryVariants = expandSynonyms(context.query);
    const searchableCorpus = [
        item.title,
        item.description,
        item.sku,
        item.brand,
        item.placement,
        item.material,
        item.color,
        ...item.oemPartNumbers,
        ...item.aftermarketPartNumbers,
        ...item.compatibility.map(c => `${c.year} ${c.make} ${c.model} ${c.trim}`),
    ].join(' ').toLowerCase();

    const itemTokens = new Set(tokenize(searchableCorpus));
    let score = 0;

    queryVariants.forEach(variant => {
        const variantTokens = tokenize(variant);

        variantTokens.forEach(token => {
            if (itemTokens.has(token)) {
                score += 24;
                return;
            }

            const hasPrefix = Array.from(itemTokens).some(itemToken => itemToken.startsWith(token));
            if (hasPrefix) {
                score += 10;
                return;
            }

            const fuzzyMatch = Array.from(itemTokens).some(itemToken => {
                if (Math.abs(itemToken.length - token.length) > 1) {
                    return false;
                }
                return levenshteinDistance(itemToken, token) <= 1;
            });

            if (fuzzyMatch) {
                score += 6;
            }
        });
    });

    if (searchableCorpus.includes(normalize(context.query))) {
        score += 30;
    }

    if (isPartNumberMatch(item, context.query)) {
        score += 90;
    }

    if (context.attributes.brands.includes(item.brand)) {
        score += 12;
    }

    if (context.attributes.placements.includes(item.placement)) {
        score += 12;
    }

    score += Math.round(item.popularityScore * 0.35);
    return score;
};

export const runAutomotiveSearch = (items: CatalogItem[], context: CatalogQueryContext): SearchResultItem[] => {
    return items
        .map((item) => {
            const guaranteedFit = computeGuaranteedFit(item, context);
            const score = computeSearchScore(item, context) + (guaranteedFit ? 40 : 0);
            return {
                item,
                score,
                guaranteedFit,
            };
        })
        .sort((left, right) => right.score - left.score);
};

export const applyCatalogFilters = (results: SearchResultItem[], filters: CatalogFilterState) => {
    return results.filter((result) => {
        const item = result.item;
        const inPriceRange = item.price >= filters.minPrice && item.price <= filters.maxPrice;

        if (!inPriceRange) {
            return false;
        }

        if (filters.guaranteedFitOnly && !result.guaranteedFit) {
            return false;
        }

        if (filters.brands.length > 0 && !filters.brands.includes(item.brand)) {
            return false;
        }

        if (filters.conditions.length > 0 && !filters.conditions.includes(item.condition)) {
            return false;
        }

        if (filters.placements.length > 0 && !filters.placements.includes(item.placement)) {
            return false;
        }

        if (filters.availability.length > 0 && !filters.availability.includes(item.availability)) {
            return false;
        }

        if (filters.shippingTypes.length > 0 && !filters.shippingTypes.includes(item.shippingType)) {
            return false;
        }

        if (filters.sellerRatings.length > 0 && !filters.sellerRatings.includes(item.sellerRating)) {
            return false;
        }

        return true;
    });
};

export const buildFacetCounts = (results: SearchResultItem[]) => {
    const counts = {
        brands: new Map<string, number>(),
        conditions: new Map<string, number>(),
        placements: new Map<string, number>(),
        availability: new Map<string, number>(),
        shippingTypes: new Map<string, number>(),
        sellerRatings: new Map<string, number>(),
    };

    results.forEach(({ item }) => {
        const facets = [
            ['brands', item.brand],
            ['conditions', item.condition],
            ['placements', item.placement],
            ['availability', item.availability],
            ['shippingTypes', item.shippingType],
            ['sellerRatings', item.sellerRating],
        ] as const;

        facets.forEach(([group, value]) => {
            const groupMap = counts[group];
            const currentCount = groupMap.get(value) ?? 0;
            groupMap.set(value, currentCount + 1);
        });
    });

    return counts;
};

export const buildSuggestions = (items: CatalogItem[], query: string, limit = 6) => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) {
        return [];
    }

    const source = new Set<string>();
    items.forEach((item) => {
        source.add(item.title);
        source.add(item.brand);
        source.add(item.sku);
        item.oemPartNumbers.forEach(part => source.add(part));
        item.aftermarketPartNumbers.forEach(part => source.add(part));
    });

    return Array.from(source)
        .filter(option => option.toLowerCase().includes(normalizedQuery))
        .slice(0, limit);
};
