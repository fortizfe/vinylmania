import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
  rounded?: 'md' | 'full';
}

const roundedClasses: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  md: 'rounded-md',
  full: 'rounded-full',
};

export function Skeleton({ className, rounded = 'md' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        // `motion-safe:` gates the pulse so it is fully absent (no
        // `animation-name`) under `prefers-reduced-motion: reduce` (WCAG
        // 2.3.3 / spec 059 FR-005). Dimensions and structure are unchanged.
        'motion-safe:animate-pulse bg-stone-200 dark:bg-stone-800',
        roundedClasses[rounded],
        className,
      )}
    />
  );
}
