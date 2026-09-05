import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { DiscogsRelinkNotice } from '../../src/components/DiscogsRelinkNotice';
import { FeedSourceStatusBanner } from '../../src/components/FeedSourceStatusBanner';
import { LibraryLinkRequired } from '../../src/components/LibraryLinkRequired';
import { UnderConstruction } from '../../src/components/UnderConstruction';

/**
 * Spec 059 US5 T086 (revised in Phase 8 polish, T097) — the gentle
 * opacity-only entrance (`status-fade-in`: `--motion-duration-fade`,
 * `--ease-out`, NO translate/scale) is scoped to components that appear
 * *in response to a state change* and communicate status feedback
 * (apple-design §16). `FeedSourceStatusBanner` mounts when a news source
 * starts failing — a gentle entrance there earns its place.
 *
 * Permanent placeholders (`UnderConstruction`, `LibraryLinkRequired`,
 * `DiscogsRelinkNotice`) render on first paint as static wayfinding copy;
 * an entrance animation there adds no signal and put an ancestor `opacity`
 * ramp under the axe-core contrast scanner (axe folds ancestor opacity into
 * its contrast maths, so a mid-fade scan read the muted body text as a
 * false-positive `color-contrast` violation). Per emil-design-eng
 * ("does it earn its place?") and YAGNI, those three do not animate.
 */
describe('status-message entrance (US5 / T086, revised T097)', () => {
  it('FeedSourceStatusBanner fades its status role in when a source fails', () => {
    render(
      <FeedSourceStatusBanner
        sourceStatuses={[
          { sourceId: 's1', sourceName: 'Loudwire', status: 'unavailable' },
        ]}
      />,
    );

    expect(screen.getByRole('status')).toHaveClass('status-fade-in');
  });

  it('UnderConstruction renders as static wayfinding copy — no entrance animation', () => {
    render(<UnderConstruction title="Dashboard" />);

    expect(screen.getByText(/under construction/i).closest('div')).not.toHaveClass(
      'status-fade-in',
    );
    expect(screen.getByText(/check back soon/i)).toBeInTheDocument();
  });

  it('LibraryLinkRequired renders statically and points the user to a way out — no entrance animation', () => {
    render(
      <MemoryRouter>
        <LibraryLinkRequired variant="not-linked" />
      </MemoryRouter>,
    );

    const card = screen.getByRole('heading').closest('div');
    expect(card).not.toHaveClass('status-fade-in');
    expect(screen.getByRole('link', { name: /go to your profile/i })).toHaveAttribute(
      'href',
      '/app/profile',
    );
  });

  it('DiscogsRelinkNotice renders statically — no entrance animation', () => {
    render(
      <MemoryRouter>
        <DiscogsRelinkNotice />
      </MemoryRouter>,
    );

    expect(screen.getByText(/no longer valid/i).closest('div')).not.toHaveClass(
      'status-fade-in',
    );
  });
});
