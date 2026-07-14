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

function getThumbnails() {
  return screen.getAllByRole('button', { name: /show image \d of \d/i });
}

describe('ReleaseImageGallery', () => {
  it('renders the primary image as the main image by default, in a square format', () => {
    render(<ReleaseImageGallery images={images} alt="Stockholm" />);

    const mainImage = screen.getByRole('img', { name: 'Stockholm' });
    expect(mainImage).toHaveAttribute('src', 'https://example.com/front.jpg');
    expect(mainImage.closest('div')?.className).toMatch(/aspect-square/);
  });

  it('caps the root container at a contained desktop width', () => {
    const { container } = render(<ReleaseImageGallery images={images} alt="Stockholm" />);

    expect(container.firstElementChild?.className).toMatch(/max-w-md/);
  });

  it('clips the root container so it cannot grow taller than its own width (WebKit aspect-ratio/overflow fix)', () => {
    const { container } = render(<ReleaseImageGallery images={images} alt="Stockholm" />);

    expect(container.firstElementChild?.className).toMatch(/overflow-hidden/);
  });

  it('renders the thumbnail strip without a visible scrollbar', () => {
    render(<ReleaseImageGallery images={images} alt="Stockholm" />);

    const thumbnailStrip = getThumbnails()[0].parentElement;
    expect(thumbnailStrip?.className).toMatch(/scrollbar-hidden/);
    expect(thumbnailStrip?.className).toMatch(/overflow-y-auto/);
  });

  it('caps the thumbnail column height so it can never exceed the viewer (min-h-0)', () => {
    render(<ReleaseImageGallery images={images} alt="Stockholm" />);

    const thumbnailStrip = getThumbnails()[0].parentElement;
    expect(thumbnailStrip?.className).toMatch(/min-h-0/);
  });

  it('falls back to the first image when none is marked primary', () => {
    const noPrimary = images.map((image) => ({
      ...image,
      imageType: 'secondary' as const,
    }));
    render(<ReleaseImageGallery images={noPrimary} alt="Stockholm" />);

    expect(screen.getByRole('img', { name: 'Stockholm' })).toHaveAttribute(
      'src',
      'https://example.com/front.jpg',
    );
  });

  it('renders one clickable thumbnail per image when there is more than one', () => {
    render(<ReleaseImageGallery images={images} alt="Stockholm" />);

    expect(getThumbnails()).toHaveLength(3);
  });

  it('updates the main image when a thumbnail is clicked', async () => {
    const user = userEvent.setup();
    render(<ReleaseImageGallery images={images} alt="Stockholm" />);

    await user.click(getThumbnails()[2]);

    expect(screen.getByRole('img', { name: 'Stockholm' })).toHaveAttribute(
      'src',
      'https://example.com/label.jpg',
    );
  });

  it('renders no thumbnail controls when there is only one image', () => {
    render(<ReleaseImageGallery images={[images[0]]} alt="Stockholm" />);

    expect(screen.queryByRole('button', { name: /show image/i })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Stockholm' })).toBeInTheDocument();
  });

  it('renders the no-image placeholder when there are no images', () => {
    render(<ReleaseImageGallery images={[]} alt="Stockholm" />);

    expect(document.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText(/no cover image available/i)).toBeInTheDocument();
  });

  it('makes the main image clickable and keyboard-accessible to open the fullscreen viewer', () => {
    render(<ReleaseImageGallery images={images} alt="Stockholm" />);

    expect(
      screen.getByRole('button', { name: /view stockholm fullscreen/i }),
    ).toBeInTheDocument();
  });

  it('opens the fullscreen viewer, showing the currently selected image, when the main image is clicked', async () => {
    const user = userEvent.setup();
    render(<ReleaseImageGallery images={images} alt="Stockholm" />);

    expect(screen.queryByTestId('gallery-fullscreen-viewer')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /view stockholm fullscreen/i }));

    expect(screen.getByTestId('gallery-fullscreen-viewer')).toBeInTheDocument();
  });

  it('opens the fullscreen viewer on whatever image was selected in the embedded viewer, not always the primary one (edge case)', async () => {
    const user = userEvent.setup();
    render(<ReleaseImageGallery images={images} alt="Stockholm" />);

    await user.click(getThumbnails()[1]);
    expect(screen.getByRole('img', { name: 'Stockholm' })).toHaveAttribute(
      'src',
      'https://example.com/back.jpg',
    );

    await user.click(screen.getByRole('button', { name: /view stockholm fullscreen/i }));

    const fullscreenViewer = screen.getByTestId('gallery-fullscreen-viewer');
    expect(fullscreenViewer.querySelector('img[alt="Stockholm"]')).toHaveAttribute(
      'src',
      'https://example.com/back.jpg',
    );
  });

  it('opens the fullscreen viewer when the main image is focused and Enter is pressed', async () => {
    const user = userEvent.setup();
    render(<ReleaseImageGallery images={images} alt="Stockholm" />);

    screen.getByRole('button', { name: /view stockholm fullscreen/i }).focus();
    await user.keyboard('{Enter}');

    expect(screen.getByTestId('gallery-fullscreen-viewer')).toBeInTheDocument();
  });

  it('opens the fullscreen viewer when the main image is focused and Space is pressed', async () => {
    const user = userEvent.setup();
    render(<ReleaseImageGallery images={images} alt="Stockholm" />);

    screen.getByRole('button', { name: /view stockholm fullscreen/i }).focus();
    await user.keyboard(' ');

    expect(screen.getByTestId('gallery-fullscreen-viewer')).toBeInTheDocument();
  });

  it('does not open a fullscreen viewer when the no-image placeholder is clicked', async () => {
    const user = userEvent.setup();
    render(<ReleaseImageGallery images={[]} alt="Stockholm" />);

    await user.click(screen.getByText(/no cover image available/i));

    expect(screen.queryByTestId('gallery-fullscreen-viewer')).not.toBeInTheDocument();
  });

  it('opens the fullscreen viewer with no thumbnail strip when there is only one image', async () => {
    const user = userEvent.setup();
    render(<ReleaseImageGallery images={[images[0]]} alt="Stockholm" />);

    await user.click(screen.getByRole('button', { name: /view stockholm fullscreen/i }));

    expect(screen.getByTestId('gallery-fullscreen-viewer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show image/i })).not.toBeInTheDocument();
  });

  it('shares selection between the fullscreen and embedded viewers: selecting a thumbnail in fullscreen updates the embedded main image after closing', async () => {
    const user = userEvent.setup();
    render(<ReleaseImageGallery images={images} alt="Stockholm" />);

    await user.click(screen.getByRole('button', { name: /view stockholm fullscreen/i }));
    await user.click(
      screen
        .getByTestId('gallery-fullscreen-viewer')
        .querySelector('button[aria-label="Show image 3 of 3"]')!,
    );
    await user.click(screen.getByTestId('gallery-fullscreen-close'));

    expect(screen.queryByTestId('gallery-fullscreen-viewer')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Stockholm' })).toHaveAttribute(
      'src',
      'https://example.com/label.jpg',
    );
  });
});
