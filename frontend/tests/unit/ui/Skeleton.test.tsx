import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Skeleton } from '../../../src/components/ui/Skeleton';

describe('Skeleton', () => {
  it('renders a pulsing placeholder with the caller-supplied sizing classes', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);

    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toMatch(/animate-pulse/);
    expect(el.className).toMatch(/bg-gray-200/);
    expect(el.className).toMatch(/dark:bg-gray-900/);
    expect(el.className).toMatch(/h-4/);
    expect(el.className).toMatch(/w-32/);
  });

  it('supports a fully-rounded variant for circular placeholders', () => {
    const { container } = render(<Skeleton className="h-12 w-12" rounded="full" />);

    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toMatch(/rounded-full/);
  });

  it('defaults to a medium corner radius', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);

    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toMatch(/rounded-md/);
  });
});
