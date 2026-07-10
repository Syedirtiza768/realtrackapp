import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Save, ChevronDown, ChevronUp, Check } from 'lucide-react';
import type { EbayListing } from '../../lib/ebayFileExchangeParser';

interface EditListingPanelProps {
  listing: EbayListing;
  onSave: (updated: EbayListing) => void;
  onCancel: () => void;
}

export default function EditListingPanel({ listing, onSave, onCancel }: EditListingPanelProps) {
  const [draft, setDraft] = useState<EbayListing>(() => ({
    ...listing,
    imageUrls: [...listing.imageUrls],
    itemSpecifics: listing.itemSpecifics.map(s => ({ ...s })),
    compatibility: listing.compatibility.map(c => ({ ...c })),
  }));
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-sync draft when the parent listing changes (e.g. after an external save or navigation)
  const prevListing = useRef(listing);
  useEffect(() => {
    if (prevListing.current !== listing) {
      prevListing.current = listing;
      setDraft({
        ...listing,
        imageUrls: [...listing.imageUrls],
        itemSpecifics: listing.itemSpecifics.map(s => ({ ...s })),
        compatibility: listing.compatibility.map(c => ({ ...c })),
      });
    }
  }, [listing]);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    pricing: true,
    specifics: false,
    images: false,
    fitment: false,
    description: false,
    profiles: false,
  });

  const toggleSection = useCallback((key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const updateField = useCallback((field: keyof EbayListing, value: string) => {
    setDraft(prev => ({ ...prev, [field]: value }));
  }, []);

  const updateSpecific = useCallback((index: number, field: 'label' | 'value', value: string) => {
    setDraft(prev => {
      const specifics = [...prev.itemSpecifics];
      specifics[index] = { ...specifics[index], [field]: value };
      return { ...prev, itemSpecifics: specifics };
    });
  }, []);

  const addSpecific = useCallback(() => {
    setDraft(prev => ({
      ...prev,
      itemSpecifics: [...prev.itemSpecifics, { label: '', value: '' }],
    }));
  }, []);

  const removeSpecific = useCallback((index: number) => {
    setDraft(prev => ({
      ...prev,
      itemSpecifics: prev.itemSpecifics.filter((_, i) => i !== index),
    }));
  }, []);

  const updateCompat = useCallback((index: number, field: 'make' | 'model' | 'year', value: string) => {
    setDraft(prev => {
      const compatibility = [...prev.compatibility];
      compatibility[index] = { ...compatibility[index], [field]: value };
      return { ...prev, compatibility };
    });
  }, []);

  const addCompat = useCallback(() => {
    setDraft(prev => ({
      ...prev,
      compatibility: [...prev.compatibility, { make: '', model: '', year: '' }],
    }));
  }, []);

  const removeCompat = useCallback((index: number) => {
    setDraft(prev => ({
      ...prev,
      compatibility: prev.compatibility.filter((_, i) => i !== index),
    }));
  }, []);

  const updateImageUrl = useCallback((index: number, value: string) => {
    setDraft(prev => {
      const urls = [...prev.imageUrls];
      urls[index] = value;
      return { ...prev, imageUrls: urls };
    });
  }, []);

  const addImageUrl = useCallback(() => {
    setDraft(prev => ({ ...prev, imageUrls: [...prev.imageUrls, ''] }));
  }, []);

  const removeImageUrl = useCallback((index: number) => {
    setDraft(prev => ({ ...prev, imageUrls: prev.imageUrls.filter((_, i) => i !== index) }));
  }, []);

  const handleSave = useCallback(() => {
    onSave(draft);
    setSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 2500);
  }, [draft, onSave]);

  const inputClasses = 'w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-600 dark:text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500';
  const labelClasses = 'block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1';

  function SectionHeader({ title, sectionKey, count }: { title: string; sectionKey: string; count?: number }) {
    const open = expandedSections[sectionKey];
    return (
      <button
        onClick={() => toggleSection(sectionKey)}
        className="w-full flex items-center justify-between py-2 px-1 text-sm font-semibold text-slate-600 dark:text-slate-200 hover:text-white transition-colors"
      >
        <span>{title}{count !== undefined ? ` (${count})` : ''}</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-800 border-l border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm sticky top-0 z-10">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Edit Listing</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-colors ${
              saved ? 'bg-green-600 hover:bg-green-500' : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? 'Saved ✓' : 'Save'}
          </button>
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">

        {/* Basic Info */}
        <SectionHeader title="Basic Info" sectionKey="basic" />
        {expandedSections.basic && (
          <div className="space-y-3 pb-3">
            <div>
              <label className={labelClasses}>Title</label>
              <input className={inputClasses} value={draft.title} onChange={e => updateField('title', e.target.value)} maxLength={80} />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{draft.title.length}/80 characters</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClasses}>Custom Label / SKU</label>
                <input className={inputClasses} value={draft.customLabel} onChange={e => updateField('customLabel', e.target.value)} />
              </div>
              <div>
                <label className={labelClasses}>Category ID</label>
                <input className={inputClasses} value={draft.category} onChange={e => updateField('category', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClasses}>Condition ID</label>
                <input className={inputClasses} value={draft.conditionId} onChange={e => updateField('conditionId', e.target.value)} />
              </div>
              <div>
                <label className={labelClasses}>Condition Label</label>
                <input className={inputClasses} value={draft.conditionLabel} onChange={e => updateField('conditionLabel', e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelClasses}>Location</label>
              <input className={inputClasses} value={draft.location} onChange={e => updateField('location', e.target.value)} />
            </div>
          </div>
        )}

        <div className="border-t border-slate-200 dark:border-slate-700" />

        {/* Pricing */}
        <SectionHeader title="Pricing & Quantity" sectionKey="pricing" />
        {expandedSections.pricing && (
          <div className="space-y-3 pb-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClasses}>Price (USD)</label>
                <input className={inputClasses} value={draft.price} onChange={e => updateField('price', e.target.value)} />
              </div>
              <div>
                <label className={labelClasses}>Quantity</label>
                <input className={inputClasses} value={draft.quantity} onChange={e => updateField('quantity', e.target.value)} />
              </div>
              <div>
                <label className={labelClasses}>Format</label>
                <input className={inputClasses} value={draft.format} onChange={e => updateField('format', e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelClasses}>Duration</label>
              <input className={inputClasses} value={draft.duration} onChange={e => updateField('duration', e.target.value)} />
            </div>
          </div>
        )}

        <div className="border-t border-slate-200 dark:border-slate-700" />

        {/* Part Details / Item Specifics */}
        <SectionHeader title="Item Specifics" sectionKey="specifics" count={draft.itemSpecifics.length} />
        {expandedSections.specifics && (
          <div className="space-y-3 pb-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClasses}>Brand</label>
                <input className={inputClasses} value={draft.brand} onChange={e => updateField('brand', e.target.value)} />
              </div>
              <div>
                <label className={labelClasses}>MPN</label>
                <input className={inputClasses} value={draft.mpn} onChange={e => updateField('mpn', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClasses}>OEM Part Number</label>
                <input className={inputClasses} value={draft.oemPartNumber} onChange={e => updateField('oemPartNumber', e.target.value)} />
              </div>
              <div>
                <label className={labelClasses}>Type</label>
                <input className={inputClasses} value={draft.type} onChange={e => updateField('type', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClasses}>Placement on Vehicle</label>
                <input className={inputClasses} value={draft.placement} onChange={e => updateField('placement', e.target.value)} />
              </div>
              <div>
                <label className={labelClasses}>Material</label>
                <input className={inputClasses} value={draft.material} onChange={e => updateField('material', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClasses}>Features</label>
                <input className={inputClasses} value={draft.features} onChange={e => updateField('features', e.target.value)} />
              </div>
              <div>
                <label className={labelClasses}>Country of Manufacture</label>
                <input className={inputClasses} value={draft.countryOfManufacture} onChange={e => updateField('countryOfManufacture', e.target.value)} />
              </div>
            </div>

            <div className="mt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Custom Specifics</span>
                <button onClick={addSpecific} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              {draft.itemSpecifics.map((spec, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input
                    className={inputClasses + ' flex-1'}
                    placeholder="Label"
                    value={spec.label}
                    onChange={e => updateSpecific(i, 'label', e.target.value)}
                  />
                  <input
                    className={inputClasses + ' flex-1'}
                    placeholder="Value"
                    value={spec.value}
                    onChange={e => updateSpecific(i, 'value', e.target.value)}
                  />
                  <button onClick={() => removeSpecific(i)} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-slate-200 dark:border-slate-700" />

        {/* Images */}
        <SectionHeader title="Images" sectionKey="images" count={draft.imageUrls.length} />
        {expandedSections.images && (
          <div className="space-y-2 pb-3">
            {draft.imageUrls.map((url, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 w-5 text-right">{i + 1}</span>
                <input
                  className={inputClasses + ' flex-1'}
                  value={url}
                  onChange={e => updateImageUrl(i, e.target.value)}
                  placeholder="https://..."
                />
                <button onClick={() => removeImageUrl(i)} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button onClick={addImageUrl} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
              <Plus className="w-3 h-3" /> Add Image URL
            </button>
          </div>
        )}

        <div className="border-t border-slate-200 dark:border-slate-700" />

        {/* Fitment */}
        <SectionHeader title="Vehicle Fitment" sectionKey="fitment" count={draft.compatibility.length} />
        {expandedSections.fitment && (
          <div className="space-y-2 pb-3">
            {draft.compatibility.map((compat, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={inputClasses + ' w-20'} placeholder="Year" value={compat.year} onChange={e => updateCompat(i, 'year', e.target.value)} />
                <input className={inputClasses + ' flex-1'} placeholder="Make" value={compat.make} onChange={e => updateCompat(i, 'make', e.target.value)} />
                <input className={inputClasses + ' flex-1'} placeholder="Model" value={compat.model} onChange={e => updateCompat(i, 'model', e.target.value)} />
                <button onClick={() => removeCompat(i)} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button onClick={addCompat} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
              <Plus className="w-3 h-3" /> Add Fitment
            </button>
          </div>
        )}

        <div className="border-t border-slate-200 dark:border-slate-700" />

        {/* Description */}
        <SectionHeader title="Description (HTML)" sectionKey="description" />
        {expandedSections.description && (
          <div className="pb-3">
            <textarea
              className={inputClasses + ' min-h-[200px] font-mono text-xs'}
              value={draft.description}
              onChange={e => updateField('description', e.target.value)}
            />
          </div>
        )}

        <div className="border-t border-slate-200 dark:border-slate-700" />

        {/* Profiles */}
        <SectionHeader title="Shipping / Return / Payment" sectionKey="profiles" />
        {expandedSections.profiles && (
          <div className="space-y-3 pb-3">
            <div>
              <label className={labelClasses}>Shipping Profile</label>
              <input className={inputClasses} value={draft.shippingProfile} onChange={e => updateField('shippingProfile', e.target.value)} />
            </div>
            <div>
              <label className={labelClasses}>Return Profile</label>
              <input className={inputClasses} value={draft.returnProfile} onChange={e => updateField('returnProfile', e.target.value)} />
            </div>
            <div>
              <label className={labelClasses}>Payment Profile</label>
              <input className={inputClasses} value={draft.paymentProfile} onChange={e => updateField('paymentProfile', e.target.value)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
