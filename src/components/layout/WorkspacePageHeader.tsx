import type { ReactNode } from 'react';

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
};

export default function WorkspacePageHeader({ eyebrow, title, subtitle, children }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-sm font-medium" style={{ color: 'var(--brand-primary)' }}>
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl lg:text-3xl">
          {title}
        </h1>
        {subtitle ? <div className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">{subtitle}</div> : null}
      </div>
      {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
