import type { ReactNode } from 'react';
import clsx from 'clsx';

interface BadgeProps {
  children: ReactNode;
  tone?: 'neutral' | 'muted' | 'accent';
}

const toneClasses: Record<NonNullable<BadgeProps['tone']>, string> = {
  // `border-stone-500` added: this filled chip's fill barely differs from
  // the cards it sits on (`bg-stone-100` vs `bg-stone-50`/`dark:bg-stone-900`
  // vs `dark:bg-surface-raised` measured ~1.04:1 light / ~1.03:1 dark — the
  // genre Badge on the release detail page, spec 058 T027 finding #6), so
  // its boundary was effectively imperceptible: a real WCAG 1.4.11
  // violation, not a measurement artifact (unlike the `muted` tone below).
  // `border-stone-500` measures ~4.59-4.80:1 (light) / ~3.75-4.09:1 (dark)
  // against every card/app-shell surface this tone is used against,
  // without touching the already-compliant fill/text pairing.
  neutral:
    'border border-stone-500 bg-stone-100 text-stone-700 dark:bg-stone-900 dark:text-stone-200',
  // No border added here (spec 058 T027 finding #7, judgment call): every
  // `tone="muted"` usage (SearchResultCard/SearchResultListRow's format and
  // "Multiple editions" chips, ReleaseDetailsSection/
  // MasterReleaseOtherDetailsSection's format/label/style chips) is plain
  // inline colored text with no interactive or selectable behavior and no
  // fill by design (`bg-transparent`) — WCAG 1.4.11 targets UI-component
  // boundaries that are *needed to perceive the control*, not text-only
  // status labels, whose contrast is already covered by User Story 1's
  // axe scans (which pass for this tone). The 1.17:1 reading some e2e
  // checks reported for it is `toRgb`'s canvas conversion treating
  // `background-color: transparent` as opaque black, not a real color —
  // see contrast.ts's own documented handling of the same class of
  // artifact for `getResolvedComputedStyle`.
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
