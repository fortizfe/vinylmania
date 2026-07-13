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
        'animate-pulse bg-stone-200 dark:bg-stone-800',
        roundedClasses[rounded],
        className,
      )}
    />
  );
}
