/* ─── Listing description ──────────────────────────────────
 *  Seller descriptions are mostly full eBay listing HTML with
 *  their own <style> (incl. body/html/:root rules). They are
 *  sanitized and shown in a sandboxed iframe: no scripts can
 *  run, and their CSS cannot restyle the app. Plain text stays
 *  plain text. Tall descriptions are capped with "Show all".
 * ────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { looksLikeHtml, sanitizeListingDocument } from '../../lib/sanitize';

const COLLAPSED_PX = 480;

/** Base styles inside the frame; the listing's own <style> comes after and wins. */
const FRAME_BASE = `
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font: 14px/1.5 system-ui, -apple-system, "Segoe UI", Arial, sans-serif; color: #334155; overflow-wrap: anywhere; }
  img, video { max-width: 100%; height: auto; }
  table { max-width: 100%; border-collapse: collapse; }
  * { max-width: 100%; box-sizing: border-box; }
`;

function frameDocument(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>${FRAME_BASE}</style></head><body>${sanitizeListingDocument(html)}</body></html>`;
}

function HtmlDescription({ html, title }: { html: string; title: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);
  const [expanded, setExpanded] = useState(false);
  const srcDoc = useMemo(() => frameDocument(html), [html]);

  const measure = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.documentElement) return;
    // body height = content height; documentElement can't shrink below the frame's own height.
    setHeight(Math.max(60, doc.body?.scrollHeight || doc.documentElement.scrollHeight));
  }, []);

  // Re-measure as images inside the listing load or the frame width changes.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let observer: ResizeObserver | null = null;
    const onLoad = () => {
      measure();
      const body = frame.contentDocument?.body;
      if (body && typeof ResizeObserver !== 'undefined') {
        observer?.disconnect();
        observer = new ResizeObserver(measure);
        observer.observe(body);
      }
      frame.contentDocument?.querySelectorAll('img').forEach((img) => img.addEventListener('load', measure));
    };
    frame.addEventListener('load', onLoad);
    return () => {
      frame.removeEventListener('load', onLoad);
      observer?.disconnect();
    };
  }, [measure, srcDoc]);

  const tall = height > COLLAPSED_PX;
  return (
    <div>
      <div className="relative overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700" style={{ height: tall && !expanded ? COLLAPSED_PX : height }}>
        <iframe
          ref={frameRef}
          title={`Description: ${title}`}
          srcDoc={srcDoc}
          // No allow-scripts: nothing in the listing can run. allow-same-origin only
          // lets this page measure the content height; popups let links open in a new tab.
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          loading="lazy"
          className="block w-full border-0 bg-white"
          style={{ height }}
          scrolling="no"
        />
        {tall && !expanded && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent dark:from-slate-900" />}
      </div>
      {tall && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 text-xs font-medium hover:underline" style={{ color: 'var(--brand-primary)' }}>
          {expanded ? 'Show less' : 'Show full description'}
        </button>
      )}
    </div>
  );
}

export default function ListingDescription({ description, title }: { description: string; title: string }) {
  if (looksLikeHtml(description)) return <HtmlDescription html={description} title={title} />;
  return <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">{description.slice(0, 8000)}</p>;
}
