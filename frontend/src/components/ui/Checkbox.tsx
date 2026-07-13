import type { InputHTMLAttributes } from 'react';
import clsx from 'clsx';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  id: string;
}

export function Checkbox({ label, id, className, ...props }: CheckboxProps) {
  return (
    <div className="flex min-h-11 items-center gap-2">
      <input
        id={id}
        type="checkbox"
        {...props}
        className={clsx(
          'h-4 w-4 rounded border-stone-300 text-primary focus:ring-primary dark:border-stone-800 dark:bg-stone-950',
          className,
        )}
      />
      <label htmlFor={id} className="text-sm text-stone-700 dark:text-stone-300">
        {label}
      </label>
    </div>
  );
}
