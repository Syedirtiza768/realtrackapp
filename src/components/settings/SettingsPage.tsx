import { useEffect, useState, useCallback } from 'react';
import {
    Settings,
    Truck,
    DollarSign,
    Save,
    Plus,
    Trash2,
    Loader2,
    ChevronDown,
    ChevronRight,
    ToggleLeft,
    ToggleRight,
    X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

const API = '/api/settings';

/* ─── Types ─── */

interface TenantSetting {
    id: string;
    category: string;
    key: string;
    value: unknown;
    description: string | null;
    updatedAt: string;
}

interface ShippingProfile {
    id: string;
    name: string;
    carrier: string;
    service: string;
    handlingTime: number;
    costType: string;
    flatCost: string | null;
    weightBased: boolean;
    domesticOnly: boolean;
    isDefault: boolean;
    active: boolean;
}

interface PricingRule {
    id: string;
    name: string;
    ruleType: string;
    channel: string | null;
    categoryId: string | null;
    brand: string | null;
    parameters: Record<string, unknown>;
    priority: number;
    active: boolean;
}

/* ─── Helpers ─── */

function Spinner() {
    return (
        <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        </div>
    );
}

/* ─── Component ─── */

export default function SettingsPage() {
    const [tab, setTab] = useState<'general' | 'shipping' | 'pricing'>('general');
    const [settings, setSettings] = useState<Record<string, TenantSetting[]>>({});
    const [shipping, setShipping] = useState<ShippingProfile[]>([]);
    const [pricing, setPricing] = useState<PricingRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [showAddProfile, setShowAddProfile] = useState(false);
    const [showAddRule, setShowAddRule] = useState(false);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [sRes, shRes, prRes] = await Promise.all([
                fetch(API).then(r => r.json()),
                fetch(`${API}/shipping-profiles/list`).then(r => r.json()),
                fetch(`${API}/pricing-rules/list`).then(r => r.json()),
            ]);
            setSettings(sRes ?? {});
            setShipping(Array.isArray(shRes) ? shRes : []);
            setPricing(Array.isArray(prRes) ? prRes : []);
        } catch (e) {
            console.error('Settings fetch error', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void fetchAll(); }, [fetchAll]);

    const updateSetting = async (category: string, key: string, value: unknown) => {
        setSaving(true);
        try {
            await fetch(`${API}/${category}/${key}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value }),
            });
            await fetchAll();
        } finally {
            setSaving(false);
        }
    };

    const createShippingProfile = async (data: Partial<ShippingProfile>) => {
        try {
            const res = await fetch(`${API}/shipping-profiles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const created = await res.json();
            setShipping(s => [...s, created]);
            setShowAddProfile(false);
        } catch (e) {
            console.error('Failed to create shipping profile', e);
        }
    };

    const createPricingRule = async (data: Partial<PricingRule>) => {
        try {
            const res = await fetch(`${API}/pricing-rules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const created = await res.json();
            setPricing(p => [...p, created]);
            setShowAddRule(false);
        } catch (e) {
            console.error('Failed to create pricing rule', e);
        }
    };

    const deleteShippingProfile = async (id: string) => {
        if (!confirm('Delete this shipping profile?')) return;
        await fetch(`${API}/shipping-profiles/${id}`, { method: 'DELETE' });
        setShipping(s => s.filter(p => p.id !== id));
    };

    const deletePricingRule = async (id: string) => {
        if (!confirm('Delete this pricing rule?')) return;
        await fetch(`${API}/pricing-rules/${id}`, { method: 'DELETE' });
        setPricing(p => p.filter(r => r.id !== id));
    };

    const tabs = [
        { key: 'general' as const, label: 'General', icon: Settings },
        { key: 'shipping' as const, label: 'Shipping', icon: Truck },
        { key: 'pricing' as const, label: 'Pricing', icon: DollarSign },
    ];

    return (
        <div className="space-y-4 sm:space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h2>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1 w-fit">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key
                                ? 'bg-slate-700 text-slate-100'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        <t.icon size={16} />
                        {t.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <Spinner />
            ) : (
                <>
                    {/* ─── General Settings ─── */}
                    {tab === 'general' && (
                        <div className="space-y-4">
                            {Object.keys(settings).length === 0 ? (
                                <Card>
                                    <CardContent className="py-8 text-center text-slate-500">
                                        No settings configured yet. Settings will appear here once created via the API.
                                    </CardContent>
                                </Card>
                            ) : (
                                Object.entries(settings).map(([category, items]) => (
                                    <Card key={category}>
                                        <button
                                            className="w-full flex items-center justify-between px-4 sm:px-6 py-4 hover:bg-slate-800/50 transition-colors"
                                            onClick={() =>
                                                setExpandedCategory(expandedCategory === category ? null : category)
                                            }
                                        >
                                            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                                                {category}
                                            </h3>
                                            {expandedCategory === category ? (
                                                <ChevronDown size={16} className="text-slate-500" />
                                            ) : (
                                                <ChevronRight size={16} className="text-slate-500" />
                                            )}
                                        </button>
                                        {expandedCategory === category && (
                                            <CardContent className="pt-0 divide-y divide-slate-800">
                                                {items.map(s => (
                                                    <div
                                                        key={s.id}
                                                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3"
                                                    >
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-medium text-slate-200">{s.key}</p>
                                                            {s.description && (
                                                                <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {typeof s.value === 'boolean' ? (
                                                                <button
                                                                    onClick={() =>
                                                                        void updateSetting(s.category, s.key, !s.value)
                                                                    }
                                                                    className="text-slate-400 hover:text-slate-100 transition-colors"
                                                                    disabled={saving}
                                                                >
                                                                    {s.value ? (
                                                                        <ToggleRight size={28} className="text-emerald-500" />
                                                                    ) : (
                                                                        <ToggleLeft size={28} />
                                                                    )}
                                                                </button>
                                                            ) : (
                                                                <SettingValueEditor
                                                                    value={s.value}
                                                                    saving={saving}
                                                                    onSave={v => void updateSetting(s.category, s.key, v)}
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </CardContent>
                                        )}
                                    </Card>
                                ))
                            )}
                        </div>
                    )}

                    {/* ─── Shipping Profiles ─── */}
                    {tab === 'shipping' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-slate-400">
                                    {shipping.length} shipping profile{shipping.length !== 1 ? 's' : ''}
                                </p>
                                <button onClick={() => setShowAddProfile(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                                    <Plus size={16} /> Add Profile
                                </button>
                            </div>

                            {showAddProfile && (
                                <AddShippingProfileForm
                                    onSubmit={createShippingProfile}
                                    onCancel={() => setShowAddProfile(false)}
                                />
                            )}

                            {shipping.length === 0 ? (
                                <Card>
                                    <CardContent className="py-8 text-center text-slate-500">
                                        No shipping profiles yet. Click "Add Profile" to create one.
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
                                    {shipping.map(sp => (
                                        <Card key={sp.id}>
                                            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                                                <div>
                                                    <CardTitle className="text-base">{sp.name}</CardTitle>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        {sp.carrier} — {sp.service}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {sp.isDefault && (
                                                        <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">
                                                            Default
                                                        </span>
                                                    )}
                                                    <button
                                                        onClick={() => void deleteShippingProfile(sp.id)}
                                                        className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="grid grid-cols-2 gap-y-2 text-sm">
                                                    <span className="text-slate-500">Cost type</span>
                                                    <span className="text-slate-200 capitalize">{sp.costType}</span>
                                                    {sp.costType === 'flat' && sp.flatCost && (
                                                        <>
                                                            <span className="text-slate-500">Flat cost</span>
                                                            <span className="text-slate-200">${sp.flatCost}</span>
                                                        </>
                                                    )}
                                                    <span className="text-slate-500">Handling time</span>
                                                    <span className="text-slate-200">{sp.handlingTime} day{sp.handlingTime !== 1 ? 's' : ''}</span>
                                                    <span className="text-slate-500">Domestic only</span>
                                                    <span className="text-slate-200">{sp.domesticOnly ? 'Yes' : 'No'}</span>
                                                    <span className="text-slate-500">Status</span>
                                                    <span className={sp.active ? 'text-emerald-500' : 'text-slate-500'}>
                                                        {sp.active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── Pricing Rules ─── */}
                    {tab === 'pricing' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-slate-400">
                                    {pricing.length} pricing rule{pricing.length !== 1 ? 's' : ''}
                                </p>
                                <button onClick={() => setShowAddRule(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                                    <Plus size={16} /> Add Rule
                                </button>
                            </div>

                            {showAddRule && (
                                <AddPricingRuleForm
                                    onSubmit={createPricingRule}
                                    onCancel={() => setShowAddRule(false)}
                                />
                            )}

                            {pricing.length === 0 ? (
                                <Card>
                                    <CardContent className="py-8 text-center text-slate-500">
                                        No pricing rules yet. Click "Add Rule" to create one.
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-800">
                                                <th className="text-left py-3 px-4 text-slate-500 font-medium">Name</th>
                                                <th className="text-left py-3 px-4 text-slate-500 font-medium">Type</th>
                                                <th className="text-left py-3 px-4 text-slate-500 font-medium hidden sm:table-cell">Channel</th>
                                                <th className="text-left py-3 px-4 text-slate-500 font-medium hidden md:table-cell">Brand</th>
                                                <th className="text-center py-3 px-4 text-slate-500 font-medium">Priority</th>
                                                <th className="text-center py-3 px-4 text-slate-500 font-medium">Active</th>
                                                <th className="text-right py-3 px-4" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {pricing.map(rule => (
                                                <tr key={rule.id} className="hover:bg-slate-800/30 transition-colors">
                                                    <td className="py-3 px-4 text-slate-200 font-medium">{rule.name}</td>
                                                    <td className="py-3 px-4">
                                                        <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded capitalize">
                                                            {rule.ruleType.replace('_', ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-400 hidden sm:table-cell capitalize">
                                                        {rule.channel ?? 'All'}
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-400 hidden md:table-cell">
                                                        {rule.brand ?? 'All'}
                                                    </td>
                                                    <td className="py-3 px-4 text-center text-slate-300">{rule.priority}</td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className={`inline-block w-2 h-2 rounded-full ${rule.active ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <button
                                                            onClick={() => void deletePricingRule(rule.id)}
                                                            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

/* ─── Inline Setting Value Editor ─── */

function SettingValueEditor({
    value,
    saving,
    onSave,
}: {
    value: unknown;
    saving: boolean;
    onSave: (v: unknown) => void;
}) {
    const stringVal = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
    const [draft, setDraft] = useState(stringVal);
    const [dirty, setDirty] = useState(false);

    const handleChange = (v: string) => {
        setDraft(v);
        setDirty(v !== stringVal);
    };

    const handleSave = () => {
        // Try parsing as JSON first, then number, then keep as string
        let parsed: unknown = draft;
        try {
            parsed = JSON.parse(draft);
        } catch {
            const num = Number(draft);
            if (!isNaN(num) && draft.trim() !== '') parsed = num;
        }
        onSave(parsed);
        setDirty(false);
    };

    return (
        <div className="flex items-center gap-2">
            <input
                type="text"
                value={draft}
                onChange={e => handleChange(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 w-40 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            {dirty && (
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                >
                    <Save size={16} />
                </button>
            )}
        </div>
    );
}

/* ─── Add Shipping Profile Form ─── */

function AddShippingProfileForm({
    onSubmit,
    onCancel,
}: {
    onSubmit: (data: Partial<ShippingProfile>) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState('');
    const [carrier, setCarrier] = useState('USPS');
    const [service, setService] = useState('Priority');
    const [handlingTime, setHandlingTime] = useState(1);
    const [costType, setCostType] = useState('flat');
    const [flatCost, setFlatCost] = useState('');
    const [domesticOnly, setDomesticOnly] = useState(true);
    const [isDefault, setIsDefault] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSubmit({
            name: name.trim(),
            carrier,
            service,
            handlingTime,
            costType,
            flatCost: costType === 'flat' ? flatCost || null : null,
            weightBased: costType === 'weight',
            domesticOnly,
            isDefault,
            active: true,
        });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">New Shipping Profile</CardTitle>
                <button onClick={onCancel} className="p-1 text-slate-400 hover:text-slate-200">
                    <X size={16} />
                </button>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Name *</label>
                            <input value={name} onChange={e => setName(e.target.value)} required
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Carrier</label>
                            <select value={carrier} onChange={e => setCarrier(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none">
                                <option value="USPS">USPS</option>
                                <option value="UPS">UPS</option>
                                <option value="FedEx">FedEx</option>
                                <option value="DHL">DHL</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Service</label>
                            <input value={service} onChange={e => setService(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Handling Time (days)</label>
                            <input type="number" value={handlingTime} onChange={e => setHandlingTime(Number(e.target.value))} min={0}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Cost Type</label>
                            <select value={costType} onChange={e => setCostType(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none">
                                <option value="flat">Flat Rate</option>
                                <option value="free">Free</option>
                                <option value="calculated">Calculated</option>
                                <option value="weight">Weight Based</option>
                            </select>
                        </div>
                        {costType === 'flat' && (
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Flat Cost ($)</label>
                                <input value={flatCost} onChange={e => setFlatCost(e.target.value)} placeholder="0.00"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                            <input type="checkbox" checked={domesticOnly} onChange={e => setDomesticOnly(e.target.checked)}
                                className="rounded bg-slate-800 border-slate-600" />
                            Domestic only
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                            <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)}
                                className="rounded bg-slate-800 border-slate-600" />
                            Set as default
                        </label>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                        <button type="submit" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                            <Plus size={16} /> Create Profile
                        </button>
                        <button type="button" onClick={onCancel} className="text-sm text-slate-400 hover:text-slate-200 px-3 py-2 transition-colors">
                            Cancel
                        </button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

/* ─── Add Pricing Rule Form ─── */

function AddPricingRuleForm({
    onSubmit,
    onCancel,
}: {
    onSubmit: (data: Partial<PricingRule>) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState('');
    const [ruleType, setRuleType] = useState('markup');
    const [channel, setChannel] = useState('');
    const [brand, setBrand] = useState('');
    const [priority, setPriority] = useState(0);
    const [percentage, setPercentage] = useState(10);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSubmit({
            name: name.trim(),
            ruleType,
            channel: channel || null,
            brand: brand || null,
            parameters: { percentage },
            priority,
            active: true,
        });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">New Pricing Rule</CardTitle>
                <button onClick={onCancel} className="p-1 text-slate-400 hover:text-slate-200">
                    <X size={16} />
                </button>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Name *</label>
                            <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g., eBay 15% Markup"
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Rule Type</label>
                            <select value={ruleType} onChange={e => setRuleType(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none">
                                <option value="markup">Markup</option>
                                <option value="markdown">Markdown</option>
                                <option value="round">Round</option>
                                <option value="min_margin">Min Margin</option>
                                <option value="competitive">Competitive</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Channel (optional)</label>
                            <select value={channel} onChange={e => setChannel(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none">
                                <option value="">All Channels</option>
                                <option value="ebay">eBay</option>
                                <option value="shopify">Shopify</option>
                                <option value="amazon">Amazon</option>
                                <option value="walmart">Walmart</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Brand (optional)</label>
                            <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g., ACME"
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Percentage</label>
                            <input type="number" value={percentage} onChange={e => setPercentage(Number(e.target.value))} min={0} step={0.1}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Priority</label>
                            <input type="number" value={priority} onChange={e => setPriority(Number(e.target.value))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                        <button type="submit" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                            <Plus size={16} /> Create Rule
                        </button>
                        <button type="button" onClick={onCancel} className="text-sm text-slate-400 hover:text-slate-200 px-3 py-2 transition-colors">
                            Cancel
                        </button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
