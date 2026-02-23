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
        default: 'bg-blue-600/10 text-blue-400 border-blue-600/20',
        secondary: 'bg-slate-700/50 text-slate-300 border-slate-600/50',
        outline: 'text-slate-200 border-slate-700 hover:bg-slate-800',
        destructive: 'bg-red-900/20 text-red-400 border-red-900/50',
        success: 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50',
        warning: 'bg-amber-900/20 text-amber-400 border-amber-900/50',
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
