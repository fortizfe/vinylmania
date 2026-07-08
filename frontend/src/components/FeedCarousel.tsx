import { Children, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const SCROLL_STEP_RATIO = 0.9;
const END_EPSILON_PX = 1;

function ChevronLeftIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-4 w-4"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4l-6 6 6 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-4 w-4"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 4l6 6-6 6" />
    </svg>
  );
}

const arrowButtonClassName =
  'flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-0 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800';

interface FeedCarouselProps {
  children: ReactNode;
}

export function FeedCarousel({ children }: FeedCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  function updateScrollState() {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    setCanScrollPrev(track.scrollLeft > 0);
    setCanScrollNext(
      track.scrollLeft + track.clientWidth < track.scrollWidth - END_EPSILON_PX,
    );
  }

  useLayoutEffect(() => {
    updateScrollState();
    window.addEventListener('resize', updateScrollState);
    return () => window.removeEventListener('resize', updateScrollState);
  }, []);

  function scrollByDirection(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    track.scrollBy({
      left: direction * track.clientWidth * SCROLL_STEP_RATIO,
      behavior: 'smooth',
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Previous articles"
        onClick={() => scrollByDirection(-1)}
        disabled={!canScrollPrev}
        className={arrowButtonClassName}
      >
        <ChevronLeftIcon />
      </button>
      <div
        ref={trackRef}
        data-testid="feed-carousel-track"
        onScroll={updateScrollState}
        className="flex flex-1 gap-4 overflow-x-auto scroll-smooth"
      >
        {Children.map(children, (child, index) => (
          <div key={index} className="w-72 shrink-0">
            {child}
          </div>
        ))}
      </div>
      <button
        type="button"
        aria-label="Next articles"
        onClick={() => scrollByDirection(1)}
        disabled={!canScrollNext}
        className={arrowButtonClassName}
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
}
