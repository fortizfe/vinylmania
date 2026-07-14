import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GalleryFullscreenViewer } from '../../src/components/GalleryFullscreenViewer';
import type { CatalogImage } from '../../src/services/libraryApi';

const images: CatalogImage[] = [
  { url: 'https://example.com/front.jpg', imageType: 'primary' },
  { url: 'https://example.com/back.jpg', imageType: 'secondary' },
  { url: 'https://example.com/label.jpg', imageType: 'secondary' },
];

describe('GalleryFullscreenViewer', () => {
  it('renders the currently selected image', () => {
    render(
      <GalleryFullscreenViewer
        images={images}
        selectedIndex={1}
        onSelect={vi.fn()}
        alt="Stockholm"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('img', { name: 'Stockholm' })).toHaveAttribute(
      'src',
      'https://example.com/back.jpg',
    );
  });

  it('calls onClose when the close control is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <GalleryFullscreenViewer
        images={images}
        selectedIndex={0}
        onSelect={vi.fn()}
        alt="Stockholm"
        onClose={onClose}
      />,
    );

    await user.click(screen.getByTestId('gallery-fullscreen-close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <GalleryFullscreenViewer
        images={images}
        selectedIndex={0}
        onSelect={vi.fn()}
        alt="Stockholm"
        onClose={onClose}
      />,
    );

    await user.click(screen.getByTestId('gallery-fullscreen-viewer'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when the enlarged image itself is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <GalleryFullscreenViewer
        images={images}
        selectedIndex={0}
        onSelect={vi.fn()}
        alt="Stockholm"
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole('img', { name: 'Stockholm' }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders one thumbnail per image and calls onSelect when clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <GalleryFullscreenViewer
        images={images}
        selectedIndex={0}
        onSelect={onSelect}
        alt="Stockholm"
        onClose={vi.fn()}
      />,
    );

    const thumbnails = screen.getAllByRole('button', { name: /show image \d of 3/i });
    expect(thumbnails).toHaveLength(3);

    await user.click(thumbnails[2]);

    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('renders no thumbnail strip when there is only one image', () => {
    render(
      <GalleryFullscreenViewer
        images={[images[0]]}
        selectedIndex={0}
        onSelect={vi.fn()}
        alt="Stockholm"
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /show image/i })).not.toBeInTheDocument();
  });
});
