import type { ReactNode } from 'react';
import clsx from 'clsx';

interface BadgeProps {
  children: ReactNode;
  tone?: 'neutral' | 'muted' | 'accent';
}

const toneClasses: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'bg-stone-100 text-stone-700 dark:bg-stone-900 dark:text-stone-200',
  muted: 'bg-transparent text-stone-500 dark:text-stone-400',
  accent: 'bg-accent/10 text-accent-text dark:bg-accent/15 dark:text-accent',
};

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}
