import { useEffect, useState } from 'react';

/**
 * `true` once the window has scrolled past `threshold` pixels (spec 059 US5
 * T084 — the sticky-header scroll-edge treatment). A tiny threshold keeps
 * the header's edge shadow absent at the very top of the page and fades it
 * in as soon as content passes under it (apple-design §12).
 *
 * SSR / jsdom safe: reports `false` until the effect runs.
 */
export function useScrolledPast(threshold = 4): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => setScrolled(window.scrollY > threshold);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [threshold]);

  return scrolled;
}
