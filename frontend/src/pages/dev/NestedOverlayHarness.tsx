import { useState } from 'react';

import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

/**
 * Test-only harness (spec 059 US3 / T065) — a confirm dialog opened from
 * within a `Modal`. Reachable only at `/__dev/nested-overlay` and only in a
 * dev build (see `App.tsx`, guarded by `import.meta.env.DEV`); it is never
 * mounted in production. Exercises the focus-trap / focus-restore unwind
 * across a nested overlay stack, which no real screen currently produces.
 */
export function NestedOverlayHarness() {
  const [outerOpen, setOuterOpen] = useState(false);
  const [innerOpen, setInnerOpen] = useState(false);

  return (
    <main className="flex min-h-dvh flex-col items-start gap-4 p-8">
      <h1 className="text-lg font-semibold">Nested overlay harness</h1>
      <Button data-testid="open-outer" onClick={() => setOuterOpen(true)}>
        Open outer dialog
      </Button>

      <Modal open={outerOpen} onClose={() => setOuterOpen(false)} title="Outer dialog">
        <div className="flex flex-col gap-3">
          <p className="text-stone-900 dark:text-stone-100">Outer overlay body</p>
          <Button data-testid="open-inner" onClick={() => setInnerOpen(true)}>
            Open confirm dialog
          </Button>
        </div>

        <Modal open={innerOpen} onClose={() => setInnerOpen(false)} title="Confirm action">
          <div className="flex flex-col gap-3">
            <p className="text-stone-900 dark:text-stone-100">
              Are you sure you want to continue?
            </p>
            <Button data-testid="confirm-yes" onClick={() => setInnerOpen(false)}>
              Yes, continue
            </Button>
          </div>
        </Modal>
      </Modal>
    </main>
  );
}
