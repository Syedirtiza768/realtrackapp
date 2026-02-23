import {
    IntelligentIngestionService,
    type ProductDataEnricher,
    type VisionRecognizer,
} from './ingestionPipeline';
import type {
    AiGeneratedProductData,
    ImageRecognitionResult,
    ProductImage,
} from '../types/platform';

export type IngestionProvider = 'mock' | 'api';

export interface IngestionRuntimeConfig {
    provider: IngestionProvider;
    apiBaseUrl?: string;
    healthPath: string;
}

export interface IngestionProviderHealth {
    provider: IngestionProvider;
    healthy: boolean;
    message: string;
}

type IdentifyPartRequest = {
    images: ProductImage[];
};

type EnrichRequest = {
    recognition: ImageRecognitionResult;
    images: ProductImage[];
};

const PART_CANDIDATES: Array<Pick<ImageRecognitionResult, 'partName' | 'category' | 'brand' | 'condition'>> = [
    { partName: 'Alternator', category: 'Charging System', brand: 'Denso', condition: 'used' },
    { partName: 'Brake Pad Set', category: 'Braking', brand: 'Bosch', condition: 'new' },
    { partName: 'Headlight Assembly', category: 'Lighting', brand: 'TYC', condition: 'new_open_box' },
    { partName: 'Fuel Pump Module', category: 'Fuel System', brand: 'Delphi', condition: 'remanufactured' },
    { partName: 'Engine Control Module', category: 'Electrical', brand: 'ACDelco', condition: 'used' },
];

function randomInt(maxExclusive: number): number {
    return Math.floor(Math.random() * maxExclusive);
}

function buildMockRecognizer(): VisionRecognizer {
    return {
        async identifyPart(images) {
            const sample = PART_CANDIDATES[randomInt(PART_CANDIDATES.length)];
            const confidence = Math.max(78, 90 - Math.floor(images.length / 2));
            await new Promise((resolve) => setTimeout(resolve, 500));

            return {
                ...sample,
                confidence,
                tags: [sample.partName.toLowerCase(), sample.category.toLowerCase(), `${images.length}_images`],
            };
        },
    };
}

function buildMockEnricher(): ProductDataEnricher {
    return {
        async enrich(recognition, images) {
            await new Promise((resolve) => setTimeout(resolve, 450));

            return {
                seoTitle: `${recognition.brand ?? 'OEM'} ${recognition.partName} for Popular Vehicle Applications`,
                technicalSpecifications: {
                    material: 'OEM-grade alloy',
                    weightKg: 3.2,
                    tested: true,
                    imageEvidenceCount: images.length,
                },
                description: `Professionally inspected ${recognition.partName.toLowerCase()} with multi-angle imagery and AI-assisted verification for marketplace-ready listing quality.`,
                suggestedCategory: `Parts & Accessories > ${recognition.category}`,
                itemSpecifics: {
                    brand: recognition.brand ?? 'Unknown',
                    partType: recognition.partName,
                    condition: recognition.condition ?? 'used',
                    listingQuality: 'AI Enriched',
                },
            };
        },
    };
}

async function postJson<TRequest, TResponse>(
    baseUrl: string,
    path: string,
    payload: TRequest,
): Promise<TResponse> {
    const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Ingestion API request failed: ${response.status}`);
    }

    return (await response.json()) as TResponse;
}

function buildApiRecognizer(baseUrl: string): VisionRecognizer {
    return {
        async identifyPart(images) {
            return postJson<IdentifyPartRequest, ImageRecognitionResult>(baseUrl, '/v1/vision/identify', {
                images,
            });
        },
    };
}

function buildApiEnricher(baseUrl: string): ProductDataEnricher {
    return {
        async enrich(recognition, images) {
            return postJson<EnrichRequest, AiGeneratedProductData>(baseUrl, '/v1/enrichment/generate', {
                recognition,
                images,
            });
        },
    };
}

function getProviderFromEnvironment(): IngestionProvider {
    const configuredProvider = import.meta.env.VITE_INGESTION_PROVIDER as IngestionProvider | undefined;
    return configuredProvider ?? 'mock';
}

export function getIngestionRuntimeConfig(): IngestionRuntimeConfig {
    const provider = getProviderFromEnvironment();
    const apiBaseUrl = (import.meta.env.VITE_INGESTION_API_BASE_URL as string | undefined) ?? undefined;
    const healthPath = (import.meta.env.VITE_INGESTION_HEALTH_PATH as string | undefined) ?? '/v1/health/ingestion';

    return {
        provider,
        apiBaseUrl,
        healthPath,
    };
}

export async function checkIngestionProviderHealth(
    config: IngestionRuntimeConfig = getIngestionRuntimeConfig(),
): Promise<IngestionProviderHealth> {
    if (config.provider === 'mock') {
        return {
            provider: 'mock',
            healthy: true,
            message: 'Mock provider active',
        };
    }

    if (!config.apiBaseUrl) {
        return {
            provider: 'api',
            healthy: false,
            message: 'Missing VITE_INGESTION_API_BASE_URL',
        };
    }

    try {
        const response = await fetch(`${config.apiBaseUrl}${config.healthPath}`, {
            method: 'GET',
        });

        if (!response.ok) {
            return {
                provider: 'api',
                healthy: false,
                message: `API unhealthy (${response.status})`,
            };
        }

        return {
            provider: 'api',
            healthy: true,
            message: 'API provider reachable',
        };
    } catch {
        return {
            provider: 'api',
            healthy: false,
            message: 'API provider unreachable',
        };
    }
}

export function createIngestionService(
    config: IngestionRuntimeConfig = getIngestionRuntimeConfig(),
): IntelligentIngestionService {
    const provider = config.provider;

    if (provider === 'api') {
        const baseUrl = config.apiBaseUrl ?? '';
        if (!baseUrl) {
            throw new Error('VITE_INGESTION_API_BASE_URL is required when VITE_INGESTION_PROVIDER=api');
        }

        return new IntelligentIngestionService(
            buildApiRecognizer(baseUrl),
            buildApiEnricher(baseUrl),
        );
    }

    return new IntelligentIngestionService(buildMockRecognizer(), buildMockEnricher());
}
