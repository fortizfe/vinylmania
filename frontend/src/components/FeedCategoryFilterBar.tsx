import clsx from 'clsx';

interface FeedCategoryFilterBarProps {
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

const baseButtonClassName =
  'rounded-full px-3 py-1 text-sm font-medium transition-colors';
const activeClassName = 'bg-primary text-white';
const inactiveClassName =
  'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700';

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
