import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VinylmaniaWordmark } from '../../../src/components/brand/VinylmaniaWordmark';

describe('VinylmaniaWordmark', () => {
  it('renders the text "VINYLMANIA" in the display font', () => {
    render(<VinylmaniaWordmark />);

    const wordmark = screen.getByText('VINYLMANIA');
    expect(wordmark).toBeInTheDocument();
    expect(wordmark).toHaveClass('font-display');
  });

  it('applies the grunge filter style only when grunge is true', () => {
    render(<VinylmaniaWordmark grunge />);

    const wordmark = screen.getByText('VINYLMANIA');
    expect(wordmark.style.filter).toBe('url(#vm-wordmark-grunge)');
  });

  it('omits the grunge filter style when grunge is false or absent', () => {
    const { rerender } = render(<VinylmaniaWordmark />);
    expect(screen.getByText('VINYLMANIA').style.filter).toBe('');

    rerender(<VinylmaniaWordmark grunge={false} />);
    expect(screen.getByText('VINYLMANIA').style.filter).toBe('');
  });

  it('accepts a passthrough className for size overrides', () => {
    render(<VinylmaniaWordmark className="text-xl" />);

    expect(screen.getByText('VINYLMANIA')).toHaveClass('text-xl');
  });
});
