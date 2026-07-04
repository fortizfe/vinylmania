import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ReleaseImageGallery } from '../../src/components/ReleaseImageGallery';
import type { CatalogImage } from '../../src/services/libraryApi';

const images: CatalogImage[] = [
  { url: 'https://example.com/front.jpg', imageType: 'primary' },
  { url: 'https://example.com/back.jpg', imageType: 'secondary' },
  { url: 'https://example.com/label.jpg', imageType: 'secondary' },
];

describe('ReleaseImageGallery', () => {
  it('renders the primary image as the main image by default, in a square format', () => {
    render(<ReleaseImageGallery images={images} alt="Stockholm" />);

    const mainImage = screen.getByRole('img', { name: 'Stockholm' });
    expect(mainImage).toHaveAttribute('src', 'https://example.com/front.jpg');
    expect(mainImage.parentElement?.className).toMatch(/aspect-square/);
  });

  it('renders the thumbnail strip without a visible scrollbar', () => {
    render(<ReleaseImageGallery images={images} alt="Stockholm" />);

    const thumbnails = screen.getAllByRole('button');
    const thumbnailStrip = thumbnails[0].parentElement;
    expect(thumbnailStrip?.className).toMatch(/scrollbar-hidden/);
    expect(thumbnailStrip?.className).toMatch(/overflow-y-auto/);
  });

  it('falls back to the first image when none is marked primary', () => {
    const noPrimary = images.map((image) => ({ ...image, imageType: 'secondary' as const }));
    render(<ReleaseImageGallery images={noPrimary} alt="Stockholm" />);

    expect(screen.getByRole('img', { name: 'Stockholm' })).toHaveAttribute(
      'src',
      'https://example.com/front.jpg',
    );
  });

  it('renders one clickable thumbnail per image when there is more than one', () => {
    render(<ReleaseImageGallery images={images} alt="Stockholm" />);

    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('updates the main image when a thumbnail is clicked', async () => {
    const user = userEvent.setup();
    render(<ReleaseImageGallery images={images} alt="Stockholm" />);

    const thumbnails = screen.getAllByRole('button');
    await user.click(thumbnails[2]);

    expect(screen.getByRole('img', { name: 'Stockholm' })).toHaveAttribute(
      'src',
      'https://example.com/label.jpg',
    );
  });

  it('renders no thumbnail controls when there is only one image', () => {
    render(<ReleaseImageGallery images={[images[0]]} alt="Stockholm" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Stockholm' })).toBeInTheDocument();
  });

  it('renders the no-image placeholder when there are no images', () => {
    render(<ReleaseImageGallery images={[]} alt="Stockholm" />);

    expect(document.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText(/no cover image available/i)).toBeInTheDocument();
  });
});
