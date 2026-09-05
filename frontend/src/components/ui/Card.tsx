import type { ReactNode } from 'react';
import clsx from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md';
  'data-testid'?: string;
}

const paddingClasses: Record<NonNullable<CardProps['padding']>, string> = {
  sm: 'p-4',
  md: 'p-6',
};

export function Card({ children, className, padding = 'md', 'data-testid': testId }: CardProps) {
  return (
    <div
      data-testid={testId}
      className={clsx(
        // border-stone-500 (not the much lighter default border-stone-200)
        // against the surfaces a Card sits on — Card's own bg-stone-50 is
        // barely distinguishable from the app-shell's bg-white (~1.04:1),
        // so this border is the ONLY perceivable boundary in most places
        // Card is used, making it a real WCAG 1.4.11 UI-component boundary,
        // not a decorative accent. At border-stone-200 it measured 1.26:1
        // against the app shell — see specs/058-theme-wcag-aa-refactor
        // (T028 finding #8). border-stone-500 measures ~4.59–4.80:1 in
        // light mode against every surface a Card can sit on (app shell or
        // a nested Card). The dark side is fixed at the token level via
        // `--color-border-dark` in global.css.
        'rounded-xl border border-stone-500 bg-stone-50 shadow-sm dark:border-border-dark dark:bg-surface-raised',
        paddingClasses[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}
