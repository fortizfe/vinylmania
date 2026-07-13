import type { ReactNode } from 'react';
import clsx from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md';
}

const paddingClasses: Record<NonNullable<CardProps['padding']>, string> = {
  sm: 'p-4',
  md: 'p-6',
};

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-stone-200 bg-stone-50 shadow-sm dark:border-border-dark dark:bg-surface-raised',
        paddingClasses[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}
