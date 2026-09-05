/**
 * Isolated entry point for `LazyMotion`'s async feature loading. Importing
 * this module in its own chunk (via `() => import('./domAnimationFeatures')`)
 * keeps the `motion` DOM-animation feature bundle out of the initial
 * payload — only the tiny `m` component shell ships eagerly (research.md R1).
 */
export { domAnimation as default } from 'motion/react';
