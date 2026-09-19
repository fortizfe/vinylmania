import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FeedArticleCard } from '../../src/components/FeedArticleCard';
import type { Article } from '../../src/services/feedsApi';

const baseArticle: Article = {
  id: '1',
  title: 'DEVILDRIVER Unleash New Video',
  excerpt: 'Off their new album.',
  publishedAt: '2026-07-07T21:17:03.000Z',
  link: 'https://metalinjection.net/new-music/devildriver',
  sourceId: 'metal-injection',
  sourceName: 'Metal Injection',
  category: 'News',
};

describe('FeedArticleCard', () => {
  it('renders the provided image when present', () => {
    const { container } = render(
      <FeedArticleCard
        article={{ ...baseArticle, imageUrl: 'https://cdn.example.com/cover.jpg' }}
      />,
    );

    const image = container.querySelector('img');
    expect(image).toHaveAttribute('src', 'https://cdn.example.com/cover.jpg');
    expect(
      screen.queryByTestId('feed-article-thumbnail-placeholder'),
    ).not.toBeInTheDocument();
  });

  it('renders a consistent placeholder graphic when no image is available', () => {
    render(<FeedArticleCard article={baseArticle} />);

    expect(screen.getByTestId('feed-article-thumbnail-placeholder')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  describe('Portada variants (feature 067, US2, FR-009, FR-011, FR-012, plan.md variant table)', () => {
    const NOW = new Date('2026-09-19T12:00:00.000Z');
    const withImage: Article = {
      ...baseArticle,
      imageUrl: 'https://cdn.example.com/cover.jpg',
      publishedAt: '2026-09-19T09:00:00.000Z', // 3h before NOW
    };
    const variants = ['lead', 'tile', 'row'] as const;

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const imageBox = (container: HTMLElement) =>
      container.querySelector('img')?.parentElement as HTMLElement;

    it.each(variants)('%s: the title is an h3', (variant) => {
      render(<FeedArticleCard article={withImage} variant={variant} />);

      expect(
        screen.getByRole('heading', { level: 3, name: baseArticle.title }),
      ).toBeInTheDocument();
    });

    it.each(variants)(
      '%s: one link opens the original in a new tab, named by the title',
      (variant) => {
        render(<FeedArticleCard article={withImage} variant={variant} />);

        const links = screen.getAllByRole('link');
        expect(links).toHaveLength(1);
        expect(screen.getByRole('link', { name: baseArticle.title })).toBe(links[0]);
        expect(links[0]).toHaveAttribute('href', baseArticle.link);
        expect(links[0]).toHaveAttribute('target', '_blank');
        expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer');
      },
    );

    it.each(variants)(
      '%s: shows the source and relative age in a <time>, with the full date on hover and for AT',
      (variant) => {
        const { container } = render(
          <FeedArticleCard article={withImage} variant={variant} />,
        );

        expect(screen.getByText(/Metal Injection/)).toBeInTheDocument();

        const time = container.querySelector('time') as HTMLTimeElement;
        expect(time).toHaveAttribute('datetime', withImage.publishedAt);
        expect(time).toHaveTextContent('3h ago');

        const fullDate = time.getAttribute('title') ?? '';
        expect(fullDate).toMatch(/2026/);

        const srOnly = time.querySelector('.sr-only');
        expect(srOnly).not.toBeNull();
        expect(srOnly).toHaveTextContent(fullDate);
      },
    );

    it.each(variants)(
      '%s: the link is named by the title and described by the source and full date (FR-011)',
      (variant) => {
        render(<FeedArticleCard article={withImage} variant={variant} />);

        const link = screen.getByRole('link', { name: baseArticle.title });
        // jsdom's accname inserts a space before the sr-only span; browsers don't.
        expect(link).toHaveAccessibleDescription(
          /^Metal Injection · 3h ago ?, September 19, 2026$/,
        );
      },
    );

    it.each(variants)('%s: no longer shows a category badge (FR-013)', (variant) => {
      render(<FeedArticleCard article={withImage} variant={variant} />);

      expect(screen.queryByText(baseArticle.category)).not.toBeInTheDocument();
    });

    it('lead: shows the excerpt (hidden below sm, 2-line clamp) and loads the image eagerly with high priority', () => {
      const { container } = render(
        <FeedArticleCard article={withImage} variant="lead" />,
      );

      const excerpt = screen.getByText(baseArticle.excerpt);
      expect(excerpt.className).toMatch(/(^|\s)hidden(\s|$)/);
      expect(excerpt.className).toMatch(/line-clamp-2/);

      const image = container.querySelector('img');
      expect(image).toHaveAttribute('loading', 'eager');
      expect(image).toHaveAttribute('fetchpriority', 'high');
      expect(imageBox(container)).toHaveClass('aspect-video');
    });

    it('lead: clamps the title to 3 lines in the display font', () => {
      render(<FeedArticleCard article={withImage} variant="lead" />);

      const title = screen.getByRole('heading', { level: 3 });
      expect(title).toHaveClass('line-clamp-3');
      expect(title).toHaveClass('font-display');
    });

    it('tile: shows no excerpt, loads the image lazily in a 16:9 box and clamps the title to 3 lines', () => {
      const { container } = render(
        <FeedArticleCard article={withImage} variant="tile" />,
      );

      expect(screen.queryByText(baseArticle.excerpt)).not.toBeInTheDocument();
      const image = container.querySelector('img');
      expect(image).toHaveAttribute('loading', 'lazy');
      expect(image).not.toHaveAttribute('fetchpriority', 'high');
      expect(imageBox(container)).toHaveClass('aspect-video');
      expect(screen.getByRole('heading', { level: 3 })).toHaveClass('line-clamp-3');
    });

    it('row: renders a square lazy thumbnail, no excerpt, and clamps the title to 2 lines', () => {
      const { container } = render(<FeedArticleCard article={withImage} variant="row" />);

      expect(imageBox(container).className).toMatch(/aspect-square|(^|\s)size-\d+/);
      expect(imageBox(container)).not.toHaveClass('aspect-video');
      expect(container.querySelector('img')).toHaveAttribute('loading', 'lazy');
      expect(screen.queryByText(baseArticle.excerpt)).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3 })).toHaveClass('line-clamp-2');
    });

    it('row: the placeholder fills the same square box when there is no image', () => {
      render(
        <FeedArticleCard article={{ ...withImage, imageUrl: undefined }} variant="row" />,
      );

      const box = screen.getByTestId('feed-article-thumbnail-placeholder')
        .parentElement as HTMLElement;
      expect(box.className).toMatch(/aspect-square|(^|\s)size-\d+/);
    });

    it('gives every source the same card structure for a given variant (equal prominence, feature 033 SC-004)', () => {
      const classNamesFor = (sourceName: string) => {
        const { container, unmount } = render(
          <FeedArticleCard article={{ ...withImage, sourceName }} variant="tile" />,
        );
        const className = (container.firstChild as HTMLElement).className;
        unmount();
        return className;
      };

      expect(classNamesFor('Sample Source')).toBe(classNamesFor('Metal Injection'));
    });
  });

  describe('decorative image and monogram placeholder (feature 067, US1, FR-007, FR-008, D9)', () => {
    const withImage = { ...baseArticle, imageUrl: 'https://cdn.example.com/cover.jpg' };

    it('treats the image as decorative so the title is not announced twice', () => {
      const { container } = render(<FeedArticleCard article={withImage} />);

      expect(container.querySelector('img')).toHaveAttribute('alt', '');
      expect(screen.queryByRole('img', { name: baseArticle.title })).toBeNull();
    });

    it('does not send a referrer to the image host', () => {
      const { container } = render(<FeedArticleCard article={withImage} />);

      expect(container.querySelector('img')).toHaveAttribute(
        'referrerpolicy',
        'no-referrer',
      );
    });

    it('shows a hidden-from-AT source monogram placeholder when there is no image', () => {
      render(<FeedArticleCard article={baseArticle} />);

      const placeholder = screen.getByTestId('feed-article-thumbnail-placeholder');
      expect(placeholder).toHaveTextContent('MI');
      expect(placeholder).toHaveAttribute('aria-hidden', 'true');
    });

    it('swaps a failed image for the placeholder inside the same fixed-aspect box', () => {
      const { container } = render(<FeedArticleCard article={withImage} />);

      const image = container.querySelector('img') as HTMLImageElement;
      const box = image.parentElement as HTMLElement;
      expect(box.className).toMatch(/aspect-/);

      fireEvent.error(image);

      expect(container.querySelector('img')).toBeNull();
      const placeholder = screen.getByTestId('feed-article-thumbnail-placeholder');
      expect(box).toContainElement(placeholder);
      expect(placeholder).toHaveTextContent('MI');
    });
  });
});
