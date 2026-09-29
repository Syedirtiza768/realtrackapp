import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleAlert,
  CircleCheck,
  Menu,
  Minus,
  Plus,
  Store,
  X,
} from 'lucide-react';
import { useEffect, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useBranding } from '../../contexts/BrandingContext';
import { toProxyUrl } from '../../lib/imageUrl';

type StageId = 'intake' | 'enrich' | 'review' | 'publish';

type IndustryStory = {
  number: string;
  name: string;
  eyebrow: string;
  headline: string;
  body: string;
  details: string[];
  path: string;
  image: string;
  alt: string;
};

const HEADLAMP_IMAGE = '/landing/omni-core-headlamp.webp';
const INDUSTRIAL_IMAGE = '/landing/omni-core-industrial-component.webp';
const FASHION_IMAGE = '/landing/omni-core-fashion-jacket.webp';

const stages: Array<{ id: StageId; label: string; number: string }> = [
  { id: 'intake', label: 'Intake', number: '01' },
  { id: 'enrich', label: 'Enrich', number: '02' },
  { id: 'review', label: 'Review', number: '03' },
  { id: 'publish', label: 'Publish', number: '04' },
];

const industries: IndustryStory[] = [
  {
    number: '01',
    name: 'Auto Parts',
    eyebrow: '01 / AUTO PARTS',
    headline: 'Every part needs the right context.',
    body: 'Bring OE, aftermarket, and salvage inventory into a workflow built around part information, vehicle fitment, listing preparation, and eBay Motors publishing.',
    details: ['Vehicle fitment', 'AI-assisted listing enrichment', 'Catalog and inventory operations'],
    path: '/auto-parts',
    image: HEADLAMP_IMAGE,
    alt: 'Illustrative automotive headlamp assembly on a warm neutral background',
  },
  {
    number: '02',
    name: 'Business & Industrial',
    eyebrow: '02 / BUSINESS & INDUSTRIAL',
    headline: 'Technical products need more than a title.',
    body: 'Organize product images, specifications, and supporting evidence so your team can review technical inventory before publishing.',
    details: ['Image intake', 'Specification and evidence review', 'Dedicated seller-store controls'],
    path: '/business-industrial',
    image: INDUSTRIAL_IMAGE,
    alt: 'Illustrative unbranded industrial mechanical component on a warm neutral background',
  },
  {
    number: '03',
    name: 'Fashion',
    eyebrow: '03 / FASHION',
    headline: 'Keep catalog quality and authenticity review connected.',
    body: 'Manage fashion catalogs with structured imports, human authenticity review, and controls for items that need further investigation.',
    details: ['Bulk catalog import', 'Authenticity review', 'Quarantine and incident handling'],
    path: '/fashion',
    image: FASHION_IMAGE,
    alt: 'Illustrative neutral olive-gray utility jacket with visible textile detail',
  },
];

const faqs = [
  {
    question: 'What does Omni Core help my team do?',
    answer: 'Omni Core connects product intake, catalog preparation, AI assistance, review, and eBay publishing, with inventory and operational tools available through its dedicated workspaces.',
  },
  {
    question: 'Which workspace should I choose?',
    answer: 'Choose Auto Parts for vehicle parts and fitment workflows, Business & Industrial for technical products and evidence review, or Fashion for catalog and authenticity-review workflows.',
  },
  {
    question: 'Does AI publish products without review?',
    answer: 'AI assists with preparing product information. Review and publishing controls depend on the workspace and product requirements; the walkthrough on this page illustrates a reviewed workflow.',
  },
  {
    question: 'Which marketplaces are supported?',
    answer: 'eBay is the primary developed marketplace integration. Publishing availability depends on your connected stores, workspace configuration, and supported workflow.',
  },
  {
    question: 'Does authenticity review mean automatic certification?',
    answer: 'No. Fashion provides a workflow for people to inspect evidence and record review decisions. It does not automatically certify an item’s authenticity.',
  },
];

const catalogRows = [
  {
    product: 'Headlamp assembly — left side',
    sku: 'DEMO-AP-1042',
    workspace: 'Auto Parts',
    review: 'Needs review',
    publishing: 'Draft',
    image: HEADLAMP_IMAGE,
    imageAlt: 'Illustrative headlamp assembly',
    reviewTone: 'warning',
    publishingTone: 'neutral',
  },
  {
    product: 'Precision valve component',
    sku: 'DEMO-BI-2207',
    workspace: 'Business & Industrial',
    review: 'Approved',
    publishing: 'Ready',
    image: INDUSTRIAL_IMAGE,
    imageAlt: 'Illustrative industrial component',
    reviewTone: 'success',
    publishingTone: 'success',
  },
  {
    product: 'Utility jacket',
    sku: 'DEMO-FS-0318',
    workspace: 'Fashion',
    review: 'Quarantined',
    publishing: 'Blocked',
    image: FASHION_IMAGE,
    imageAlt: 'Illustrative neutral utility jacket',
    reviewTone: 'danger',
    publishingTone: 'danger',
  },
] as const;

function BrandMark() {
  const { branding } = useBranding();
  const shortName = (branding.shortName || branding.clientName || 'OC').slice(0, 2).toUpperCase();

  return branding.logoUrl ? (
    <img
      src={toProxyUrl(branding.logoUrl)}
      alt=""
      width={36}
      height={36}
      className="h-9 w-9 object-contain"
    />
  ) : (
    <span
      className="flex h-9 w-9 items-center justify-center rounded-sm text-xs font-bold tracking-[0.08em]"
      style={{ backgroundColor: 'var(--home-accent)', color: 'var(--home-accent-fg)' }}
      aria-hidden="true"
    >
      {shortName}
    </span>
  );
}

function ProductImage({
  src,
  alt,
  className = '',
  eager = false,
  sizes = '(max-width: 768px) 90vw, 50vw',
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
  sizes?: string;
}) {
  return (
    <img
      src={src.startsWith('/') ? src : toProxyUrl(src)}
      alt={alt}
      width={1254}
      height={1254}
      sizes={sizes}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      decoding="async"
      className={className}
    />
  );
}

function StatusPill({
  tone,
  dark = false,
  children,
}: {
  tone: 'warning' | 'success' | 'danger' | 'neutral';
  dark?: boolean;
  children: string;
}) {
  const toneClasses = dark ? {
    warning: 'border-[#D9866E]/50 bg-[#C4482D]/20 text-[#F1B5A2]',
    success: 'border-[#8BB394]/50 bg-[#537C5E]/25 text-[#C6E1CA]',
    danger: 'border-[#D18B86]/50 bg-[#8F3A37]/25 text-[#F0B2AC]',
    neutral: 'border-[#77877D] bg-[#405249] text-[#E3E9E2]',
  } : {
    warning: 'border-[#C4482D]/30 bg-[#C4482D]/10 text-[#A23825]',
    success: 'border-[#537C5E]/30 bg-[#537C5E]/10 text-[#315A3B]',
    danger: 'border-[#8F3A37]/30 bg-[#8F3A37]/10 text-[#7B2D2A]',
    neutral: 'border-[#A8AEA5] bg-[#ECEBE3] text-[#59615A]',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-semibold ${toneClasses[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

function MetadataRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] gap-4 border-b border-[#D8DCD3] py-3 last:border-b-0">
      <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#737A72]">{label}</dt>
      <dd className="min-w-0 text-sm leading-6 text-[#202722]">{children}</dd>
    </div>
  );
}

function Header({
  brandName,
  menuOpen,
  setMenuOpen,
}: {
  brandName: string;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--home-border)] bg-[var(--home-bg)]">
      <div className="mx-auto flex min-h-[72px] max-w-[1280px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link to="/" className="flex min-h-11 items-center gap-3" aria-label={brandName + ' home'}>
          <BrandMark />
          <span className="text-[15px] font-semibold tracking-[-0.02em]">{brandName}</span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">
          <a href="#platform" className="text-sm text-[var(--home-muted)] transition-colors duration-150 hover:text-[var(--home-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--home-accent)]">Platform</a>
          <a href="#workflow" className="text-sm text-[var(--home-muted)] transition-colors duration-150 hover:text-[var(--home-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--home-accent)]">How it works</a>
          <a href="#industries" className="text-sm text-[var(--home-muted)] transition-colors duration-150 hover:text-[var(--home-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--home-accent)]">Industries</a>
          <Link to="/login" className="text-sm text-[var(--home-muted)] transition-colors duration-150 hover:text-[var(--home-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--home-accent)]">Sign in</Link>
          <a href="#workspaces" className="inline-flex min-h-11 items-center gap-2 rounded-[6px] px-4 py-2 text-sm font-semibold transition duration-150 hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--home-accent)]" style={{ backgroundColor: 'var(--home-accent)', color: 'var(--home-accent-fg)' }}>
            Choose your workspace <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </nav>

        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[6px] border border-[var(--home-border)] lg:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </div>

      {menuOpen && (
        <nav id="mobile-navigation" className="border-t border-[var(--home-border)] px-5 py-3 lg:hidden" aria-label="Mobile navigation">
          {[
            ['Platform', '#platform'],
            ['How it works', '#workflow'],
            ['Industries', '#industries'],
            ['Choose your workspace', '#workspaces'],
          ].map(([label, href]) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)} className="flex min-h-11 items-center justify-between border-b border-[var(--home-border)] py-3 text-sm font-medium last:border-b-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--home-accent)]">
              {label}<ArrowRight size={16} aria-hidden="true" />
            </a>
          ))}
          <Link to="/login" onClick={() => setMenuOpen(false)} className="mt-3 flex min-h-11 items-center justify-center rounded-[6px] px-4 py-2 text-sm font-semibold" style={{ backgroundColor: 'var(--home-accent)', color: 'var(--home-accent-fg)' }}>Sign in</Link>
        </nav>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="border-b border-[var(--home-border)]" aria-labelledby="hero-title">
      <div className="mx-auto grid max-w-[1280px] gap-12 px-5 pb-20 pt-16 sm:px-8 sm:pb-24 sm:pt-20 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:gap-16 lg:px-12 lg:pb-28 lg:pt-24">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.17em] text-[var(--home-accent)]">Commerce operations, connected</p>
          <h1 id="hero-title" className="mt-6 max-w-[700px] text-[44px] font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-[76px]">
            From product chaos<br className="hidden lg:block" /> to selling clarity.
          </h1>
          <p className="mt-7 max-w-[590px] text-base leading-7 text-[var(--home-muted)] sm:text-lg sm:leading-8">Bring product data, images, review, and eBay publishing into one connected workflow—with dedicated workspaces for Auto Parts, Business &amp; Industrial, and Fashion.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#industries" className="inline-flex min-h-12 items-center gap-2 rounded-[6px] px-5 py-3 text-sm font-semibold transition duration-150 hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--home-accent)]" style={{ backgroundColor: 'var(--home-accent)', color: 'var(--home-accent-fg)' }}>Explore your workspace <ArrowRight size={16} aria-hidden="true" /></a>
            <a href="#workflow" className="inline-flex min-h-12 items-center gap-2 rounded-[6px] border border-[var(--home-ink)] px-5 py-3 text-sm font-semibold transition duration-150 hover:bg-[#202722] hover:text-[#FFFEFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--home-accent)]">See how it works <ArrowRight size={16} aria-hidden="true" /></a>
          </div>
          <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.12em] text-[#737A72]">Structured catalogs. Human review. Connected selling.</p>
        </div>

        <div className="relative min-w-0">
          <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-[#737A72]">
            <span>Illustrative workflow</span><span>DEMO / 01</span>
          </div>
          <div className="relative grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(220px,0.9fr)] md:items-center">
            <div className="relative aspect-square overflow-hidden border border-[var(--home-border)] bg-[#E8E5DC]">
              <ProductImage src={HEADLAMP_IMAGE} alt="Illustrative automotive headlamp assembly, used only for the public product walkthrough" eager sizes="(max-width: 768px) 90vw, 42vw" className="h-full w-full object-contain mix-blend-multiply" />
              <svg className="pointer-events-none absolute inset-0 hidden h-full w-full md:block" viewBox="0 0 500 500" fill="none" aria-hidden="true">
                <path d="M28 116H116L167 181" stroke="#737A72" strokeWidth="1" />
                <path d="M472 140H394L338 207" stroke="#737A72" strokeWidth="1" />
                <path d="M28 403H120L188 345" stroke="#737A72" strokeWidth="1" />
                <circle cx="167" cy="181" r="3" fill="var(--home-accent)" />
                <circle cx="338" cy="207" r="3" fill="var(--home-accent)" />
                <circle cx="188" cy="345" r="3" fill="var(--home-accent)" />
              </svg>
              <div className="absolute left-4 top-4 hidden border border-[var(--home-border)] bg-[var(--home-surface)] px-3 py-2 md:block"><p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#737A72]">Source images</p></div>
              <div className="absolute right-4 top-12 hidden border border-[var(--home-border)] bg-[var(--home-surface)] px-3 py-2 md:block"><p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#737A72]">Structured product details</p></div>
              <div className="absolute bottom-5 left-4 hidden border border-[var(--home-border)] bg-[var(--home-surface)] px-3 py-2 md:block"><p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#737A72]">Reviewed before publishing</p></div>
            </div>

            <div className="border border-[var(--home-border)] bg-[var(--home-surface)] p-5 shadow-[0_12px_32px_rgba(32,39,34,0.07)] sm:p-6">
              <div className="flex items-center justify-between border-b border-[var(--home-border)] pb-4"><span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#737A72]">Listing proof</span><span className="font-mono text-[10px] text-[#737A72]">Sample record</span></div>
              <dl className="mt-2">
                <MetadataRow label="Title">Headlamp assembly — left side</MetadataRow>
                <MetadataRow label="SKU"><span className="font-mono text-xs">DEMO-AP-1042</span></MetadataRow>
                <MetadataRow label="Condition">Used</MetadataRow>
                <MetadataRow label="Fitment"><span className="text-[#A23825]">Vehicle compatibility requires review</span></MetadataRow>
                <MetadataRow label="Status"><StatusPill tone="warning">Draft</StatusPill></MetadataRow>
                <MetadataRow label="Destination"><span className="inline-flex items-center gap-2"><Store size={15} aria-hidden="true" />eBay Motors</span></MetadataRow>
              </dl>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[#737A72]">
            <span>Source</span><span className="h-px flex-1 bg-[var(--home-border)]" aria-hidden="true" /><span>Structure</span><span className="h-px flex-1 bg-[var(--home-border)]" aria-hidden="true" /><span>Review</span><span className="h-px flex-1 bg-[var(--home-border)]" aria-hidden="true" /><span>Publish</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 md:hidden">
            {['Source images', 'Structured product details', 'Reviewed before publishing'].map((label) => <span key={label} className="border border-[var(--home-border)] bg-[var(--home-surface)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[#737A72]">{label}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}

function PlatformSection() {
  const steps = [
    ['01', 'Bring it in', 'Start with catalog files, product images, or individual items.'],
    ['02', 'Make it usable', 'Organize product information and use AI assistance to prepare listing details.'],
    ['03', 'Review the details', 'Check the evidence and resolve the issues that matter for each product type.'],
    ['04', 'Put it to work', 'Publish to connected eBay stores and manage the supported selling workflow.'],
  ];

  return (
    <section id="platform" className="scroll-mt-24 border-b border-[var(--home-border)]" aria-labelledby="platform-title">
      <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28">
        <div className="grid gap-8 lg:grid-cols-[1.12fr_0.88fr] lg:gap-20">
          <h2 id="platform-title" className="max-w-[760px] text-[32px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">The work between receiving a product and selling it belongs together.</h2>
          <p className="max-w-[520px] text-base leading-7 text-[var(--home-muted)] sm:text-lg sm:leading-8">Product information starts in different places: spreadsheets, photographs, technical labels, and existing catalogs. Omni Core helps your team organize that information, prepare listings, review the details, and manage the next step from one platform.</p>
        </div>
        <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-4">
          {steps.map(([number, title, description]) => (
            <div key={number} className="border-t border-[var(--home-border)] py-6 md:border-l md:border-t-0 md:px-6 first:md:border-l-0 first:md:pl-0 last:md:pr-0 lg:min-h-[190px]">
              <span className="font-mono text-xs tracking-[0.14em] text-[var(--home-accent)]">{number}</span>
              <h3 className="mt-7 text-xl font-semibold tracking-[-0.02em]">{title}</h3>
              <p className="mt-3 max-w-[240px] text-sm leading-6 text-[var(--home-muted)]">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function IntakePanel() {
  return (
    <div className="min-h-[510px] p-5 transition-opacity duration-[180ms] sm:p-8 lg:p-12">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-[var(--home-border)] pb-6">
        <div><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#737A72]">Stage 01 / Intake</p><h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">Start with the information you have.</h3></div>
        <span className="font-mono text-xs text-[#737A72]">DEMO-AP-1042</span>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid grid-cols-3 gap-3">
          {[['Front lens', 'object-left'], ['Rear housing', 'object-center'], ['Mounting detail', 'object-right']].map(([label, position]) => (
            <figure key={label}>
              <div className="aspect-square overflow-hidden border border-[var(--home-border)] bg-[#E8E5DC]"><ProductImage src={HEADLAMP_IMAGE} alt={label + ', illustrative source image'} sizes="(max-width: 768px) 28vw, 20vw" className={'h-full w-full object-cover mix-blend-multiply ' + position} /></div>
              <figcaption className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[#737A72]">{label}</figcaption>
            </figure>
          ))}
        </div>
        <div className="border-t border-[var(--home-border)] pt-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <dl>
            <MetadataRow label="SKU"><span className="font-mono text-xs">DEMO-AP-1042</span></MetadataRow>
            <MetadataRow label="Source title">Left headlamp</MetadataRow>
            <MetadataRow label="Condition"><StatusPill tone="warning">Awaiting review</StatusPill></MetadataRow>
            <MetadataRow label="Fitment"><StatusPill tone="warning">Awaiting review</StatusPill></MetadataRow>
          </dl>
        </div>
      </div>
    </div>
  );
}

function EnrichPanel() {
  return (
    <div className="min-h-[510px] p-5 transition-opacity duration-[180ms] sm:p-8 lg:p-12">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-[var(--home-border)] pb-6">
        <div><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#737A72]">Stage 02 / Enrich</p><h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">Prepare structured details without hiding what still needs checking.</h3></div>
        <span className="font-mono text-xs text-[#737A72]">DEMO-AP-1042</span>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="aspect-[4/3] overflow-hidden border border-[var(--home-border)] bg-[#E8E5DC]"><ProductImage src={HEADLAMP_IMAGE} alt="Illustrative headlamp assembly during enrichment" sizes="(max-width: 768px) 90vw, 28vw" className="h-full w-full object-contain mix-blend-multiply" /></div>
        <div>
          <div className="mb-4 flex flex-wrap gap-2"><span className="border border-[var(--home-border)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#737A72]">Source information</span><span className="border border-[var(--home-accent)]/30 bg-[var(--home-accent)]/5 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#A23825]">Suggested information</span></div>
          <dl>
            <MetadataRow label="Listing title"><span className="font-medium">Headlamp assembly — left side</span><span className="ml-2 font-mono text-[10px] uppercase text-[#A23825]">Suggested</span></MetadataRow>
            <MetadataRow label="Product type">Automotive lighting component</MetadataRow>
            <MetadataRow label="Condition">Used <span className="ml-2 font-mono text-[10px] uppercase text-[#737A72]">Source</span></MetadataRow>
            <MetadataRow label="Fitment"><span className="text-[#A23825]">Unresolved — vehicle compatibility requires review</span></MetadataRow>
            <MetadataRow label="SKU"><span className="font-mono text-xs">DEMO-AP-1042</span></MetadataRow>
          </dl>
        </div>
      </div>
    </div>
  );
}

function ReviewPanel() {
  const checks: Array<[string, boolean, string]> = [
    ['Images reviewed', true, 'Source set is present'],
    ['Condition confirmed', true, 'Used'],
    ['Vehicle compatibility', false, 'Needs attention'],
  ];

  return (
    <div className="min-h-[510px] p-5 transition-opacity duration-[180ms] sm:p-8 lg:p-12">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-[var(--home-border)] pb-6">
        <div><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#737A72]">Stage 03 / Review</p><h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">Keep decisions with the people responsible for the listing.</h3></div>
        <span className="font-mono text-xs text-[#737A72]">DEMO-AP-1042</span>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.85fr]">
        <div className="divide-y divide-[var(--home-border)] border-y border-[var(--home-border)]">
          {checks.map(([label, complete, detail]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-5">
              <div className="flex items-center gap-3">{complete ? <CircleCheck className="text-[#537C5E]" size={21} aria-hidden="true" /> : <CircleAlert className="text-[var(--home-accent)]" size={21} aria-hidden="true" />}<span className="text-sm font-semibold">{label}</span></div>
              <span className={complete ? 'text-right text-xs text-[#537C5E]' : 'text-right text-xs text-[#A23825]'}>{detail}</span>
            </div>
          ))}
        </div>
        <div className="border border-[var(--home-border)] bg-[#ECEBE3] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#737A72]">Review decision</p>
          <p className="mt-4 text-sm leading-6 text-[var(--home-muted)]">The example remains a draft while vehicle compatibility is unresolved.</p>
          <span className="mt-6 inline-flex min-h-10 items-center border border-[#A8AEA5] px-3 text-sm font-semibold text-[#737A72]">Return to draft</span>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[#737A72]">Display-only workflow label</p>
        </div>
      </div>
    </div>
  );
}

function PublishPanel() {
  return (
    <div className="min-h-[510px] p-5 transition-opacity duration-[180ms] sm:p-8 lg:p-12">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-[var(--home-border)] pb-6">
        <div><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#737A72]">Stage 04 / Publish</p><h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">Send reviewed listings to the appropriate connected store.</h3></div>
        <span className="font-mono text-xs text-[#737A72]">DEMO-AP-1042</span>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div className="aspect-[4/3] overflow-hidden border border-[var(--home-border)] bg-[#E8E5DC]"><ProductImage src={HEADLAMP_IMAGE} alt="Illustrative headlamp assembly after review" sizes="(max-width: 768px) 90vw, 28vw" className="h-full w-full object-contain mix-blend-multiply" /></div>
        <div>
          <div className="border-l-2 border-[var(--home-accent)] bg-[#F4E9E4] px-4 py-3 text-sm font-semibold text-[#7B2D2A]">Example after review is complete.</div>
          <dl className="mt-5">
            <MetadataRow label="Listing title">Headlamp assembly — left side</MetadataRow>
            <MetadataRow label="Destination"><span className="inline-flex items-center gap-2"><Store size={15} aria-hidden="true" />Example eBay store</span></MetadataRow>
            <MetadataRow label="Status"><StatusPill tone="success">Ready to publish</StatusPill></MetadataRow>
            <MetadataRow label="SKU"><span className="font-mono text-xs">DEMO-AP-1042</span></MetadataRow>
          </dl>
        </div>
      </div>
    </div>
  );
}

function WorkflowSection({
  activeStage,
  setActiveStage,
}: {
  activeStage: StageId;
  setActiveStage: (stage: StageId) => void;
}) {
  const moveStage = (direction: 'next' | 'previous' | 'first' | 'last') => {
    const currentIndex = stages.findIndex((stage) => stage.id === activeStage);
    const nextIndex = direction === 'next'
      ? (currentIndex + 1) % stages.length
      : direction === 'previous'
        ? (currentIndex - 1 + stages.length) % stages.length
        : direction === 'first'
          ? 0
          : stages.length - 1;
    setActiveStage(stages[nextIndex].id);
  };

  const handleStageKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveStage('next');
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveStage('previous');
    } else if (event.key === 'Home') {
      event.preventDefault();
      moveStage('first');
    } else if (event.key === 'End') {
      event.preventDefault();
      moveStage('last');
    }
  };

  const panels: Record<StageId, ReactNode> = {
    intake: <IntakePanel />,
    enrich: <EnrichPanel />,
    review: <ReviewPanel />,
    publish: <PublishPanel />,
  };

  return (
    <section id="workflow" className="scroll-mt-24 border-b border-[var(--home-border)]" aria-labelledby="workflow-title">
      <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28">
        <div className="max-w-[720px]">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.15em] text-[var(--home-accent)]">Example data · Interactive product walkthrough</p>
          <h2 id="workflow-title" className="mt-5 text-[32px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">Follow one product through the workflow.</h2>
          <p className="mt-5 text-base leading-7 text-[var(--home-muted)] sm:text-lg">See how source material becomes a structured listing your team can review.</p>
        </div>

        <div className="mt-12 grid min-h-[570px] border border-[var(--home-border)] bg-[var(--home-surface)] lg:grid-cols-[230px_minmax(0,1fr)]">
          <div className="border-b border-[var(--home-border)] bg-[#ECEBE3] p-3 lg:border-b-0 lg:border-r lg:p-5">
            <div role="tablist" aria-label="Product walkthrough stages" className="grid grid-cols-2 gap-2 lg:block">
              {stages.map((stage) => {
                const selected = activeStage === stage.id;
                return (
                  <button key={stage.id} type="button" role="tab" id={'stage-tab-' + stage.id} aria-selected={selected} aria-controls={'stage-panel-' + stage.id} tabIndex={selected ? 0 : -1} onClick={() => setActiveStage(stage.id)} onKeyDown={handleStageKeyDown} className={'flex min-h-12 w-full items-center justify-between border px-3 text-left transition duration-[180ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--home-accent)] lg:min-h-14 lg:px-4 ' + (selected ? 'border-[var(--home-accent)] bg-[var(--home-surface)]' : 'border-transparent text-[#737A72] hover:border-[var(--home-border)] hover:bg-[var(--home-surface)]')}>
                    <span className="flex items-center gap-3"><span className="font-mono text-[10px] tracking-[0.12em] text-[var(--home-accent)]">{stage.number}</span><span className="text-sm font-semibold">{stage.label}</span></span>
                    {selected && <ArrowRight size={16} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
            <p className="mt-7 hidden font-mono text-[10px] uppercase leading-5 tracking-[0.1em] text-[#737A72] lg:block">Same SKU throughout.<br />No live data or publishing action.</p>
          </div>
          <div key={activeStage} id={'stage-panel-' + activeStage} role="tabpanel" aria-labelledby={'stage-tab-' + activeStage} className="landing-stage-transition relative min-h-[510px] overflow-hidden">
            {panels[activeStage]}
          </div>
        </div>
      </div>
    </section>
  );
}

function IndustriesSection() {
  return (
    <section id="industries" className="scroll-mt-24 border-b border-[var(--home-border)]" aria-labelledby="industries-title">
      <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28">
        <div className="max-w-[780px]">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.15em] text-[var(--home-accent)]">Three product stories</p>
          <h2 id="industries-title" className="mt-5 text-[32px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">One platform. Different products. The right checks for each.</h2>
          <p className="mt-5 text-base leading-7 text-[var(--home-muted)] sm:text-lg">A vehicle part, an industrial component, and a fashion item need different information before they are ready to sell.</p>
        </div>

        <div className="mt-16 space-y-20 sm:space-y-24 lg:space-y-32">
          {industries.map((industry, index) => {
            const imageFirst = index !== 1;
            const orderClass = imageFirst ? '' : 'lg:[&>div:first-child]:order-2 lg:[&>div:last-child]:order-1';
            return (
              <article key={industry.name} className={'grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.94fr)] lg:gap-16 ' + orderClass}>
                <div className="relative">
                  <div className="aspect-[1.15/1] overflow-hidden bg-[#E8E5DC]">
                    <ProductImage src={industry.image} alt={industry.alt} sizes="(max-width: 768px) 90vw, 50vw" className="h-full w-full object-contain mix-blend-multiply" />
                  </div>
                  <span className="mt-3 block font-mono text-[10px] uppercase tracking-[0.1em] text-[#737A72]">Illustrative product subject · {industry.number}</span>
                </div>
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--home-accent)]">{industry.eyebrow}</p>
                  <h3 className="mt-5 max-w-[520px] text-3xl font-semibold leading-[1.1] tracking-[-0.035em] sm:text-4xl">{industry.headline}</h3>
                  <p className="mt-5 max-w-[560px] text-base leading-7 text-[var(--home-muted)]">{industry.body}</p>
                  <ul className="mt-7 space-y-3 border-t border-[var(--home-border)] pt-5 text-sm text-[var(--home-muted)]">
                    {industry.details.map((detail) => <li key={detail} className="flex items-center gap-3"><Check size={16} className="text-[var(--home-accent)]" aria-hidden="true" />{detail}</li>)}
                  </ul>
                  {industry.name === 'Auto Parts' && <div className="mt-8 border-l-2 border-[var(--home-accent)] pl-4"><p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#737A72]">Fitment detail fragment</p><p className="mt-3 text-sm font-semibold">Vehicle compatibility requires review</p><p className="mt-1 text-xs text-[var(--home-muted)]">No verified vehicle match shown.</p></div>}
                  {industry.name === 'Business & Industrial' && <div className="mt-8 border border-[var(--home-border)] bg-[var(--home-surface)] p-4"><p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#737A72]">Technical detail excerpt</p><div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 text-sm"><span className="text-[#737A72]">Manufacturer</span><span>Unresolved</span><span className="text-[#737A72]">Model</span><span>Unresolved</span><span className="text-[#737A72]">Condition</span><span>Used</span><span className="text-[#737A72]">Review status</span><span>Needs review</span></div></div>}
                  {industry.name === 'Fashion' && <div className="mt-8 border-l-2 border-[#537C5E] pl-4"><p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#737A72]">Review annotation</p><p className="mt-3 text-sm font-semibold">Authenticity evidence · Human review required</p><p className="mt-1 text-xs text-[var(--home-muted)]">A decision is recorded by the team, not automatically certified.</p></div>}
                  <Link to={industry.path} className="group mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--home-accent)]">Open {industry.name} workspace <ArrowRight size={16} className="transition-transform duration-150 group-hover:translate-x-1" aria-hidden="true" /></Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function OperationsSection() {
  const statements = [
    'Catalogs that stay organized',
    'Visibility across connected stores',
    'Roles for different responsibilities',
    'Review decisions that remain visible',
  ];

  return (
    <section className="bg-[#182B24] text-[#F8F6EF]" aria-labelledby="operations-title">
      <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28">
        <div className="max-w-[720px]">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.15em] text-[#D9866E]">Illustrative catalog view</p>
          <h2 id="operations-title" className="mt-5 text-[32px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">The listing is one step. Your operation keeps moving.</h2>
          <p className="mt-5 text-base leading-7 text-[#C9D0C8] sm:text-lg">Keep catalog work, connected stores, inventory, and team responsibilities within a consistent operational process.</p>
        </div>

        <div className="mt-12 overflow-hidden border border-[#405249]">
          <table className="hidden w-full table-fixed border-collapse text-left lg:table">
            <caption className="sr-only">Illustrative catalog view with synthetic product statuses</caption>
            <thead className="bg-[#20362E] font-mono text-[10px] uppercase tracking-[0.12em] text-[#AEB9AE]">
              <tr><th className="w-[35%] px-5 py-4 font-normal">Product</th><th className="w-[16%] px-5 py-4 font-normal">SKU</th><th className="w-[18%] px-5 py-4 font-normal">Workspace</th><th className="w-[16%] px-5 py-4 font-normal">Review</th><th className="w-[15%] px-5 py-4 font-normal">Publishing</th></tr>
            </thead>
            <tbody>
              {catalogRows.map((row) => (
                <tr key={row.sku} className="border-t border-[#405249]">
                  <td className="px-5 py-5"><div className="flex items-center gap-4"><ProductImage src={row.image} alt={row.imageAlt} sizes="48px" className="h-12 w-12 shrink-0 object-contain" /><span className="text-sm font-semibold">{row.product}</span></div></td>
                  <td className="px-5 py-5 font-mono text-xs text-[#C9D0C8]">{row.sku}</td>
                  <td className="px-5 py-5 text-sm text-[#C9D0C8]">{row.workspace}</td>
                  <td className="px-5 py-5"><StatusPill tone={row.reviewTone} dark>{row.review}</StatusPill></td>
                  <td className="px-5 py-5"><StatusPill tone={row.publishingTone} dark>{row.publishing}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="lg:hidden">
            {catalogRows.map((row) => (
              <div key={row.sku} className="border-t border-[#405249] p-5 first:border-t-0">
                <div className="flex items-center gap-4"><ProductImage src={row.image} alt={row.imageAlt} sizes="56px" className="h-14 w-14 shrink-0 object-contain" /><div><p className="text-sm font-semibold">{row.product}</p><p className="mt-1 font-mono text-[10px] text-[#AEB9AE]">{row.sku}</p></div></div>
                <dl className="mt-5 grid grid-cols-[0.8fr_1.2fr] gap-y-3 border-t border-[#405249] pt-4 text-sm">
                  <dt className="text-[#AEB9AE]">Workspace</dt><dd>{row.workspace}</dd>
                  <dt className="text-[#AEB9AE]">Review</dt><dd><StatusPill tone={row.reviewTone} dark>{row.review}</StatusPill></dd>
                  <dt className="text-[#AEB9AE]">Publishing</dt><dd><StatusPill tone={row.publishingTone} dark>{row.publishing}</StatusPill></dd>
                </dl>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 grid border-y border-[#405249] sm:grid-cols-2 lg:grid-cols-4">
          {statements.map((statement) => <p key={statement} className="border-b border-[#405249] px-0 py-4 text-sm text-[#C9D0C8] last:border-b-0 sm:border-b-0 sm:px-5 lg:border-r lg:last:border-r-0">{statement}</p>)}
        </div>
        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#AEB9AE]">Available workflows depend on the workspace and its configuration.</p>
      </div>
    </section>
  );
}

function FaqSection({
  openFaqs,
  toggleFaq,
}: {
  openFaqs: Set<number>;
  toggleFaq: (index: number) => void;
}) {
  return (
    <section className="border-b border-[var(--home-border)]" aria-labelledby="faq-title">
      <div className="mx-auto max-w-[960px] px-5 py-16 sm:px-8 sm:py-20 lg:py-28">
        <h2 id="faq-title" className="text-[32px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">A few things worth knowing.</h2>
        <div className="mt-10 border-t border-[var(--home-border)]">
          {faqs.map((faq, index) => {
            const open = openFaqs.has(index);
            return (
              <div key={faq.question} className="border-b border-[var(--home-border)]">
                <h3>
                  <button type="button" aria-expanded={open} aria-controls={'faq-answer-' + index} onClick={() => toggleFaq(index)} className="flex min-h-16 w-full items-center justify-between gap-6 py-4 text-left text-base font-semibold transition-colors duration-150 hover:text-[var(--home-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--home-accent)] sm:text-lg">
                    <span>{faq.question}</span>{open ? <Minus size={19} aria-hidden="true" /> : <Plus size={19} aria-hidden="true" />}
                  </button>
                </h3>
                {open && <div id={'faq-answer-' + index} className="max-w-[760px] pb-6 pr-10 text-sm leading-7 text-[var(--home-muted)] sm:text-base">{faq.answer}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function WorkspaceSection() {
  return (
    <section id="workspaces" className="scroll-mt-24" aria-labelledby="workspaces-title">
      <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28">
        <div className="max-w-[680px]">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.15em] text-[var(--home-accent)]">Choose your workspace</p>
          <h2 id="workspaces-title" className="mt-5 text-[32px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">Start with the products you sell.</h2>
          <p className="mt-5 text-base leading-7 text-[var(--home-muted)] sm:text-lg">Choose the workspace built for your catalog.</p>
        </div>
        <div className="mt-12 border-t border-[var(--home-ink)]">
          {industries.map((industry) => (
            <Link key={industry.name} to={industry.path} className="group flex min-h-24 items-center justify-between gap-6 border-b border-[var(--home-border)] py-6 transition-colors duration-150 hover:border-[var(--home-ink)] focus-visible:bg-[#ECEBE3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--home-accent)]">
              <span className="flex items-baseline gap-4"><span className="font-mono text-xs text-[var(--home-accent)]">{industry.number}</span><span className="text-2xl font-semibold tracking-[-0.03em] sm:text-4xl">{industry.name}</span></span>
              <ArrowRight size={24} className="transition-transform duration-150 group-hover:translate-x-1" aria-hidden="true" />
            </Link>
          ))}
        </div>
        <p className="mt-8 text-sm text-[var(--home-muted)]">Already have an account? <Link to="/login" className="font-semibold underline decoration-[var(--home-accent)] decoration-2 underline-offset-4 hover:text-[var(--home-accent)]">Sign in.</Link></p>
      </div>
    </section>
  );
}

function Footer({ brandName }: { brandName: string }) {
  return (
    <footer className="border-t border-[var(--home-border)] bg-[#ECEBE3]">
      <div className="mx-auto max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div><div className="flex items-center gap-3"><BrandMark /><span className="font-semibold">{brandName}</span></div><p className="mt-5 text-sm text-[var(--home-muted)]">Connected commerce operations.</p></div>
          <div><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#737A72]">Workspaces</p><div className="mt-4 space-y-3 text-sm"><Link to="/auto-parts" className="block hover:text-[var(--home-accent)]">Auto Parts</Link><Link to="/business-industrial" className="block hover:text-[var(--home-accent)]">Business &amp; Industrial</Link><Link to="/fashion" className="block hover:text-[var(--home-accent)]">Fashion</Link></div></div>
          <div><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#737A72]">Explore</p><div className="mt-4 space-y-3 text-sm"><Link to="/privacy" className="block hover:text-[var(--home-accent)]">Privacy</Link><Link to="/login" className="block hover:text-[var(--home-accent)]">Sign in</Link></div></div>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-[var(--home-border)] pt-5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#737A72] sm:flex-row sm:items-center sm:justify-between"><span>© {new Date().getFullYear()} {brandName}</span><span>Product information, reviewed with intent.</span></div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  const { branding, loading } = useBranding();
  const brandName = branding.clientName || branding.appName || 'Omni Core';
  const isDefaultBranding = brandName === 'Omni Core' && branding.primaryColor.toLowerCase() === '#2563eb';
  const accent = isDefaultBranding ? '#C4482D' : branding.primaryColor;
  const accentForeground = isDefaultBranding ? '#FFFEFA' : 'var(--brand-primary-fg)';
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeStage, setActiveStage] = useState<StageId>('intake');
  const [openFaqs, setOpenFaqs] = useState<Set<number>>(() => new Set([0]));

  const pageStyle = {
    '--home-accent': accent,
    '--home-accent-fg': accentForeground,
    '--home-bg': '#F5F3ED',
    '--home-surface': '#FFFEFA',
    '--home-ink': '#202722',
    '--home-muted': '#59615A',
    '--home-border': '#D8DCD3',
    fontFamily: 'Manrope, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  } as CSSProperties;

  useEffect(() => {
    document.title = brandName === 'Omni Core' ? 'Omni Core — Connected Commerce Operations' : brandName + ' — Connected Commerce Operations';
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!description) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.appendChild(description);
    }
    description.content = 'Connect product intake, catalog preparation, human review, and eBay publishing with dedicated workspaces for Auto Parts, Business & Industrial, and Fashion.';
  }, [brandName, loading]);

  const toggleFaq = (index: number) => {
    setOpenFaqs((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--home-bg)] text-[var(--home-ink)] selection:bg-[var(--home-accent)] selection:text-[var(--home-accent-fg)]" style={pageStyle}>
      <style>{'@keyframes landing-stage-in{from{opacity:.35;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}.landing-stage-transition{animation:landing-stage-in 180ms ease-out}@media (prefers-reduced-motion: reduce){.landing-stage-transition{animation:none!important}}'}</style>
      <a href="#main-content" className="sr-only z-50 bg-[#202722] px-4 py-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <Header brandName={brandName} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <main id="main-content">
        <Hero />
        <PlatformSection />
        <WorkflowSection activeStage={activeStage} setActiveStage={setActiveStage} />
        <IndustriesSection />
        <OperationsSection />
        <FaqSection openFaqs={openFaqs} toggleFaq={toggleFaq} />
        <WorkspaceSection />
      </main>
      <Footer brandName={brandName} />
    </div>
  );
}
