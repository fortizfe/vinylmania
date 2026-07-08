import type { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'md' | 'icon';
  loading?: boolean;
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-primary text-white hover:opacity-90',
  secondary:
    'border border-gray-300 bg-transparent text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  md: 'px-4 py-2 text-sm',
  icon: 'inline-flex h-9 w-9 items-center justify-center p-0',
};

const baseClassName =
  'rounded-xl font-medium transition-opacity disabled:cursor-default disabled:opacity-60';

/**
 * Class string for a `size="icon" variant="secondary"` `Button`, for
 * non-`<button>` elements (e.g. a `Link`) that must look identical to one
 * without nesting an interactive element inside another.
 */
export function iconButtonClassName(className?: string) {
  return clsx(baseClassName, sizeClasses.icon, variantClasses.secondary, className);
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
