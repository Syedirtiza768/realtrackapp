/* ─── ResponsiveContainer ──────────────────────────────────
 *  Reusable responsive layout wrapper with consistent
 *  max-width constraints and responsive padding.
 *
 *  Breakpoint Strategy:
 *  ┌──────────┬─────────┬──────────────────────────────┐
 *  │ Token    │ Width   │ Usage                         │
 *  ├──────────┼─────────┼──────────────────────────────┤
 *  │ (base)   │ 0-639   │ Mobile — single column        │
 *  │ sm       │ 640+    │ Large mobile — 2-col grids    │
 *  │ md       │ 768+    │ Tablet — multi-col forms      │
 *  │ lg       │ 1024+   │ Laptop — sidebar visible      │
 *  │ xl       │ 1280+   │ Desktop — wider grids         │
 *  │ 2xl      │ 1536+   │ Large desktop                 │
 *  │ 3xl      │ 1920+   │ Ultra-wide — extended grids   │
 *  └──────────┴─────────┴──────────────────────────────┘
 *
 *  All layouts start mobile-first (base) and scale up.
 * ────────────────────────────────────────────────────────── */

import React from 'react';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  /** Additional className to merge */
  className?: string;
  /** Use full width without max-width cap */
  fluid?: boolean;
  /** Remove horizontal padding */
  noPadding?: boolean;
  /** HTML element to render as */
  as?: keyof JSX.IntrinsicElements;
}

export default function ResponsiveContainer({
  children,
  className = '',
  fluid = false,
  noPadding = false,
  as: Tag = 'div',
}: ResponsiveContainerProps) {
  return (
    <Tag
      className={[
        'w-full mx-auto',
        !noPadding && 'px-4 sm:px-6 lg:px-8',
        !fluid && 'max-w-screen-3xl',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Tag>
  );
}

/* ─── Page Header ──────────────────────────────────────────
 *  Standard responsive page header with title + actions.
 *  Stacks vertically on mobile, side-by-side on sm+.
 * ────────────────────────────────────────────────────────── */

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode; // action buttons
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 truncate">
          {title}
        </h2>
        {subtitle && (
          <div className="text-sm text-slate-500 mt-1">{subtitle}</div>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {children}
        </div>
      )}
    </div>
  );
}
