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
        'animate-pulse bg-gray-200 dark:bg-gray-900',
        roundedClasses[rounded],
        className,
      )}
    />
  );
}
