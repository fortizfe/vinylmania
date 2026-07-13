import type { InputHTMLAttributes } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  hideLabel?: boolean;
}

export function Input({ label, id, hideLabel = false, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className={clsx(
          'text-sm font-medium text-stone-700 dark:text-stone-300',
          hideLabel && 'sr-only',
        )}
      >
        {label}
      </label>
      <input
        id={id}
        {...props}
        className={clsx(
          'min-h-11 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-primary focus:outline-none dark:border-stone-800 dark:bg-stone-950 dark:text-stone-100',
          className,
        )}
      />
    </div>
  );
}
