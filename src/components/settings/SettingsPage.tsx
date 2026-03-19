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
    Link2,
    CheckCircle2,
    AlertCircle,
    ExternalLink,
    Wifi,
    WifiOff,
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
    const [tab, setTab] = useState<'general' | 'shipping' | 'pricing' | 'channels'>('general');
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
        { key: 'channels' as const, label: 'Channels', icon: Link2 },
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

                    {/* ─── Channels ─── */}
                    {tab === 'channels' && (
                        <ChannelConnectionsTab />
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

/* ─── Channel Connections Tab ─── */

interface ChannelConn {
    id: string;
    channel: string;
    accountName: string | null;
    externalAccountId: string | null;
    status: string;
    lastSyncAt: string | null;
    lastError: string | null;
    createdAt: string;
}

interface ChannelStore {
    id: string;
    connectionId: string;
    channel: string;
    storeName: string;
    storeUrl: string | null;
    externalStoreId: string | null;
    status: string;
    isPrimary: boolean;
    listingCount: number;
    config: Record<string, unknown>;
    createdAt: string;
}

const CHANNEL_INFO: Record<string, { label: string; color: string; logo: string }> = {
    ebay:    { label: 'eBay',    color: '#0064D2', logo: '🛒' },
    shopify: { label: 'Shopify', color: '#96BF48', logo: '🟢' },
    amazon:  { label: 'Amazon',  color: '#FF9900', logo: '📦' },
    walmart: { label: 'Walmart', color: '#0071CE', logo: '🏪' },
};

function ChannelConnectionsTab() {
    const [connections, setConnections] = useState<ChannelConn[]>([]);
    const [stores, setStores] = useState<ChannelStore[]>([]);
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);
    const [oauthLoading, setOauthLoading] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{ id: string; ok: boolean; error?: string } | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [showTokenForm, setShowTokenForm] = useState(false);
    const [legacyToken, setLegacyToken] = useState('');
    const [importingToken, setImportingToken] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [connRes, storeRes] = await Promise.all([
                fetch('/api/channels?userId=system').then(r => r.json()),
                fetch('/api/stores').then(r => r.json()),
            ]);
            setConnections(Array.isArray(connRes) ? connRes : []);
            setStores(Array.isArray(storeRes) ? storeRes : []);
        } catch (e) {
            console.error('Failed to fetch channels', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void fetchData(); }, [fetchData]);

    const seedDemoEbay = async () => {
        setSeeding(true);
        setMessage(null);
        try {
            const res = await fetch('/api/channels/demo/seed-ebay', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message ?? 'Seed failed');
            setMessage({ type: 'success', text: data.message ?? 'Demo eBay store created!' });
            await fetchData();
        } catch (e: any) {
            setMessage({ type: 'error', text: e.message });
        } finally {
            setSeeding(false);
        }
    };

    const startOAuth = async (channel: string) => {
        setOauthLoading(channel);
        try {
            const res = await fetch(`/api/channels/${channel}/auth-url?state=connect:system`);
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (e: any) {
            setMessage({ type: 'error', text: `OAuth failed: ${e.message}` });
        } finally {
            setOauthLoading(null);
        }
    };

    const importLegacyToken = async () => {
        if (!legacyToken.trim()) return;
        setImportingToken(true);
        setMessage(null);
        try {
            const res = await fetch('/api/channels/ebay/connect-legacy-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: legacyToken.trim() }),
            });
            const data = await res.json();
            if (!res.ok || data.ok === false) throw new Error(data.error ?? data.message ?? 'Import failed');
            setMessage({ type: 'success', text: data.message ?? 'eBay sandbox token imported!' });
            setLegacyToken('');
            setShowTokenForm(false);
            await fetchData();
        } catch (e: any) {
            setMessage({ type: 'error', text: e.message });
        } finally {
            setImportingToken(false);
        }
    };

    const testConnection = async (connectionId: string) => {
        setTestResult(null);
        try {
            const res = await fetch(`/api/channels/${connectionId}/test`, { method: 'POST' });
            const data = await res.json();
            setTestResult({ id: connectionId, ...data });
        } catch (e: any) {
            setTestResult({ id: connectionId, ok: false, error: e.message });
        }
    };

    const disconnectChannel = async (connectionId: string) => {
        if (!confirm('Disconnect this channel? This will remove all associated stores.')) return;
        try {
            await fetch(`/api/channels/${connectionId}`, { method: 'DELETE' });
            setMessage({ type: 'success', text: 'Channel disconnected' });
            await fetchData();
        } catch (e: any) {
            setMessage({ type: 'error', text: e.message });
        }
    };

    if (loading) return <Spinner />;

    const ebayConnected = connections.some(c => c.channel === 'ebay' && c.status === 'active');
    const shopifyConnected = connections.some(c => c.channel === 'shopify' && c.status === 'active');

    return (
        <div className="space-y-6">
            {/* Status message */}
            {message && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                    message.type === 'success'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                    {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {message.text}
                    <button onClick={() => setMessage(null)} className="ml-auto text-slate-400 hover:text-slate-200">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Quick Setup */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Wifi size={18} className="text-blue-400" />
                        Quick Setup — eBay Sandbox
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-slate-400">
                        Click below to create a demo eBay Sandbox connection using your developer credentials.
                        This runs in <span className="text-amber-400 font-medium">demo mode</span> — no real listings will be published.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={seedDemoEbay}
                            disabled={seeding || ebayConnected}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                            {seeding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            {ebayConnected ? 'eBay Already Connected' : 'Create Demo eBay Store'}
                        </button>
                        {!ebayConnected && (
                            <>
                                <button
                                    onClick={() => setShowTokenForm(v => !v)}
                                    className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                                >
                                    <Link2 size={16} />
                                    Paste User Token
                                </button>
                                <button
                                    onClick={() => startOAuth('ebay')}
                                    disabled={!!oauthLoading}
                                    className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                                >
                                    {oauthLoading === 'ebay' ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                                    Connect via OAuth (Sandbox)
                                </button>
                            </>
                        )}
                    </div>

                    {/* Legacy token paste form */}
                    {showTokenForm && !ebayConnected && (
                        <div className="space-y-2 bg-slate-800/60 rounded-lg p-4 border border-slate-700/50">
                            <p className="text-xs text-slate-400">
                                Paste the <span className="text-slate-200 font-medium">eBay Sandbox User Token</span> from your{' '}
                                <a
                                    href="https://developer.ebay.com/my/auth/sandbox/user"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:underline"
                                >
                                    eBay Developer Portal → Sandbox → User Tokens
                                </a>
                                . It starts with <code className="text-amber-400">v^1.1#i^1#...</code>
                            </p>
                            <textarea
                                value={legacyToken}
                                onChange={e => setLegacyToken(e.target.value)}
                                rows={4}
                                placeholder="v^1.1#i^1#f^0#p^1#r^0#I^3#t^H4sI..."
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={importLegacyToken}
                                    disabled={!legacyToken.trim() || importingToken}
                                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
                                >
                                    {importingToken ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                    Import &amp; Connect
                                </button>
                                <button
                                    onClick={() => { setShowTokenForm(false); setLegacyToken(''); }}
                                    className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-500 space-y-1">
                        <p><span className="text-slate-400 font-medium">App ID:</span> IrtizaHa-listingp-SBX-e6e5fa804-178dade4</p>
                        <p><span className="text-slate-400 font-medium">Dev ID:</span> 71354d52-d565-49e2-8977-d96caab268ee</p>
                        <p><span className="text-slate-400 font-medium">Environment:</span> Sandbox</p>
                    </div>
                </CardContent>
            </Card>

            {/* Connected Channels */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-200">Connected Channels</h3>
                {connections.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center text-slate-500">
                            <WifiOff size={24} className="mx-auto mb-2 text-slate-600" />
                            No channels connected yet. Use Quick Setup above to get started.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {connections.map(conn => {
                            const info = CHANNEL_INFO[conn.channel] ?? { label: conn.channel, color: '#666', logo: '🔗' };
                            const connStores = stores.filter(s => s.connectionId === conn.id);
                            const isTestOk = testResult?.id === conn.id ? testResult.ok : null;

                            return (
                                <Card key={conn.id} className="overflow-hidden">
                                    <div className="h-1" style={{ backgroundColor: info.color }} />
                                    <CardContent className="pt-4 space-y-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">{info.logo}</span>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-200">{info.label}</p>
                                                    <p className="text-xs text-slate-500">{conn.accountName ?? conn.externalAccountId ?? conn.id.slice(0, 8)}</p>
                                                </div>
                                            </div>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                conn.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' :
                                                conn.status === 'error' ? 'bg-red-500/15 text-red-400' :
                                                'bg-slate-700 text-slate-400'
                                            }`}>
                                                {conn.status}
                                            </span>
                                        </div>

                                        {/* Stores */}
                                        {connStores.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Stores</p>
                                                {connStores.map(store => (
                                                    <div key={store.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                                                        <div>
                                                            <p className="text-sm text-slate-300">{store.storeName}</p>
                                                            <p className="text-xs text-slate-500">
                                                                {store.listingCount} listing{store.listingCount !== 1 ? 's' : ''}
                                                                {store.isPrimary && <span className="ml-1 text-blue-400">• Primary</span>}
                                                            </p>
                                                        </div>
                                                        <span className={`text-xs px-2 py-0.5 rounded ${
                                                            store.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-400'
                                                        }`}>
                                                            {store.status}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Connection details */}
                                        <div className="text-xs text-slate-600 space-y-0.5">
                                            <p>Connected: {new Date(conn.createdAt).toLocaleDateString()}</p>
                                            {conn.lastSyncAt && <p>Last sync: {new Date(conn.lastSyncAt).toLocaleString()}</p>}
                                            {conn.lastError && <p className="text-red-400">Error: {conn.lastError}</p>}
                                        </div>

                                        {/* Test result */}
                                        {isTestOk !== null && (
                                            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                                                isTestOk ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                            }`}>
                                                {isTestOk ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                                <span>{isTestOk ? 'Connection OK' : (testResult?.error ?? 'Connection failed')}</span>
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="flex gap-2 pt-1">
                                            <button
                                                onClick={() => testConnection(conn.id)}
                                                className="text-xs text-slate-400 hover:text-blue-400 transition-colors"
                                            >
                                                Test Connection
                                            </button>
                                            <span className="text-slate-700">|</span>
                                            <button
                                                onClick={() => disconnectChannel(conn.id)}
                                                className="text-xs text-slate-400 hover:text-red-400 transition-colors"
                                            >
                                                Disconnect
                                            </button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Available Channels (not yet connected) */}
            {(!ebayConnected || !shopifyConnected) && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-200">Available Channels</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(CHANNEL_INFO)
                            .filter(([key]) => !connections.some(c => c.channel === key && c.status === 'active'))
                            .map(([key, info]) => (
                                <button
                                    key={key}
                                    onClick={() => key === 'ebay' ? seedDemoEbay() : startOAuth(key)}
                                    disabled={!!oauthLoading || seeding}
                                    className="flex items-center gap-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-lg p-4 text-left transition-all"
                                >
                                    <span className="text-2xl">{info.logo}</span>
                                    <div>
                                        <p className="text-sm font-medium text-slate-300">{info.label}</p>
                                        <p className="text-xs text-slate-500">Click to connect</p>
                                    </div>
                                </button>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
}
