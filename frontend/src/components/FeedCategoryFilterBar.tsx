import clsx from 'clsx';

interface FeedCategoryFilterBarProps {
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

const baseButtonClassName =
  'flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 py-1 text-sm font-medium transition-colors';
const activeClassName = 'bg-primary text-white';
const inactiveClassName =
  'bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800';

export function FeedCategoryFilterBar({
  categories,
  selectedCategory,
  onSelectCategory,
}: FeedCategoryFilterBarProps) {
  return (
    <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={selectedCategory === null}
        onClick={() => onSelectCategory(null)}
        className={clsx(
          baseButtonClassName,
          selectedCategory === null ? activeClassName : inactiveClassName,
        )}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          aria-pressed={selectedCategory === category}
          onClick={() => onSelectCategory(category)}
          className={clsx(
            baseButtonClassName,
            selectedCategory === category ? activeClassName : inactiveClassName,
          )}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
