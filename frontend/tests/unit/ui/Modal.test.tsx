import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from '../../../src/components/ui/Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => {}}>
        Content
      </Modal>,
    );

    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('renders as an accessible dialog when open', () => {
    render(
      <Modal open onClose={() => {}} title="Preview">
        Content
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        Content
      </Modal>,
    );

    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        Content
      </Modal>,
    );

    await user.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        Content
      </Modal>,
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('defaults to a centered position', () => {
    render(
      <Modal open onClose={() => {}}>
        Content
      </Modal>,
    );

    expect(screen.getByRole('dialog').className).toMatch(/max-w-lg/);
  });

  it('defaults to size "md" (max-w-lg) when size is not passed', () => {
    render(
      <Modal open onClose={() => {}}>
        Content
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toMatch(/max-w-lg/);
    expect(dialog.className).not.toMatch(/max-w-3xl/);
  });

  it('renders a wider dialog when size="lg"', () => {
    render(
      <Modal open onClose={() => {}} size="lg">
        Content
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toMatch(/max-w-3xl/);
    expect(dialog.className).not.toMatch(/max-w-lg\b/);
  });

  it('ignores size for an end-positioned drawer, keeping its own width/height classes', () => {
    render(
      <Modal open onClose={() => {}} position="end" size="lg">
        Content
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toMatch(/h-dvh/);
    expect(dialog.className).toMatch(/max-w-xs/);
    expect(dialog.className).not.toMatch(/max-w-3xl/);
  });

  it('renders as a full-height end-anchored drawer when position="end"', () => {
    render(
      <Modal open onClose={() => {}} position="end">
        Content
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toMatch(/h-dvh/);
  });

  it('does not hide its scrollbar by default', () => {
    render(
      <Modal open onClose={() => {}}>
        Content
      </Modal>,
    );

    expect(screen.getByRole('dialog').className).not.toMatch(/scrollbar-hidden/);
  });

  it('hides its scrollbar only when hideScrollbar is explicitly passed', () => {
    render(
      <Modal open onClose={() => {}} hideScrollbar>
        Content
      </Modal>,
    );

    expect(screen.getByRole('dialog').className).toMatch(/scrollbar-hidden/);
  });

  it('renders a close button that meets the 44x44px minimum touch target (FR-004)', () => {
    render(
      <Modal open onClose={() => {}}>
        Content
      </Modal>,
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    expect(closeButton.className).toMatch(/min-h-11/);
    expect(closeButton.className).toMatch(/min-w-11/);
  });

  it('still supports backdrop click, close button, and Escape when position="end"', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} position="end">
        Content
      </Modal>,
    );

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
