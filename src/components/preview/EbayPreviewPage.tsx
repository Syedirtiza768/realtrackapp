import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileText, X, Eye, ChevronLeft, ChevronRight, Search, Image as ImageIcon, AlertTriangle, Pencil, Download, LayoutGrid, List } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { parseEbayFileExchangeCsv, generateEbayFileExchangeCsv, type EbayListing, type ParseResult } from '../../lib/ebayFileExchangeParser';
import EditListingPanel from './EditListingPanel';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ─── Exact eBay Listing Preview ─────────────────────────────────────────────

function EbayListingPreview({ listing }: { listing: EbayListing }) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());
  const descIframeRef = useRef<HTMLIFrameElement>(null);

  const handleImgError = useCallback((idx: number) => {
    setImgErrors(prev => new Set(prev).add(idx));
  }, []);

  // Sanitize description: remove file:// URLs and other local resource references
  const sanitizeDescription = (html: string): string => {
    return html
      // Remove file:// URLs in any attribute
      .replace(/(?:src|href|data|action|poster|background)=["']file:\/\/[^"']*["']/gi, '')
      // Remove Windows-style paths in attributes like P:/ or C:\
      .replace(/(?:src|href|data|action|poster|background)=["'][A-Za-z]:[\\\/][^"']*["']/gi, '')
      // Remove file:// URLs in CSS url()
      .replace(/url\(\s*["']?file:\/\/[^"')]*["']?\s*\)/gi, 'url()')
      // Remove Windows paths in CSS url()
      .replace(/url\(\s*["']?[A-Za-z]:[\\\/][^"')]*["']?\s*\)/gi, 'url()')
      // Remove javascript: URLs
      .replace(/(?:src|href)=["']javascript:[^"']*["']/gi, '')
      // Remove any remaining file:// references (catch-all)
      .replace(/file:\/\/\/[A-Za-z]:[^"'\s<>]*/gi, '#');
  };

  const safeDescription = listing.description ? sanitizeDescription(listing.description) : '';

  // Build the full HTML document for the description iframe using srcdoc
  // Use <base href="about:blank"> to prevent relative URLs from resolving to file://
  const descriptionHtml = safeDescription ? `<!DOCTYPE html>
<html>
<head>
<base href="about:blank">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body {
  margin: 0;
  padding: 20px;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #333;
  background: #fff;
}
img { max-width: 100%; height: auto; }
table { border-collapse: collapse; width: 100%; }
td, th { padding: 8px; border: 1px solid #ddd; }

/* ═══ CSS-only tabs support for eBay descriptions ═══ */
/* Hide radio buttons but keep them functional */
input[type="radio"][name="tab"] {
  position: absolute;
  left: -9999px;
}

/* Default: hide all tab content */
.tab-content {
  display: none;
  padding: 15px;
  border: 1px solid #ddd;
  background: #f9f9f9;
}

/* Show content when corresponding radio is checked */
#tab1:checked ~ .tabs #content1,
#tab1:checked ~ .tab-content:nth-of-type(1),
#tab1:checked ~ * #content1 { display: block; }

#tab2:checked ~ .tabs #content2,
#tab2:checked ~ .tab-content:nth-of-type(2),
#tab2:checked ~ * #content2 { display: block; }

#tab3:checked ~ .tabs #content3,
#tab3:checked ~ .tab-content:nth-of-type(3),
#tab3:checked ~ * #content3 { display: block; }

#tab4:checked ~ .tabs #content4,
#tab4:checked ~ .tab-content:nth-of-type(4),
#tab4:checked ~ * #content4 { display: block; }

#tab5:checked ~ .tabs #content5,
#tab5:checked ~ .tab-content:nth-of-type(5),
#tab5:checked ~ * #content5 { display: block; }

/* Tab label styling */
.tab-labels {
  display: flex;
  flex-wrap: wrap;
  background: #333;
}
.tab-labels label {
  flex: 1;
  text-align: center;
  padding: 10px;
  font-weight: bold;
  cursor: pointer;
  background: #333;
  color: white;
  border-right: 1px solid #444;
  transition: background 0.3s;
}
.tab-labels label:hover {
  background: #444;
}

/* Active tab styling */
#tab1:checked ~ .tab-labels label[for="tab1"],
#tab2:checked ~ .tab-labels label[for="tab2"],
#tab3:checked ~ .tab-labels label[for="tab3"],
#tab4:checked ~ .tab-labels label[for="tab4"],
#tab5:checked ~ .tab-labels label[for="tab5"] {
  background: #fff;
  color: #000;
}
</style>
</head>
<body>${safeDescription}</body>
</html>` : '';

  // Auto-resize iframe after content loads
  useEffect(() => {
    const iframe = descIframeRef.current;
    if (!iframe || !safeDescription) return;

    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument;
        if (doc?.documentElement) {
          const height = doc.documentElement.scrollHeight;
          if (height > 100) {
            iframe.style.height = `${height + 40}px`;
          }
        }
      } catch { /* cross-origin blocked */ }
    };

    iframe.addEventListener('load', handleLoad);
    // Also try after a delay for slow-loading content
    const timer = setTimeout(handleLoad, 500);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      clearTimeout(timer);
    };
  }, [safeDescription]);

  const fallbackSpecifics = [
    { label: 'Condition', value: listing.conditionLabel || 'Used' },
    { label: 'Brand', value: listing.brand },
    { label: 'Type', value: listing.type },
    { label: 'Manufacturer Part Number', value: listing.mpn },
    { label: 'OE/OEM Part Number', value: listing.oemPartNumber },
    { label: 'Placement on Vehicle', value: listing.placement },
    { label: 'Material', value: listing.material },
    { label: 'Features', value: listing.features },
    { label: 'Country/Region of Manufacture', value: listing.countryOfManufacture },
  ].filter((specific) => specific.value);

  const itemSpecifics = [
    { label: 'Condition', value: listing.conditionLabel || 'Used' },
    ...listing.itemSpecifics.filter((specific) => cleanSpecificValue(specific.value)),
  ];

  if (itemSpecifics.length === 1) {
    itemSpecifics.push(...fallbackSpecifics.filter((specific) => specific.label !== 'Condition'));
  }

  // Pair item specifics into rows of 2 (eBay uses a 2-column grid)
  const specPairs: { label: string; value: string }[][] = [];
  for (let i = 0; i < itemSpecifics.length; i += 2) {
    specPairs.push(itemSpecifics.slice(i, i + 2));
  }

  const conditionLabel = listing.conditionLabel || 'Used';

  return (
    <div style={{ fontFamily: "'Market Sans', Arial, Helvetica, sans-serif", background: '#fff', color: '#191919', lineHeight: 1.4 }}>
      {/* ═══ eBay Top Navigation Bar ═══ */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e5e5' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Top links left */}
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#555' }}>
            <span>Hi! <span style={{ color: '#3665f3', cursor: 'pointer' }}>Sign in</span> or <span style={{ color: '#3665f3', cursor: 'pointer' }}>register</span></span>
            <span>Daily Deals</span>
            <span>Help & Contact</span>
          </div>
          {/* Top links right */}
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#555' }}>
            <span>Sell</span>
            <span>Watchlist</span>
            <span>My eBay</span>
            <span>🛒</span>
          </div>
        </div>
      </div>

      {/* ═══ eBay Header with Logo + Search ═══ */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e5e5' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* eBay Logo */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: 0 }}>
            <span style={{ fontSize: 30, fontWeight: 700, fontStyle: 'italic', color: '#e53238', letterSpacing: -1 }}>e</span>
            <span style={{ fontSize: 30, fontWeight: 700, fontStyle: 'italic', color: '#0064d2', letterSpacing: -1 }}>b</span>
            <span style={{ fontSize: 30, fontWeight: 700, fontStyle: 'italic', color: '#f5af02', letterSpacing: -1 }}>a</span>
            <span style={{ fontSize: 30, fontWeight: 700, fontStyle: 'italic', color: '#86b817', letterSpacing: -1 }}>y</span>
          </div>
          {/* Shop by category */}
          <div style={{ fontSize: 13, color: '#555', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Shop by<br />category <span style={{ fontSize: 10 }}>▾</span>
          </div>
          {/* Search bar */}
          <div style={{ flex: 1, display: 'flex', gap: 0 }}>
            <input
              readOnly
              style={{
                flex: 1, height: 40, border: '2px solid #191919', borderRight: 'none', borderRadius: '24px 0 0 24px',
                padding: '0 16px', fontSize: 14, outline: 'none', background: '#fff', color: '#191919'
              }}
              placeholder="Search for anything"
            />
            <div style={{
              width: 200, height: 40, border: '2px solid #191919', borderLeft: '1px solid #ccc', borderRight: 'none',
              display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 13, color: '#555', background: '#fff'
            }}>
              All Categories <span style={{ marginLeft: 'auto', fontSize: 10 }}>▾</span>
            </div>
            <button style={{
              width: 48, height: 40, background: '#3665f3', border: '2px solid #3665f3', borderRadius: '0 24px 24px 0',
              color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              🔍
            </button>
          </div>
          <div style={{ fontSize: 12, color: '#555', whiteSpace: 'nowrap' }}>Advanced</div>
        </div>
      </div>

      {/* ═══ Category Nav Bar ═══ */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e5e5' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px', display: 'flex', gap: 20, fontSize: 13, color: '#555', height: 40, alignItems: 'center', overflow: 'hidden' }}>
          {['eBay Motors', 'Electronics', 'Fashion', 'Home & Garden', 'Collectibles', 'Sporting Goods', 'Toys', 'Business & Industrial', 'Deals'].map(c => (
            <span key={c} style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}>{c}</span>
          ))}
        </div>
      </div>

      {/* ═══ Preview Banner ═══ */}
      <div style={{ background: '#fff3cd', borderBottom: '1px solid #ffc107', padding: '6px 20px', textAlign: 'center', fontSize: 12, color: '#856404' }}>
        ⚠️ PREVIEW MODE — This is how the listing will appear on eBay. Not a live listing.
      </div>

      {/* ═══ Main Content ═══ */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '16px 20px' }}>
        {/* Breadcrumb */}
        <nav style={{ fontSize: 12, color: '#555', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          <a style={{ color: '#3665f3', textDecoration: 'none' }}>eBay</a>
          <span style={{ color: '#aaa' }}>&gt;</span>
          <a style={{ color: '#3665f3', textDecoration: 'none' }}>eBay Motors</a>
          <span style={{ color: '#aaa' }}>&gt;</span>
          <a style={{ color: '#3665f3', textDecoration: 'none' }}>Parts & Accessories</a>
          <span style={{ color: '#aaa' }}>&gt;</span>
          <a style={{ color: '#3665f3', textDecoration: 'none' }}>Car & Truck Parts & Accessories</a>
          {listing.type && (
            <>
              <span style={{ color: '#aaa' }}>&gt;</span>
              <a style={{ color: '#3665f3', textDecoration: 'none' }}>{listing.type}</a>
            </>
          )}
        </nav>

        {/* ═══ Two-Column Layout: Images + Details ═══ */}
        <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>

          {/* ══ LEFT COLUMN: Images ══ */}
          <div style={{ width: '55%', flexShrink: 0, display: 'flex', gap: 12 }}>
            {/* Vertical thumbnail strip */}
            {listing.imageUrls.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 64, flexShrink: 0 }}>
                {listing.imageUrls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    style={{
                      width: 64, height: 64, border: selectedImage === i ? '2px solid #3665f3' : '1px solid #ddd',
                      borderRadius: 8, padding: 2, background: '#fff', cursor: 'pointer', overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      outline: selectedImage === i ? '1px solid #3665f3' : 'none',
                      outlineOffset: 1,
                    }}
                    onMouseEnter={() => setSelectedImage(i)}
                  >
                    {!imgErrors.has(i) ? (
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} onError={() => handleImgError(i)} />
                    ) : (
                      <ImageIcon style={{ width: 20, height: 20, color: '#ccc' }} />
                    )}
                  </button>
                ))}
              </div>
            )}
            {/* Main image */}
            <div style={{
              flex: 1, aspectRatio: '1/1', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative'
            }}>
              {listing.imageUrls[selectedImage] && !imgErrors.has(selectedImage) ? (
                <img
                  src={listing.imageUrls[selectedImage]}
                  alt={listing.title}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  onError={() => handleImgError(selectedImage)}
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#ccc' }}>
                  <ImageIcon style={{ width: 64, height: 64 }} />
                  <div style={{ fontSize: 14, marginTop: 8 }}>No image</div>
                </div>
              )}
              {/* Image counter */}
              <div style={{
                position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.6)', color: '#fff',
                fontSize: 12, padding: '4px 10px', borderRadius: 12
              }}>
                {selectedImage + 1} / {listing.imageUrls.length}
              </div>
            </div>
          </div>

          {/* ══ RIGHT COLUMN: Details ══ */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Title */}
            <h1 style={{ fontSize: 22, fontWeight: 400, color: '#191919', margin: '0 0 8px', lineHeight: 1.3 }}>
              {listing.title}
            </h1>

            {/* SKU / Custom Label */}
            {listing.customLabel && (
              <div style={{ fontSize: 12, color: '#707070', marginBottom: 12 }}>
                Custom label <span style={{ fontWeight: 500 }}>{listing.customLabel}</span>
              </div>
            )}

            {/* Condition */}
            <div style={{ fontSize: 14, color: '#191919', marginBottom: 4 }}>
              <span style={{ color: '#707070' }}>Condition:</span>{' '}
              <span style={{ fontWeight: 600 }}>{conditionLabel}</span>
            </div>

            {/* Quantity */}
            {parseInt(listing.quantity) > 1 && (
              <div style={{ fontSize: 14, color: '#707070', marginBottom: 12 }}>
                Quantity: <span style={{ color: '#191919' }}>{listing.quantity} available</span>
              </div>
            )}

            {/* ── Price Block ── */}
            <div style={{ marginTop: 12, marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #e5e5e5' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#191919' }}>Price:</span>
                <span style={{ fontSize: 24, fontWeight: 700, color: '#191919' }}>
                  US ${parseFloat(listing.price || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {listing.format === 'FixedPrice' && (
                <div style={{ fontSize: 12, color: '#707070' }}>Buy It Now</div>
              )}
            </div>

            {/* ── Buy It Now Button ── */}
            <button style={{
              width: '100%', height: 48, background: '#3665f3', color: '#fff', border: 'none', borderRadius: 24,
              fontSize: 16, fontWeight: 700, cursor: 'default', marginBottom: 10,
              fontFamily: "'Market Sans', Arial, sans-serif",
            }}>
              Buy It Now
            </button>

            {/* Add to cart */}
            <button style={{
              width: '100%', height: 48, background: '#fff', color: '#3665f3', border: '1px solid #3665f3', borderRadius: 24,
              fontSize: 16, fontWeight: 700, cursor: 'default', marginBottom: 10,
              fontFamily: "'Market Sans', Arial, sans-serif",
            }}>
              Add to cart
            </button>

            {/* Add to watchlist */}
            <button style={{
              width: '100%', height: 48, background: '#fff', color: '#191919', border: '1px solid #191919', borderRadius: 24,
              fontSize: 14, fontWeight: 600, cursor: 'default', marginBottom: 20,
              fontFamily: "'Market Sans', Arial, sans-serif",
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 18 }}>♡</span> Add to Watchlist
            </button>

            {/* ── Shipping & Delivery ── */}
            <div style={{ borderTop: '1px solid #e5e5e5', paddingTop: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 18, flexShrink: 0, width: 24, textAlign: 'center' }}>🚚</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#191919' }}>Shipping:</div>
                  <div style={{ fontSize: 13, color: '#707070' }}>{listing.shippingProfile || 'See listing details'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 18, flexShrink: 0, width: 24, textAlign: 'center' }}>📍</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#191919' }}>Located in:</div>
                  <div style={{ fontSize: 13, color: '#707070' }}>{listing.location}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 18, flexShrink: 0, width: 24, textAlign: 'center' }}>↩️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#191919' }}>Returns:</div>
                  <div style={{ fontSize: 13, color: '#707070' }}>{listing.returnProfile || 'See listing details'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 18, flexShrink: 0, width: 24, textAlign: 'center' }}>💳</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#191919' }}>Payments:</div>
                  <div style={{ fontSize: 13, color: '#707070' }}>{listing.paymentProfile || 'See listing details'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* BELOW THE FOLD: About this item / Item specifics / Compatibility / Description */}
        {/* ═══════════════════════════════════════════════════════════════ */}

        <div style={{ marginTop: 40, borderTop: '1px solid #e5e5e5', paddingTop: 32 }}>

          {/* ── About this item ── */}
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#191919', marginBottom: 24 }}>About this item</h2>

          {/* ── Item Specifics (2-column grid like real eBay) ── */}
          {itemSpecifics.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#191919', marginBottom: 16 }}>Item specifics</h3>
              <div style={{ border: '1px solid #e5e5e5', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <tbody>
                    {specPairs.map((pair, rowIdx) => (
                      <tr key={rowIdx} style={{ background: rowIdx % 2 === 0 ? '#f7f7f7' : '#fff' }}>
                        <td style={{
                          padding: '12px 16px', color: '#707070', fontWeight: 400, width: '18%',
                          borderBottom: rowIdx < specPairs.length - 1 ? '1px solid #e5e5e5' : 'none',
                          borderRight: '1px solid #e5e5e5', verticalAlign: 'top',
                        }}>
                          {pair[0].label}
                        </td>
                        <td style={{
                          padding: '12px 16px', color: '#191919', fontWeight: 600, width: '32%',
                          borderBottom: rowIdx < specPairs.length - 1 ? '1px solid #e5e5e5' : 'none',
                          borderRight: '1px solid #e5e5e5', verticalAlign: 'top',
                        }}>
                          {pair[0].value}
                        </td>
                        {pair[1] ? (
                          <>
                            <td style={{
                              padding: '12px 16px', color: '#707070', fontWeight: 400, width: '18%',
                              borderBottom: rowIdx < specPairs.length - 1 ? '1px solid #e5e5e5' : 'none',
                              borderRight: '1px solid #e5e5e5', verticalAlign: 'top',
                            }}>
                              {pair[1].label}
                            </td>
                            <td style={{
                              padding: '12px 16px', color: '#191919', fontWeight: 600, width: '32%',
                              borderBottom: rowIdx < specPairs.length - 1 ? '1px solid #e5e5e5' : 'none',
                              verticalAlign: 'top',
                            }}>
                              {pair[1].value}
                            </td>
                          </>
                        ) : (
                          <td colSpan={2} style={{
                            borderBottom: rowIdx < specPairs.length - 1 ? '1px solid #e5e5e5' : 'none',
                          }} />
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Vehicle Compatibility / Motor Vehicle Fitment ── */}
          {listing.compatibility.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#191919', marginBottom: 4 }}>
                Motor Vehicle Fitment
              </h3>
              <p style={{ fontSize: 13, color: '#707070', marginBottom: 16 }}>
                This part fits {listing.compatibility.length} vehicle{listing.compatibility.length !== 1 ? 's' : ''}
              </p>
              <div style={{ border: '1px solid #e5e5e5', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: '#191919' }}>
                      <th style={{ padding: '10px 16px', color: '#fff', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>Year</th>
                      <th style={{ padding: '10px 16px', color: '#fff', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>Make</th>
                      <th style={{ padding: '10px 16px', color: '#fff', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>Model</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listing.compatibility.map((compat, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f7f7f7' }}>
                        <td style={{ padding: '10px 16px', borderBottom: '1px solid #e5e5e5', color: '#191919' }}>{compat.year}</td>
                        <td style={{ padding: '10px 16px', borderBottom: '1px solid #e5e5e5', color: '#191919' }}>{compat.make}</td>
                        <td style={{ padding: '10px 16px', borderBottom: '1px solid #e5e5e5', color: '#191919' }}>{compat.model}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Item Description ── */}
          {safeDescription && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#191919', marginBottom: 16 }}>Item description from the seller</h3>
              <div style={{ border: '1px solid #e5e5e5', borderRadius: 12, overflow: 'hidden' }}>
                <iframe
                  ref={descIframeRef}
                  srcDoc={descriptionHtml}
                  style={{ width: '100%', border: 'none', minHeight: 500, display: 'block' }}
                  title="Seller's item description"
                  sandbox="allow-same-origin allow-forms"
                />
              </div>
            </div>
          )}

        </div>

        {/* ═══ eBay Footer ═══ */}
        <div style={{ borderTop: '1px solid #e5e5e5', paddingTop: 24, marginTop: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#707070', lineHeight: 2 }}>
            <span style={{ cursor: 'pointer' }}>About eBay</span>
            {' | '}
            <span style={{ cursor: 'pointer' }}>Announcements</span>
            {' | '}
            <span style={{ cursor: 'pointer' }}>Community</span>
            {' | '}
            <span style={{ cursor: 'pointer' }}>Security Center</span>
            {' | '}
            <span style={{ cursor: 'pointer' }}>Seller Center</span>
            {' | '}
            <span style={{ cursor: 'pointer' }}>Policies</span>
            {' | '}
            <span style={{ cursor: 'pointer' }}>Affiliates</span>
            {' | '}
            <span style={{ cursor: 'pointer' }}>Help & Contact</span>
            {' | '}
            <span style={{ cursor: 'pointer' }}>Site Map</span>
          </div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 8, paddingBottom: 20 }}>
            Copyright © 1995-2026 eBay Inc. All Rights Reserved.
          </div>
        </div>
      </div>
    </div>
  );
}

function cleanSpecificValue(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

// ─── Main Preview Page ──────────────────────────────────────────────────────

export default function EbayPreviewPage() {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'single' | 'grid' | 'list'>('single');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [hasEdits, setHasEdits] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const name = file.name.toLowerCase();
    const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls');
    const isCsv = name.endsWith('.csv') || file.type === 'text/csv';
    if (!isXlsx && !isCsv) return;

    setFileName(file.name);
    setFileSize(file.size);
    const reader = new FileReader();

    if (isXlsx) {
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result;
          if (!buffer) return;
          const workbook = XLSX.read(buffer, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
          console.log('[eBay Preview] XLSX→CSV length:', csv.length);
          const result = parseEbayFileExchangeCsv(csv);
          console.log('[eBay Preview] Result:', result.listings.length, 'listings,', result.skippedListings.length, 'skipped,', result.totalRows, 'rows');
          setParseResult(result);
          setSelectedIndex(0);
          setSearchQuery('');
        } catch (err) {
          console.error('[eBay Preview] Parse error:', err);
          setParseResult({ listings: [], skippedListings: [], warnings: [], totalRows: 0, compatibilityRows: 0, errors: [`Parse error: ${err}`], rawHeaders: [], metadataRows: [] });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          if (!text) return;
          console.log('[eBay Preview] CSV text length:', text.length, 'first 120:', text.slice(0, 120));
          const result = parseEbayFileExchangeCsv(text);
          console.log('[eBay Preview] Result:', result.listings.length, 'listings,', result.skippedListings.length, 'skipped,', result.totalRows, 'rows');
          setParseResult(result);
          setSelectedIndex(0);
          setSearchQuery('');
        } catch (err) {
          console.error('[eBay Preview] Parse error:', err);
          setParseResult({ listings: [], skippedListings: [], warnings: [], totalRows: 0, compatibilityRows: 0, errors: [`Parse error: ${err}`], rawHeaders: [], metadataRows: [] });
        }
      };
      reader.readAsText(file);
    }
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
    setEditingIndex(null);
    setHasEdits(false);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleSaveListing = useCallback((updated: EbayListing) => {
    if (!parseResult || editingIndex === null) return;
    // Use customLabel as stable ID; fall back to filtered position index
    const filteredListing = filteredListings[editingIndex];
    const stableId = filteredListing?.customLabel;
    const realIndex = stableId
      ? parseResult.listings.findIndex(l => l.customLabel === stableId)
      : editingIndex;
    if (realIndex === -1) return;
    const newListings = [...parseResult.listings];
    newListings[realIndex] = updated;
    setParseResult({ ...parseResult, listings: newListings });
    // Keep the panel open so the user can see the change confirmed in-panel
    setHasEdits(true);

    // Sync to catalog backend (fire-and-forget, non-blocking)
    if (stableId) {
      fetch(`/api/catalog-products/by-sku/${encodeURIComponent(stableId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: updated.title,
          description: updated.description,
          brand: updated.brand,
          mpn: updated.mpn,
          oemPartNumber: updated.oemPartNumber,
          partType: updated.type,
          placement: updated.placement,
          material: updated.material,
          features: updated.features,
          price: updated.price ? parseFloat(updated.price) : undefined,
          quantity: updated.quantity ? parseInt(updated.quantity, 10) : undefined,
          conditionId: updated.conditionId,
          imageUrls: updated.imageUrls,
          fitmentData: updated.compatibility?.map((f: { make: string; model: string; year: string }) => ({
            make: f.make, model: f.model, year: f.year,
          })),
        }),
      }).catch(() => { /* catalog sync is best-effort */ });
    }
  }, [parseResult, editingIndex, filteredListings]);

  const handleDownloadCsv = useCallback(() => {
    if (!parseResult) return;
    const allListings = [...parseResult.listings, ...parseResult.skippedListings];
    const csv = generateEbayFileExchangeCsv(allListings, parseResult.rawHeaders, parseResult.metadataRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const baseName = fileName.replace(/\.[^.]+$/, '');
    a.href = url;
    a.download = `${baseName}-edited.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [parseResult, fileName]);

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
                accept=".csv,.xlsx,.xls,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
                className="hidden"
              />
              <Eye className="h-12 w-12 text-slate-400 mb-4" />
              <p className="text-slate-300 text-sm font-medium">
                Drag & drop a pipeline output CSV or Excel file, or click to browse
              </p>
              <p className="text-slate-500 text-xs mt-2">
                Supports eBay File Exchange format — CSV or XLSX
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
              {fileName} · {formatBytes(fileSize)} · {parseResult.listings.length} listing{parseResult.listings.length !== 1 ? 's' : ''}{parseResult.skippedListings.length > 0 ? ` · ${parseResult.skippedListings.length} skipped` : ''} · {parseResult.compatibilityRows} fitment rows
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadCsv}
            className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
          <button
            onClick={handleReset}
            className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <X className="w-4 h-4" />
            Clear & Upload New
          </button>
        </div>
      </div>

      {/* Edit / Download bar */}
      {hasEdits && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-amber-300 font-medium">
                Listings have been modified. Download the updated output file.
              </p>
              <button
                onClick={handleDownloadCsv}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Edited CSV
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warnings / Skipped rows */}
      {parseResult.warnings.length > 0 && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-300 mb-1">
                  {parseResult.skippedListings.length > 0
                    ? `${parseResult.skippedListings.length} invalid row${parseResult.skippedListings.length !== 1 ? 's' : ''} skipped`
                    : `${parseResult.warnings.length} warning${parseResult.warnings.length !== 1 ? 's' : ''}`}
                </p>
                <ul className="text-xs text-slate-400 space-y-0.5">
                  {parseResult.warnings.map((w, i) => (
                    <li key={i}>
                      Row {w.rowIndex}: <span className="text-slate-300">{w.customLabel || '(no SKU)'}</span> — {w.issues.join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-9 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSelectedIndex(0); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
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
                className={`px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <List className="w-3.5 h-3.5" /> List
              </button>
            </div>

            {/* Nav */}
            {viewMode === 'single' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditingIndex(editingIndex !== null ? null : selectedIndex); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    editingIndex !== null
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
                  }`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {editingIndex !== null ? 'Editing' : 'Edit'}
                </button>
                <button
                  onClick={() => { const newIdx = Math.max(0, selectedIndex - 1); setSelectedIndex(newIdx); if (editingIndex !== null) setEditingIndex(newIdx); }}
                  disabled={selectedIndex === 0}
                  className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-300 min-w-[80px] text-center">
                  {filteredListings.length > 0 ? `${selectedIndex + 1} / ${filteredListings.length}` : '0 / 0'}
                </span>
                <button
                  onClick={() => { const newIdx = Math.min(filteredListings.length - 1, selectedIndex + 1); setSelectedIndex(newIdx); if (editingIndex !== null) setEditingIndex(newIdx); }}
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
          <div className="flex gap-4">
            <div className={`rounded-xl overflow-hidden border border-slate-700 shadow-2xl ${editingIndex !== null ? 'flex-1 min-w-0' : 'w-full'}`}>
              <EbayListingPreview listing={currentListing} key={selectedIndex} />
            </div>
            {editingIndex !== null && currentListing && (
              <div className="w-[420px] flex-shrink-0 rounded-xl overflow-hidden border border-slate-700 shadow-2xl" style={{ maxHeight: 'calc(100vh - 200px)', position: 'sticky', top: 16 }}>
                <EditListingPanel
                  listing={currentListing}
                  key={`edit-${selectedIndex}`}
                  onSave={handleSaveListing}
                  onCancel={() => setEditingIndex(null)}
                />
              </div>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center space-y-2">
              {searchQuery ? (
                <>
                  <p className="text-slate-400">No listings match <span className="text-slate-200">&ldquo;{searchQuery}&rdquo;</span>.</p>
                  <button onClick={() => { setSearchQuery(''); setSelectedIndex(0); }} className="text-sm text-blue-400 hover:underline">Clear search</button>
                </>
              ) : (
                <>
                  <p className="text-slate-400">
                    {parseResult && parseResult.skippedListings.length > 0
                      ? `All ${parseResult.skippedListings.length} rows were skipped — check the warnings above.`
                      : 'No listings were found in this file.'}
                  </p>
                  {parseResult && (
                    <p className="text-xs text-slate-500 mt-3">
                      Rows parsed: {parseResult.totalRows} · Compatibility: {parseResult.compatibilityRows} · Skipped: {parseResult.skippedListings.length}
                      {parseResult.errors.length > 0 && <span className="text-red-400"> · Errors: {parseResult.errors.join(', ')}</span>}
                    </p>
                  )}
                  <p className="text-xs text-slate-600 mt-1">Open browser DevTools (F12 → Console) for detailed parse diagnostics</p>
                </>
              )}
            </CardContent>
          </Card>
        )
      ) : viewMode === 'grid' ? (
        /* ── Compact Grid view ── */
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {filteredListings.length === 0 && (
            <div className="col-span-full text-center py-16 text-slate-400">
              {searchQuery ? (
                <span>No listings match &ldquo;{searchQuery}&rdquo;. <button onClick={() => { setSearchQuery(''); setSelectedIndex(0); }} className="text-blue-400 hover:underline">Clear search</button></span>
              ) : parseResult && parseResult.skippedListings.length > 0
                ? `All ${parseResult.skippedListings.length} rows were skipped — check the warnings above.`
                : 'No listings were found in this file.'}
            </div>
          )}
          {filteredListings.map((listing, i) => (
            <div
              key={i}
              onClick={() => { setSelectedIndex(i); setViewMode('single'); }}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
            >
              <div className="h-28 bg-gray-50 flex items-center justify-center overflow-hidden">
                {listing.imageUrls[0] ? (
                  <img src={listing.imageUrls[0]} alt={listing.title} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-gray-300" />
                )}
              </div>
              <div className="p-2">
                <p className="text-xs text-gray-900 font-medium line-clamp-2 leading-snug mb-1">{listing.title}</p>
                <p className="text-sm font-bold text-gray-900">
                  US ${parseFloat(listing.price || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  <span className="text-xs text-gray-400">{listing.conditionLabel || 'Used'}</span>
                  {listing.brand && <><span className="text-gray-300">·</span><span className="text-xs text-gray-400 truncate max-w-[60px]">{listing.brand}</span></>}
                  {listing.compatibility.length > 0 && <><span className="text-gray-300">·</span><span className="text-xs text-gray-400">{listing.compatibility.length}f</span></>}
                </div>
                {listing.customLabel && <p className="text-xs text-gray-300 mt-0.5 truncate">{listing.customLabel}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── List view ── */
        <div className="rounded-xl border border-slate-700 overflow-hidden">
          {/* Header */}
          <div className="grid bg-slate-800 border-b border-slate-700 px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider" style={{ gridTemplateColumns: '48px 1fr 130px 90px 110px 110px 70px' }}>
            <div />
            <div className="pl-2">Title</div>
            <div>SKU</div>
            <div>Price</div>
            <div>Condition</div>
            <div>Brand</div>
            <div>Fitments</div>
          </div>
          {filteredListings.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              {searchQuery ? (
                <span>No listings match &ldquo;{searchQuery}&rdquo;. <button onClick={() => { setSearchQuery(''); setSelectedIndex(0); }} className="text-blue-400 hover:underline">Clear search</button></span>
              ) : parseResult && parseResult.skippedListings.length > 0
                ? `All ${parseResult.skippedListings.length} rows were skipped — check the warnings above.`
                : 'No listings were found in this file.'}
            </div>
          )}
          {filteredListings.map((listing, i) => (
            <div
              key={i}
              onClick={() => { setSelectedIndex(i); setViewMode('single'); }}
              className="grid items-center px-3 py-1.5 border-b border-slate-700/60 cursor-pointer hover:bg-slate-700/40 transition-colors last:border-b-0"
              style={{ gridTemplateColumns: '48px 1fr 130px 90px 110px 110px 70px' }}
            >
              {/* Thumb */}
              <div className="w-10 h-10 rounded overflow-hidden bg-slate-700 flex items-center justify-center flex-shrink-0">
                {listing.imageUrls[0] ? (
                  <img src={listing.imageUrls[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-slate-500" />
                )}
              </div>
              {/* Title */}
              <div className="pl-2 min-w-0">
                <p className="text-sm text-slate-200 truncate">{listing.title}</p>
              </div>
              {/* SKU */}
              <div className="text-xs text-slate-400 truncate pr-2">{listing.customLabel || '—'}</div>
              {/* Price */}
              <div className="text-sm font-semibold text-slate-100">
                US ${parseFloat(listing.price || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {/* Condition */}
              <div className="text-xs text-slate-400 truncate">{listing.conditionLabel || 'Used'}</div>
              {/* Brand */}
              <div className="text-xs text-slate-400 truncate">{listing.brand || '—'}</div>
              {/* Fitments */}
              <div className="text-xs text-slate-400">{listing.compatibility.length > 0 ? listing.compatibility.length : '—'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
