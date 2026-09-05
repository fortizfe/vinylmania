import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GalleryFullscreenViewer } from '../../src/components/GalleryFullscreenViewer';
import type { CatalogImage } from '../../src/services/libraryApi';

afterEach(() => {
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
  vi.restoreAllMocks();
});

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

  describe('overlay depth & focus management (US3)', () => {
    it('routes through the shared motion Overlay (accessible dialog)', () => {
      render(
        <GalleryFullscreenViewer
          images={images}
          selectedIndex={0}
          onSelect={vi.fn()}
          alt="Stockholm"
          onClose={vi.fn()}
        />,
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('data-variant', 'center');
    });

    it('locks background scroll while open and restores it on unmount', () => {
      const { unmount } = render(
        <GalleryFullscreenViewer
          images={images}
          selectedIndex={0}
          onSelect={vi.fn()}
          alt="Stockholm"
          onClose={vi.fn()}
        />,
      );
      expect(document.body.style.overflow).toBe('hidden');

      unmount();
      expect(document.body.style.overflow).toBe('');
    });

    it('restores focus to the opener when it unmounts', () => {
      const opener = document.createElement('button');
      document.body.appendChild(opener);
      opener.focus();

      const { unmount } = render(
        <GalleryFullscreenViewer
          images={images}
          selectedIndex={0}
          onSelect={vi.fn()}
          alt="Stockholm"
          onClose={vi.fn()}
        />,
      );

      unmount();
      expect(opener).toHaveFocus();
      opener.remove();
    });

    it('closes on Escape', async () => {
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

      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('keeps the near-opaque immersive backdrop (bg-stone-950/90)', () => {
      render(
        <GalleryFullscreenViewer
          images={images}
          selectedIndex={0}
          onSelect={vi.fn()}
          alt="Stockholm"
          onClose={vi.fn()}
        />,
      );

      const scrim = screen.getByTestId('gallery-fullscreen-viewer');
      expect(scrim.className).toMatch(/overlay-scrim/);
      expect(scrim.className).toMatch(/bg-stone-950\/90/);
    });

    it('marks the current thumbnail with aria-current', () => {
      render(
        <GalleryFullscreenViewer
          images={images}
          selectedIndex={2}
          onSelect={vi.fn()}
          alt="Stockholm"
          onClose={vi.fn()}
        />,
      );

      const current = screen.getByRole('button', { name: 'Show image 3 of 3' });
      expect(current).toHaveAttribute('aria-current', 'true');
    });
  });
});
