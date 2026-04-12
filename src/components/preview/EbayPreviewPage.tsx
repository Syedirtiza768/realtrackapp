import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, X, Eye, ChevronLeft, ChevronRight, Search, Package, Image as ImageIcon, ShieldCheck, Tag, MapPin, Truck, RotateCcw, CreditCard, Info, Grid3X3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { parseEbayFileExchangeCsv, type EbayListing, type ParseResult } from '../../lib/ebayFileExchangeParser';
import DOMPurify from 'dompurify';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatPrice(price: string): string {
  const num = parseFloat(price);
  if (isNaN(num)) return price;
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// ─── eBay Listing Preview Card ──────────────────────────────────────────────

function EbayListingPreview({ listing }: { listing: EbayListing }) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());
  const [showDescription, setShowDescription] = useState(false);

  const validImages = listing.imageUrls.filter((_, i) => !imgErrors.has(i));
  const currentImageUrl = listing.imageUrls[selectedImage];

  const handleImgError = useCallback((idx: number) => {
    setImgErrors(prev => new Set(prev).add(idx));
  }, []);

  const itemSpecifics = [
    { label: 'Brand', value: listing.brand },
    { label: 'Type', value: listing.type },
    { label: 'Manufacturer Part Number', value: listing.mpn },
    { label: 'OE/OEM Part Number', value: listing.oemPartNumber },
    { label: 'Placement on Vehicle', value: listing.placement },
    { label: 'Material', value: listing.material },
    { label: 'Features', value: listing.features },
    { label: 'Country/Region of Manufacture', value: listing.countryOfManufacture },
  ].filter(s => s.value);

  const sanitizedDescription = DOMPurify.sanitize(listing.description, {
    ADD_TAGS: ['style'],
    ADD_ATTR: ['class', 'style', 'id', 'for', 'name', 'type', 'checked'],
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* eBay-style header bar */}
      <div className="bg-[#f7f7f7] border-b border-gray-200 px-4 py-2 flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 mx-4 bg-white rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-500 flex items-center gap-2">
          <Search className="w-3 h-3" />
          <span>ebay.com/itm/{listing.customLabel || '...'}</span>
        </div>
      </div>

      {/* eBay top bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1200px] mx-auto px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold italic text-[#e53238]">e</span>
            <span className="text-2xl font-bold italic text-[#0064d2]">b</span>
            <span className="text-2xl font-bold italic text-[#f5af02]">a</span>
            <span className="text-2xl font-bold italic text-[#86b817]">y</span>
          </div>
          <div className="text-xs text-gray-400">Preview Mode — Not a live listing</div>
        </div>
      </div>

      {/* Main content area */}
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        {/* Breadcrumb */}
        <div className="text-xs text-[#0654ba] mb-4 flex items-center gap-1">
          <span>eBay Motors</span>
          <span className="text-gray-400">›</span>
          <span>Parts & Accessories</span>
          <span className="text-gray-400">›</span>
          <span>Car & Truck Parts & Accessories</span>
          {listing.type && (
            <>
              <span className="text-gray-400">›</span>
              <span>{listing.type}</span>
            </>
          )}
        </div>

        <div className="flex gap-8">
          {/* Left: Images */}
          <div className="flex-shrink-0 w-[480px]">
            {/* Main image */}
            <div className="w-full aspect-square bg-gray-50 rounded-lg border border-gray-200 overflow-hidden flex items-center justify-center mb-3">
              {currentImageUrl && !imgErrors.has(selectedImage) ? (
                <img
                  src={currentImageUrl}
                  alt={listing.title}
                  className="max-w-full max-h-full object-contain"
                  onError={() => handleImgError(selectedImage)}
                />
              ) : (
                <div className="text-gray-300 flex flex-col items-center gap-2">
                  <ImageIcon className="w-16 h-16" />
                  <span className="text-sm">No image available</span>
                </div>
              )}
            </div>
            {/* Thumbnails */}
            {listing.imageUrls.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {listing.imageUrls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden ${
                      selectedImage === i ? 'border-[#0654ba]' : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {!imgErrors.has(i) ? (
                      <img
                        src={url}
                        alt={`Thumbnail ${i + 1}`}
                        className="w-full h-full object-cover"
                        onError={() => handleImgError(i)}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-gray-300" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
            <div className="text-xs text-gray-400 mt-1">
              {validImages.length} image{validImages.length !== 1 ? 's' : ''} total
            </div>
          </div>

          {/* Right: Details */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h1 className="text-[22px] font-normal text-gray-900 leading-tight mb-2">
              {listing.title}
            </h1>

            {/* Condition badge */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-600">
                Condition: <span className="font-medium text-gray-900">{listing.conditionLabel || 'Used'}</span>
              </span>
              {listing.customLabel && (
                <span className="text-xs text-gray-400">SKU: {listing.customLabel}</span>
              )}
            </div>

            {/* Price */}
            <div className="mb-4">
              <div className="text-[28px] font-bold text-gray-900">
                {formatPrice(listing.price)}
              </div>
              <div className="text-sm text-gray-500 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" />
                {listing.format === 'FixedPrice' ? 'Buy It Now' : listing.format}
                {listing.duration === 'GTC' && <span className="text-gray-400 ml-1">· Good 'Til Cancelled</span>}
              </div>
            </div>

            {/* Quantity */}
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              <Package className="w-4 h-4" />
              <span>Quantity: {listing.quantity} available</span>
            </div>

            {/* Buy / Cart buttons (visual only) */}
            <div className="flex gap-3 mb-6">
              <button className="flex-1 bg-[#3665f3] text-white font-bold py-3 rounded-full text-sm hover:bg-[#2d55cc] transition-colors cursor-default">
                Buy It Now
              </button>
              <button className="flex-1 border-2 border-[#3665f3] text-[#3665f3] font-bold py-3 rounded-full text-sm hover:bg-blue-50 transition-colors cursor-default">
                Add to cart
              </button>
            </div>

            {/* Shipping / Returns / Payment info */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-3 mb-6">
              {listing.shippingProfile && (
                <div className="flex items-start gap-3 text-sm">
                  <Truck className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-gray-700 font-medium">Shipping</div>
                    <div className="text-gray-500 text-xs">{listing.shippingProfile}</div>
                  </div>
                </div>
              )}
              {listing.returnProfile && (
                <div className="flex items-start gap-3 text-sm">
                  <RotateCcw className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-gray-700 font-medium">Returns</div>
                    <div className="text-gray-500 text-xs">{listing.returnProfile}</div>
                  </div>
                </div>
              )}
              {listing.paymentProfile && (
                <div className="flex items-start gap-3 text-sm">
                  <CreditCard className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-gray-700 font-medium">Payments</div>
                    <div className="text-gray-500 text-xs">{listing.paymentProfile}</div>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-gray-700 font-medium">Located in</div>
                  <div className="text-gray-500 text-xs">{listing.location || 'Not specified'}</div>
                </div>
              </div>
            </div>

            {/* Item Specifics */}
            {itemSpecifics.length > 0 && (
              <div className="mb-6">
                <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#0654ba]" />
                  Item specifics
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  {itemSpecifics.map((spec) => (
                    <div key={spec.label} className="flex text-sm">
                      <span className="text-gray-500 w-[180px] flex-shrink-0">{spec.label}</span>
                      <span className="text-gray-900 font-medium">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Compatibility / Fitment */}
            {listing.compatibility.length > 0 && (
              <div className="mb-6">
                <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#0654ba]" />
                  Vehicle Compatibility ({listing.compatibility.length})
                </h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-3 py-2 text-gray-600 font-semibold">Make</th>
                        <th className="text-left px-3 py-2 text-gray-600 font-semibold">Model</th>
                        <th className="text-left px-3 py-2 text-gray-600 font-semibold">Year</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listing.compatibility.map((compat, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-1.5 text-gray-800">{compat.make}</td>
                          <td className="px-3 py-1.5 text-gray-800">{compat.model}</td>
                          <td className="px-3 py-1.5 text-gray-800">{compat.year}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description section */}
        <div className="mt-8 border-t border-gray-200 pt-6">
          <button
            onClick={() => setShowDescription(!showDescription)}
            className="flex items-center gap-2 text-base font-bold text-gray-900 mb-4 cursor-pointer hover:text-[#0654ba] transition-colors"
          >
            <Grid3X3 className="w-4 h-4" />
            Item Description
            <ChevronRight className={`w-4 h-4 transition-transform ${showDescription ? 'rotate-90' : ''}`} />
          </button>
          {showDescription && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <iframe
                srcDoc={`
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <style>
                      body { margin: 0; padding: 16px; font-family: Arial, sans-serif; font-size: 14px; color: #333; background: #fff; }
                      img { max-width: 100%; height: auto; }
                    </style>
                  </head>
                  <body>${sanitizedDescription}</body>
                  </html>
                `}
                className="w-full border-0"
                style={{ minHeight: '400px' }}
                title="Item description"
                sandbox="allow-same-origin"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Preview Page ──────────────────────────────────────────────────────

export default function EbayPreviewPage() {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'single' | 'grid'>('single');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') return;

    setFileName(file.name);
    setFileSize(file.size);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        const result = parseEbayFileExchangeCsv(text);
        setParseResult(result);
        setSelectedIndex(0);
        setSearchQuery('');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const filteredListings = parseResult?.listings.filter(l =>
    !searchQuery || l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.customLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.brand.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  const currentListing = filteredListings[selectedIndex];

  const handleReset = useCallback(() => {
    setParseResult(null);
    setFileName('');
    setFileSize(0);
    setSelectedIndex(0);
    setSearchQuery('');
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  // ─── Upload screen ─────────────────────────────────────────────────

  if (!parseResult) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Eye className="h-6 w-6 text-blue-400" />
          <div>
            <h1 className="text-xl font-bold text-slate-100">eBay Listing Preview</h1>
            <p className="text-sm text-slate-400">Upload a pipeline output CSV to preview exactly how listings will appear on eBay</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-400" />
              Upload Pipeline Output CSV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
              onClick={() => inputRef.current?.click()}
              className={`
                relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12
                transition-all cursor-pointer
                ${dragOver ? 'border-blue-400 bg-blue-400/10' : 'border-slate-600 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800'}
              `}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
                className="hidden"
              />
              <Eye className="h-12 w-12 text-slate-400 mb-4" />
              <p className="text-slate-300 text-sm font-medium">
                Drag & drop a pipeline output CSV, or click to browse
              </p>
              <p className="text-slate-500 text-xs mt-2">
                Supports eBay File Exchange format CSV files from the enrichment pipeline
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium text-slate-300 mb-2">How it works</h3>
            <ol className="text-sm text-slate-400 space-y-1.5 list-decimal list-inside">
              <li>Run your enrichment pipeline to generate the output CSV</li>
              <li>Upload the CSV file here (or drag and drop it)</li>
              <li>Browse each listing with an exact eBay-style preview</li>
              <li>Review images, item specifics, description, fitment data and policies</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Preview screen ─────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Eye className="h-6 w-6 text-blue-400" />
          <div>
            <h1 className="text-xl font-bold text-slate-100">eBay Listing Preview</h1>
            <p className="text-xs text-slate-400">
              <FileText className="w-3 h-3 inline mr-1" />
              {fileName} · {formatBytes(fileSize)} · {parseResult.listings.length} listing{parseResult.listings.length !== 1 ? 's' : ''} · {parseResult.compatibilityRows} fitment rows
            </p>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
        >
          <X className="w-4 h-4" />
          Clear & Upload New
        </button>
      </div>

      {/* Search + Navigation bar */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search listings by title, SKU, or brand..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSelectedIndex(0); }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* View toggle */}
            <div className="flex items-center border border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('single')}
                className={`px-3 py-2 text-xs font-medium transition-colors ${viewMode === 'single' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Single
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 text-xs font-medium transition-colors ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Grid
              </button>
            </div>

            {/* Nav */}
            {viewMode === 'single' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
                  disabled={selectedIndex === 0}
                  className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-300 min-w-[80px] text-center">
                  {filteredListings.length > 0 ? `${selectedIndex + 1} / ${filteredListings.length}` : '0 / 0'}
                </span>
                <button
                  onClick={() => setSelectedIndex(Math.min(filteredListings.length - 1, selectedIndex + 1))}
                  disabled={selectedIndex >= filteredListings.length - 1}
                  className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {viewMode === 'single' ? (
        currentListing ? (
          <EbayListingPreview listing={currentListing} key={selectedIndex} />
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-slate-400">No listings match your search.</p>
            </CardContent>
          </Card>
        )
      ) : (
        /* Grid view */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredListings.length === 0 && (
            <div className="col-span-full text-center py-16 text-slate-400">No listings match your search.</div>
          )}
          {filteredListings.map((listing, i) => (
            <div
              key={i}
              onClick={() => { setSelectedIndex(i); setViewMode('single'); }}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
            >
              {/* Image */}
              <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden">
                {listing.imageUrls[0] ? (
                  <img src={listing.imageUrls[0]} alt={listing.title} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-12 h-12 text-gray-300" />
                )}
              </div>
              {/* Info */}
              <div className="p-3">
                <p className="text-sm text-gray-900 font-medium line-clamp-2 leading-snug mb-1">
                  {listing.title}
                </p>
                <p className="text-lg font-bold text-gray-900">{formatPrice(listing.price)}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <span>{listing.conditionLabel || 'Used'}</span>
                  <span>·</span>
                  <span>{listing.brand}</span>
                  {listing.compatibility.length > 0 && (
                    <>
                      <span>·</span>
                      <span>{listing.compatibility.length} fitments</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1 truncate">{listing.customLabel}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
