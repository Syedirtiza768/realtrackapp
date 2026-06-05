import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning';
    children?: React.ReactNode;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
    const variants = {
        default: 'bg-blue-100 text-blue-600 dark:bg-blue-600/10 dark:text-blue-400 border-blue-300 dark:border-blue-600/20',
        secondary: 'bg-slate-200 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300 border-slate-300 dark:border-slate-600/50',
        outline: 'text-slate-700 border-slate-300 hover:bg-slate-100 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800',
        destructive: 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400 border-red-300 dark:border-red-900/50',
        success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-300 dark:border-emerald-900/50',
        warning: 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 border-amber-300 dark:border-amber-900/50',
    };

    return (
        <div
            className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2",
                variants[variant],
                className
            )}
            {...props}
        />
    );
}
