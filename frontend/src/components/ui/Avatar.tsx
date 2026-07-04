import clsx from 'clsx';

interface AvatarProps {
  src?: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-20 h-20',
};

export function Avatar({ src, alt, size = 'md' }: AvatarProps) {
  const base = clsx('rounded-md object-cover', sizeClasses[size]);

  if (!src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={clsx(base, 'bg-gray-100 dark:bg-gray-800')}
      />
    );
  }

  return <img src={src} alt={alt} className={base} />;
}
