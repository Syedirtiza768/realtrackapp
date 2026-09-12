import {
  ArrowRight,
  Boxes,
  CarFront,
  Check,
  Factory,
  Layers3,
  LogIn,
  Shirt,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBranding } from '../../contexts/BrandingContext';
import { toProxyUrl } from '../../lib/imageUrl';

type Vertical = {
  name: string;
  eyebrow: string;
  description: string;
  features: string[];
  path: string;
  accent: string;
  accentSoft: string;
  icon: typeof CarFront;
};

const verticals: Vertical[] = [
  {
    name: 'Auto Parts',
    eyebrow: 'Automotive operations',
    description:
      'Fitment-first catalog and inventory workflows for OE, aftermarket, and salvage parts.',
    features: ['VIN and vehicle fitment', 'AI listing enrichment', 'eBay Motors publishing'],
    path: '/auto-parts',
    accent: 'text-blue-300',
    accentSoft: 'bg-blue-400/10 border-blue-300/20',
    icon: CarFront,
  },
  {
    name: 'Business & Industrial',
    eyebrow: 'Technical commerce',
    description:
      'Technical product workflows built around specifications, freight, compliance, and evidence.',
    features: ['AI image intake', 'Compliance review', 'Industrial seller stores'],
    path: '/business-industrial',
    accent: 'text-cyan-300',
    accentSoft: 'bg-cyan-400/10 border-cyan-300/20',
    icon: Factory,
  },
  {
    name: 'Fashion',
    eyebrow: 'Authenticity-led retail',
    description:
      'Structured fashion catalog management with authenticity review and seller-store controls.',
    features: ['Bulk catalog import', 'Authenticity review', 'Quarantine and incidents'],
    path: '/fashion',
    accent: 'text-pink-300',
    accentSoft: 'bg-pink-400/10 border-pink-300/20',
    icon: Shirt,
  },
];

function BrandMark({ className = '' }: { className?: string }) {
  const { branding } = useBranding();
  const shortName = (branding.shortName || branding.clientName || 'OC')
    .slice(0, 2)
    .toUpperCase();

  return branding.logoUrl ? (
    <img
      src={toProxyUrl(branding.logoUrl)}
      alt=""
      className={`h-10 w-10 rounded-xl object-contain ${className}`}
    />
  ) : (
    <span
      className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${className}`}
      style={{ backgroundColor: branding.primaryColor, color: 'var(--brand-primary-fg)' }}
    >
      {shortName}
    </span>
  );
}

export default function LandingPage() {
  const { branding } = useBranding();
  const brandName = branding.clientName || branding.appName || 'Omni Core';

  return (
    <div className="min-h-screen overflow-hidden bg-[#07111f] text-white selection:bg-cyan-300 selection:text-slate-950">
      <header className="relative z-10 border-b border-white/10 bg-[#07111f]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
          <Link to="/" className="flex items-center gap-3" aria-label={`${brandName} home`}>
            <BrandMark />
            <div>
              <p className="font-semibold tracking-tight">{brandName}</p>
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Commerce OS</p>
            </div>
          </Link>
          <nav className="flex items-center gap-3 text-sm" aria-label="Main navigation">
            <a className="hidden text-slate-300 transition hover:text-white sm:inline" href="#verticals">
              Verticals
            </a>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/10"
            >
              <LogIn size={15} />
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative isolate">
          <div className="pointer-events-none absolute -left-32 top-16 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-40 top-24 h-[30rem] w-[30rem] rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="mx-auto grid max-w-7xl gap-16 px-5 pb-20 pt-20 sm:px-8 sm:pt-28 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-10 lg:pb-28">
            <div className="relative">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                <Sparkles size={14} />
                Multi-vertical operations
              </div>
              <h1 className="max-w-3xl text-5xl font-semibold leading-[1.03] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
                One operating system for{' '}
                <span className="bg-gradient-to-r from-cyan-200 via-blue-300 to-pink-300 bg-clip-text text-transparent">
                  every catalog.
                </span>
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                {brandName} brings intake, AI enrichment, review, inventory, and marketplace publishing into one focused workspace for the products you sell.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <a
                  href="#verticals"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
                >
                  Explore verticals
                  <ArrowRight size={16} />
                </a>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
                >
                  Open workspace
                </Link>
              </div>
              <div className="mt-12 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-400">
                {['Structured intake', 'Human review', 'Marketplace-ready output'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                      <Check size={13} />
                    </span>
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-blue-400/20 via-cyan-300/10 to-pink-400/15 blur-2xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.07] p-4 shadow-2xl shadow-cyan-950/40 backdrop-blur-sm sm:p-5">
                <div className="flex items-center justify-between border-b border-white/10 px-2 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" />
                    <span className="text-xs font-medium text-slate-300">Workspace signal</span>
                  </div>
                  <span className="rounded-full bg-emerald-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
                    Live system
                  </span>
                </div>
                <div className="grid gap-3 p-2 pt-5 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 sm:col-span-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Active workflow</p>
                        <p className="mt-2 text-lg font-semibold">Intake → review → publish</p>
                      </div>
                      <Workflow className="text-cyan-200" size={22} />
                    </div>
                    <div className="mt-5 flex items-center gap-2">
                      {['Intake', 'Enrich', 'Review', 'Publish'].map((step, index) => (
                        <div className="flex min-w-0 flex-1 items-center gap-2" key={step}>
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${index < 3 ? 'bg-cyan-300 text-slate-950' : 'border border-white/20 text-slate-400'}`}>
                            {index + 1}
                          </span>
                          <span className="hidden truncate text-xs text-slate-400 sm:block">{step}</span>
                          {index < 3 && <span className="h-px flex-1 bg-white/15" />}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-blue-300/15 bg-blue-300/10 p-4">
                    <CarFront className="text-blue-200" size={21} />
                    <p className="mt-6 text-2xl font-semibold">Fitment</p>
                    <p className="mt-1 text-xs text-slate-400">Vehicle-aware data</p>
                  </div>
                  <div className="rounded-2xl border border-pink-300/15 bg-pink-300/10 p-4">
                    <Layers3 className="text-pink-200" size={21} />
                    <p className="mt-6 text-2xl font-semibold">Control</p>
                    <p className="mt-1 text-xs text-slate-400">Review every decision</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-300/10 text-amber-200">
                    <Boxes size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Built for operational depth</p>
                    <p className="mt-0.5 text-xs text-slate-500">From a single SKU to a high-volume catalog</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="verticals" className="scroll-mt-8 border-y border-white/10 bg-white/[0.025]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">Choose your workspace</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Purpose-built for the way each vertical works.</h2>
              <p className="mt-4 text-base leading-7 text-slate-400">Start where your catalog lives. Each workspace keeps its own workflow, permissions, review controls, and marketplace rules.</p>
            </div>
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {verticals.map((vertical) => {
                const Icon = vertical.icon;
                return (
                  <Link
                    key={vertical.name}
                    to={vertical.path}
                    className="group flex h-full flex-col rounded-3xl border border-white/10 bg-slate-900/60 p-6 transition duration-300 hover:-translate-y-1 hover:border-white/25 hover:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${vertical.accentSoft}`}>
                        <Icon className={vertical.accent} size={24} />
                      </div>
                      <ArrowRight className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-white" size={20} />
                    </div>
                    <p className={`mt-7 text-xs font-semibold uppercase tracking-[0.18em] ${vertical.accent}`}>{vertical.eyebrow}</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight">{vertical.name}</h3>
                    <p className="mt-3 min-h-[4.5rem] text-sm leading-6 text-slate-400">{vertical.description}</p>
                    <ul className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm text-slate-300">
                      {vertical.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2.5">
                          <Check className={vertical.accent} size={15} />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <span className={`mt-7 inline-flex items-center gap-2 text-sm font-semibold ${vertical.accent}`}>
                      Enter {vertical.name}
                      <ArrowRight size={15} className="transition group-hover:translate-x-1" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-200">One clear flow</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Turn product data into confident listings.</h2>
              <p className="mt-5 max-w-md text-base leading-7 text-slate-400">Keep teams aligned from the first file or image through the final marketplace handoff, with the right controls for every product type.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ['01', 'Bring in data', 'Upload catalogs, images, or individual products into a structured intake.'],
                ['02', 'Make it ready', 'Enrich with AI, validate the details, and keep people in the review loop.'],
                ['03', 'Publish with control', 'Send marketplace-ready listings to the store and channel that fits.'],
              ].map(([number, title, description]) => (
                <div key={number} className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
                  <span className="text-xs font-semibold tracking-[0.2em] text-slate-500">{number}</span>
                  <h3 className="mt-8 text-lg font-semibold">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 sm:px-8 lg:px-10 lg:pb-24">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 overflow-hidden rounded-[2rem] border border-cyan-200/15 bg-gradient-to-br from-cyan-300/10 via-blue-300/5 to-pink-300/10 px-6 py-10 sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:px-14">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">Ready when you are</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">Choose a vertical and get to work.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Your team gets a focused workspace. Your data stays connected across the full listing lifecycle.</p>
            </div>
            <Link to="/login" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100">
              Sign in to {brandName}
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-5 py-7 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {brandName}. Multi-vertical commerce operations.</p>
          <div className="flex items-center gap-5">
            <Link className="transition hover:text-slate-200" to="/privacy">Privacy</Link>
            <Link className="transition hover:text-slate-200" to="/login">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
