import type { InputHTMLAttributes } from 'react';
import clsx from 'clsx';

import { pressableRow } from './press';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  id: string;
}

export function Checkbox({ label, id, className, ...props }: CheckboxProps) {
  return (
    // Row-level press feedback: a brightness nudge only (no scale — a dense
    // filter row scaling reads as jitter), suppressed under reduced motion
    // by the global timing kill (spec 059 US1 / audit).
    <div className={clsx('flex min-h-11 items-center gap-2 rounded-md', pressableRow)}>
      <input
        id={id}
        type="checkbox"
        {...props}
        className={clsx(
          // Native `<input type="checkbox">` with `appearance: auto` (the
          // default, unchanged here) ignores author `border-width`/
          // `border-style` entirely in Chromium — `getComputedStyle` reports
          // `borderStyle: 'none'`/`borderWidth: '0px'` regardless of the
          // `border-*` utilities below, confirmed empirically for spec 058.
          // So the WCAG 1.4.11 boundary check falls back to comparing this
          // element's `background-color` against its surface instead (per
          // `assertUiComponentContrast`'s own documented fallback) — and
          // `dark:bg-stone-950` (near-black) measured only 1.10:1 against
          // the dark filter-modal Card surface (`bg-surface-raised`), under
          // the 3:1 minimum. `dark:bg-stone-300` measures ~12:1 against that
          // surface and reads as the conventional "light, empty checkbox"
          // look against a dark card. Light mode is left as-is: its
          // `background-color` computes to transparent, which is a real,
          // accessible outcome there (the native OS checkbox chrome is
          // reliably visible against light surfaces by platform convention)
          // — see specs/058-theme-wcag-aa-refactor (T028 finding #10).
          'h-4 w-4 rounded border-stone-300 text-primary focus:ring-primary dark:border-stone-800 dark:bg-stone-300',
          className,
        )}
      />
      <label htmlFor={id} className="text-sm text-stone-700 dark:text-stone-300">
        {label}
      </label>
    </div>
  );
}
