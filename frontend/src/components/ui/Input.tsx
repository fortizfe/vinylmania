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
          'text-sm font-medium text-gray-700 dark:text-gray-300',
          hideLabel && 'sr-only',
        )}
      >
        {label}
      </label>
      <input
        id={id}
        {...props}
        className={clsx(
          'rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100',
          className,
        )}
      />
    </div>
  );
}
