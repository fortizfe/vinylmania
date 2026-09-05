import type { ReactNode } from 'react';
import { LazyMotion, MotionConfig } from 'motion/react';

interface MotionProviderProps {
  children: ReactNode;
}

/**
 * Loads the `motion` `domMax` feature bundle as its own async chunk, so it
 * stays out of the initial payload (research.md R1). `domMax` (rather than
 * `domAnimation`) is required for the `drag` gesture behind FR-010 / FR-012.
 */
const loadMotionFeatures = () =>
  import('./motionFeatures').then((mod) => mod.default);

/**
 * App-wide motion context. Mounted once, alongside `ThemeProvider`, above
 * the router (spec 059, contracts/motion-layer.md).
 *
 * - `LazyMotion` async-loads the feature bundle; `strict` forbids the full
 *   `motion.*` component so only the lightweight, tree-shakeable `m.*` is
 *   used anywhere.
 * - `MotionConfig reducedMotion="user"` makes every `m` element drop
 *   transform/layout animation under `prefers-reduced-motion: reduce`,
 *   animating opacity only. Components still must not depend on motion for
 *   meaning.
 */
export function MotionProvider({ children }: MotionProviderProps) {
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
