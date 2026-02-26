import { useEffect, useMemo, useState } from 'react';
import {
    Sparkles,
    Save,
    Eye,
    CheckCircle,
    Monitor,
    ShoppingBag,
    Plus,
    ArrowLeft,
    Loader2,
    AlertTriangle,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { loadJson, saveJson, STORAGE_KEYS } from '../../lib/persistence';
import {
    createListing,
    updateListing,
    isApiError,
} from '../../lib/listingsApi';
import { useListingDetail } from '../../lib/searchApi';
import type { IngestionListingSeed, ProductCondition } from '../../types/platform';
import type { ListingStatus } from '../../types/listings';

type ListingEditorRouteState = {
    ingestionSeed?: IngestionListingSeed;
};

const CONDITION_OPTIONS: ProductCondition[] = [
    'new',
    'new_open_box',
    'remanufactured',
    'used',
    'for_parts',
];

function toConditionLabel(value: ProductCondition): string {
    if (value === 'new') return 'New';
    if (value === 'new_open_box') return 'New (Open Box)';
    if (value === 'remanufactured') return 'Remanufactured';
    if (value === 'used') return 'Used';
    return 'For Parts';
}

const defaultDescription = `Genuine OEM Toyota Camry Alternator.

Removed from a 2021 Toyota Camry LE with 24k miles.
Tested and verified working perfectly. Output voltage stable at 14.2V.

Fits:
- 2018-2024 Toyota Camry (2.5L 4-Cyl)
- 2019-2023 Toyota RAV4 (2.5L 4-Cyl)

Fast shipping via UPS Ground.`;

export default function ListingEditor() {
    const location = useLocation();
    const navigate = useNavigate();
    const { id: routeId } = useParams<{ id: string }>();
    const isEditMode = Boolean(routeId);

    const routeState = location.state as ListingEditorRouteState | null;
    const persistedSeed = loadJson<IngestionListingSeed | null>(STORAGE_KEYS.ingestionListingSeed, null);
    const ingestionSeed = routeState?.ingestionSeed ?? persistedSeed ?? undefined;

    if (routeState?.ingestionSeed) {
        saveJson(STORAGE_KEYS.ingestionListingSeed, routeState.ingestionSeed);
    }

    // Fetch existing listing for edit mode
    const { data: existingListing, loading: fetchLoading } = useListingDetail(routeId ?? null);

    const initial = useMemo(() => {
        if (isEditMode && existingListing) {
            return {
                title: existingListing.title ?? '',
                mpn: existingListing.cManufacturerPartNumber ?? '',
                brand: existingListing.cBrand ?? '',
                condition: (existingListing.conditionId ?? 'used') as ProductCondition,
                price: existingListing.startPrice ?? '',
                description: existingListing.description ?? '',
            };
        }
        const inferredBrand =
            (typeof ingestionSeed?.generatedData.itemSpecifics.brand === 'string' && ingestionSeed.generatedData.itemSpecifics.brand) ||
            ingestionSeed?.recognition.brand ||
            'Toyota (OEM)';

        const inferredCondition = ingestionSeed?.recognition.condition ?? 'used';

        return {
            title: ingestionSeed?.generatedData.seoTitle ?? 'OEM Alternator for 2018-2024 Toyota Camry 2.5L 4-Cyl Verified Fitment',
            mpn: '27060-0V210',
            brand: inferredBrand,
            condition: inferredCondition,
            price: '129.99',
            description: ingestionSeed?.generatedData.description ?? defaultDescription,
        };
    }, [ingestionSeed, isEditMode, existingListing]);

    const [title, setTitle] = useState(initial.title);
    const [mpn, setMpn] = useState(initial.mpn);
    const [brand, setBrand] = useState(initial.brand);
    const [condition, setCondition] = useState<ProductCondition>(initial.condition);
    const [price, setPrice] = useState(initial.price);
    const [description, setDescription] = useState(initial.description);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Sync form when existing listing loads in edit mode
    useEffect(() => {
        if (isEditMode && existingListing) {
            setTitle(existingListing.title ?? '');
            setMpn(existingListing.cManufacturerPartNumber ?? '');
            setBrand(existingListing.cBrand ?? '');
            setCondition((existingListing.conditionId ?? 'used') as ProductCondition);
            setPrice(existingListing.startPrice ?? '');
            setDescription(existingListing.description ?? '');
        }
    }, [isEditMode, existingListing]);

    const confidence = ingestionSeed?.recognition.confidence ?? 94;
    const galleryImages = ingestionSeed?.images ?? [];

    const currentVersion = (existingListing as { version?: number } | null)?.version ?? 1;
    const currentStatus = ((existingListing as { status?: ListingStatus } | null)?.status ?? 'draft') as ListingStatus;

    const handleSave = async (status: 'draft' | 'ready' = 'draft') => {
        setSaving(true);
        setSaveError(null);
        setSaveSuccess(false);
        try {
            const body = {
                title,
                cManufacturerPartNumber: mpn,
                cBrand: brand,
                conditionId: condition,
                startPrice: price,
                description,
                status,
            };

            if (isEditMode && routeId) {
                await updateListing(routeId, { ...body, version: currentVersion });
            } else {
                await createListing(body);
            }
            setSaveSuccess(true);
            setTimeout(() => navigate('/catalog'), 1200);
        } catch (err) {
            if (isApiError(err) && err.status === 409) {
                setSaveError('Version conflict — someone else edited this listing. Please refresh and try again.');
            } else {
                setSaveError(err instanceof Error ? err.message : 'Failed to save listing');
            }
        } finally {
            setSaving(false);
        }
    };

    if (isEditMode && fetchLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 sm:gap-6 pb-8">
            {/* Save feedback */}
            {saveError && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-sm text-red-400">
                    <AlertTriangle size={16} className="shrink-0" />
                    {saveError}
                </div>
            )}
            {saveSuccess && (
                <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3 flex items-center gap-2 text-sm text-emerald-400">
                    <CheckCircle size={16} className="shrink-0" />
                    Listing saved successfully! Redirecting…
                </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors shrink-0"
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex flex-wrap items-center gap-2 sm:gap-3">
                            {isEditMode ? 'Edit Listing' : 'New Listing'}
                            <Badge variant="outline" className="text-base sm:text-lg capitalize">{currentStatus}</Badge>
                            {ingestionSeed && <Badge variant="success">Imported from Ingestion</Badge>}
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">
                            {isEditMode
                                ? `Editing · v${currentVersion}`
                                : 'AI Analysis complete. Please review before publishing.'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <button
                        onClick={() => navigate(`/listings/${routeId}/history`)}
                        className={`flex items-center gap-2 px-3 sm:px-4 py-2 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 text-sm ${!isEditMode ? 'hidden' : ''}`}
                    >
                        <Eye size={16} /> History
                    </button>
                    <button
                        onClick={() => handleSave('draft')}
                        disabled={saving}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 text-sm disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Save Draft
                    </button>
                    <button
                        onClick={() => handleSave('ready')}
                        disabled={saving}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Save & Publish
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
                <div className="lg:col-span-7 flex flex-col gap-4 sm:gap-6 overflow-y-auto lg:pr-4 scrollbar-thin">

                    <div className="bg-blue-900/10 border border-blue-500/20 rounded-lg p-4 flex gap-3">
                        <Sparkles className="text-blue-400 shrink-0" size={20} />
                        <div>
                            <h4 className="text-sm font-medium text-blue-400">AI Generated Content</h4>
                            <p className="text-xs text-blue-400/80 mt-1">
                                We&apos;ve populated listing fields from image analysis. Confidence Score: <span className="font-mono">{confidence}%</span>.
                            </p>
                        </div>
                    </div>

                    <Card>
                        <CardContent className="p-6 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Listing Title</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={(event) => setTitle(event.target.value)}
                                            className="w-full bg-slate-800 border-none rounded-lg p-3 text-slate-200 focus:ring-1 focus:ring-blue-500"
                                        />
                                        <Badge variant="success" className="absolute right-3 top-3">{title.length}/80 chars</Badge>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-1">Part Number (MPN)</label>
                                        <input
                                            type="text"
                                            value={mpn}
                                            onChange={(event) => setMpn(event.target.value)}
                                            className="w-full bg-slate-800 border-none rounded-lg p-3 text-slate-200 focus:ring-1 focus:ring-blue-500 font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-1">Brand</label>
                                        <input
                                            type="text"
                                            value={brand}
                                            onChange={(event) => setBrand(event.target.value)}
                                            className="w-full bg-slate-800 border-none rounded-lg p-3 text-slate-200 focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-1">Condition</label>
                                        <select
                                            value={condition}
                                            onChange={(event) => setCondition(event.target.value as ProductCondition)}
                                            className="w-full bg-slate-800 border-none rounded-lg p-3 text-slate-200 focus:ring-1 focus:ring-blue-500"
                                        >
                                            {CONDITION_OPTIONS.map((option) => (
                                                <option key={option} value={option}>{toConditionLabel(option)}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-1">Price</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-3 text-slate-500">$</span>
                                            <input
                                                type="text"
                                                value={price}
                                                onChange={(event) => setPrice(event.target.value)}
                                                className="w-full bg-slate-800 border-none rounded-lg p-3 pl-8 text-slate-200 focus:ring-1 focus:ring-blue-500 font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
                                    <textarea
                                        className="w-full h-40 bg-slate-800 border-none rounded-lg p-3 text-slate-200 focus:ring-1 focus:ring-blue-500 resize-none font-sans"
                                        value={description}
                                        onChange={(event) => setDescription(event.target.value)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <h3 className="font-medium text-slate-200 mb-4">Gallery</h3>
                            {galleryImages.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                                    {galleryImages.slice(0, 4).map((image, index) => (
                                        <div key={image.id} className={`aspect-square rounded-lg overflow-hidden relative ${index === 0 ? 'border-2 border-blue-500' : 'border border-slate-700'}`}>
                                            <img src={image.uri} alt={image.angle ?? 'Part image'} className="w-full h-full object-cover" />
                                            {index === 0 && <div className="absolute top-2 right-2 bg-blue-600/80 text-white text-[10px] px-1.5 rounded">AI Validated</div>}
                                        </div>
                                    ))}
                                    <div className="aspect-square bg-slate-800/50 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-700 hover:border-slate-500 cursor-pointer transition-colors">
                                        <Plus size={24} className="text-slate-600" />
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                                    <div className="aspect-square bg-slate-800 rounded-lg flex items-center justify-center border-2 border-blue-500 relative overflow-hidden group">
                                        <span className="text-slate-600">Main Image</span>
                                        <div className="absolute top-2 right-2 bg-blue-600/80 text-white text-[10px] px-1.5 rounded">AI Validated</div>
                                    </div>
                                    <div className="aspect-square bg-slate-800 rounded-lg flex items-center justify-center hover:bg-slate-700 transition-colors">
                                        <span className="text-slate-600">Side View</span>
                                    </div>
                                    <div className="aspect-square bg-slate-800 rounded-lg flex items-center justify-center hover:bg-slate-700 transition-colors">
                                        <span className="text-slate-600">Label</span>
                                    </div>
                                    <div className="aspect-square bg-slate-800/50 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-700 hover:border-slate-500 cursor-pointer transition-colors">
                                        <Plus size={24} className="text-slate-600" />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-5 flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl min-h-[400px] lg:min-h-0">
                    <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Live Preview</span>
                        <div className="flex bg-slate-800 rounded-lg p-1">
                            <button className="p-1 px-3 rounded-md bg-blue-600/20 text-blue-400 text-xs font-medium flex items-center gap-2">
                                <Monitor size={12} /> eBay
                            </button>
                            <button className="p-1 px-3 rounded-md text-slate-400 text-xs font-medium flex items-center gap-2 hover:text-slate-200">
                                <ShoppingBag size={12} /> Shopify
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 bg-white overflow-hidden relative">
                        <div className="w-full bg-[#f8f8f8] h-full p-4 font-sans text-black">
                            <div className="h-8 w-24 bg-[#e53238] mb-4"></div>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="w-full sm:w-1/3 aspect-square bg-gray-200"></div>
                                <div className="w-full sm:w-2/3">
                                    <h1 className="text-base sm:text-xl font-bold leading-tight mb-2">{title}</h1>
                                    <div className="text-sm font-semibold mb-2">Condition: <span className="font-normal">{toConditionLabel(condition)}</span></div>

                                    <div className="text-2xl font-bold mb-4">US ${price}</div>

                                    <div className="bg-blue-600 text-white text-center py-2 font-bold rounded-full w-36 sm:w-48 mb-2">Buy It Now</div>
                                    <div className="text-sm text-gray-500">Free 3 day shipping</div>
                                </div>
                            </div>

                            <div className="mt-8 border-t pt-4">
                                <h3 className="font-bold mb-2">Item specifics</h3>
                                <div className="grid grid-cols-2 gap-y-2 text-sm">
                                    <div className="text-gray-500">Condition:</div>
                                    <div>{toConditionLabel(condition)}</div>
                                    <div className="text-gray-500">Brand:</div>
                                    <div>{brand}</div>
                                    <div className="text-gray-500">Manufacturer Part Number:</div>
                                    <div>{mpn}</div>
                                </div>
                            </div>
                        </div>

                        <div className="absolute bottom-0 w-full bg-slate-900/90 p-4 text-white text-xs border-t border-slate-700 flex justify-between items-center">
                            <div>
                                <span className="font-bold text-emerald-400">eBay Listing Optimized</span>
                                <p className="opacity-70">Keywords valid. 0 Policy violations.</p>
                            </div>
                            <CheckCircle className="text-emerald-500" size={20} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
