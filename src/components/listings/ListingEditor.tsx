import { useMemo, useState } from 'react';
import {
    Sparkles,
    Save,
    Eye,
    CheckCircle,
    Monitor,
    ShoppingBag,
    Plus
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { loadJson, saveJson, STORAGE_KEYS } from '../../lib/persistence';
import type { IngestionListingSeed, ProductCondition } from '../../types/platform';

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
    const routeState = location.state as ListingEditorRouteState | null;
    const persistedSeed = loadJson<IngestionListingSeed | null>(STORAGE_KEYS.ingestionListingSeed, null);
    const ingestionSeed = routeState?.ingestionSeed ?? persistedSeed ?? undefined;

    if (routeState?.ingestionSeed) {
        saveJson(STORAGE_KEYS.ingestionListingSeed, routeState.ingestionSeed);
    }

    const initial = useMemo(() => {
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
    }, [ingestionSeed]);

    const [title, setTitle] = useState(initial.title);
    const [mpn, setMpn] = useState(initial.mpn);
    const [brand, setBrand] = useState(initial.brand);
    const [condition, setCondition] = useState<ProductCondition>(initial.condition);
    const [price, setPrice] = useState(initial.price);
    const [description, setDescription] = useState(initial.description);

    const confidence = ingestionSeed?.recognition.confidence ?? 94;
    const galleryImages = ingestionSeed?.images ?? [];

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        New Listing
                        <Badge variant="outline" className="text-lg">Draft</Badge>
                        {ingestionSeed && <Badge variant="success">Imported from Ingestion</Badge>}
                    </h2>
                    <p className="text-slate-500">AI Analysis complete. Please review before publishing.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800">
                        <Eye size={16} /> Preview
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                        <Save size={16} /> Save & Publish
                    </button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
                <div className="col-span-12 lg:col-span-7 flex flex-col gap-6 overflow-y-auto pr-4 scrollbar-thin">

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

                                <div className="grid grid-cols-2 gap-4">
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

                                <div className="grid grid-cols-2 gap-4">
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
                                <div className="grid grid-cols-4 gap-4">
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
                                <div className="grid grid-cols-4 gap-4">
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

                <div className="col-span-12 lg:col-span-5 h-full flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
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

                            <div className="flex gap-4">
                                <div className="w-1/3 aspect-square bg-gray-200"></div>
                                <div className="w-2/3">
                                    <h1 className="text-xl font-bold leading-tight mb-2">{title}</h1>
                                    <div className="text-sm font-semibold mb-2">Condition: <span className="font-normal">{toConditionLabel(condition)}</span></div>

                                    <div className="text-2xl font-bold mb-4">US ${price}</div>

                                    <div className="bg-blue-600 text-white text-center py-2 font-bold rounded-full w-48 mb-2">Buy It Now</div>
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
