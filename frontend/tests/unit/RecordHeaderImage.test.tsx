import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RecordHeaderImage } from '../../src/components/RecordHeaderImage';

describe('RecordHeaderImage', () => {
  it('renders a placeholder when there are no images', () => {
    render(<RecordHeaderImage images={[]} alt="Stockholm" />);

    expect(screen.getByText(/no cover image available/i)).toBeInTheDocument();
    expect(screen.queryByRole('img')).toHaveAccessibleName(/no cover image available/i);
  });

  it('renders the primary image when present', () => {
    render(
      <RecordHeaderImage
        images={[
          { url: 'https://example.com/secondary.jpg', imageType: 'secondary' },
          { url: 'https://example.com/primary.jpg', imageType: 'primary' },
        ]}
        alt="Stockholm"
      />,
    );

    const image = screen.getByRole('img', { name: 'Stockholm' });
    expect(image).toHaveAttribute('src', 'https://example.com/primary.jpg');
  });

  it('falls back to the first image when none is marked primary', () => {
    render(
      <RecordHeaderImage
        images={[{ url: 'https://example.com/only.jpg', imageType: 'secondary' }]}
        alt="Stockholm"
      />,
    );

    expect(screen.getByRole('img', { name: 'Stockholm' })).toHaveAttribute(
      'src',
      'https://example.com/only.jpg',
    );
  });
});
