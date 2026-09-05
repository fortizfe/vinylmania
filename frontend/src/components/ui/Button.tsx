import type { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'md' | 'icon';
  loading?: boolean;
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-primary text-white hover:opacity-90',
  // border-stone-500 (not the lighter default border-stone-300) against
  // the light surfaces this variant sits on (app shell, Card) — at
  // border-stone-300 it measured 1.43:1 against a Card surface (the Genre
  // filter trigger, spec 058 T028 finding #9), under the WCAG AA 3:1
  // minimum for UI component boundaries (1.4.11). The dark side is fixed
  // at the token level via `--color-border-dark` in global.css.
  secondary:
    'border border-stone-500 bg-transparent text-stone-900 hover:bg-stone-50 dark:border-border-dark dark:text-stone-100 dark:hover:bg-stone-900',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  md: 'min-h-11 px-4 py-2 text-sm',
  icon: 'inline-flex min-h-11 min-w-11 items-center justify-center p-0',
};

const baseClassName =
  'rounded-xl font-medium transition-opacity disabled:cursor-default disabled:opacity-60';

/**
 * Class string matching a given `Button` variant/size, for non-`<button>`
 * elements (e.g. a `Link`) that must look identical to one without nesting
 * an interactive element inside another. Reuses the same touch-target floor
 * (FR-004/FR-006) instead of hand-repeating Button's utility classes.
 */
export function buttonClassName(
  variant: NonNullable<ButtonProps['variant']> = 'primary',
  size: NonNullable<ButtonProps['size']> = 'md',
  className?: string,
) {
  return clsx(baseClassName, sizeClasses[size], variantClasses[variant], className);
}

/**
 * Class string for a `size="icon" variant="secondary"` `Button`, for
 * non-`<button>` elements (e.g. a `Link`) that must look identical to one
 * without nesting an interactive element inside another.
 */
export function iconButtonClassName(className?: string) {
  return buttonClassName('secondary', 'icon', className);
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      aria-busy={loading}
      className={clsx(
        baseClassName,
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}
