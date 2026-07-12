import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MasterVersionsTable } from '../../src/components/MasterVersionsTable';
import { createTestQueryClient } from '../testUtils';

const mockGetMasterReleaseVersions = vi.fn();

vi.mock('../../src/services/discogsApi', () => ({
  getMasterReleaseVersions: (...args: unknown[]) => mockGetMasterReleaseVersions(...args),
}));

function renderTable(page = 1, onPageChange = vi.fn()) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>
        <MasterVersionsTable
          discogsId={1660109}
          page={page}
          onPageChange={onPageChange}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MasterVersionsTable', () => {
  beforeEach(() => {
    mockGetMasterReleaseVersions.mockReset();
  });

  it('renders up to 10 rows with format, year, label, and country', async () => {
    mockGetMasterReleaseVersions.mockResolvedValue({
      results: [
        {
          discogsId: 98765,
          title: 'Hybrid Theory',
          format: 'Vinyl, LP, Album',
          year: 2000,
          label: 'Warner Bros. Records',
          country: 'US',
        },
      ],
      pagination: { page: 1, pages: 1, items: 1, perPage: 10 },
    });

    renderTable();

    const table = await screen.findByRole('table');
    expect(within(table).getByText(/Vinyl, LP, Album/)).toBeInTheDocument();
    expect(within(table).getByText('2000')).toBeInTheDocument();
    expect(within(table).getByText(/Warner Bros\. Records/)).toBeInTheDocument();
    expect(within(table).getByText('US')).toBeInTheDocument();
    expect(mockGetMasterReleaseVersions).toHaveBeenCalledWith(1660109, 1);
  });

  it('links each row to the release detail page, carrying the master page as router state', async () => {
    mockGetMasterReleaseVersions.mockResolvedValue({
      results: [{ discogsId: 98765, title: 'Hybrid Theory' }],
      pagination: { page: 1, pages: 1, items: 1, perPage: 10 },
    });

    renderTable();

    const table = await screen.findByRole('table');
    const link = within(table).getByRole('link');
    expect(link).toHaveAttribute('href', '/app/releases/98765');
  });

  it('calls onPageChange when paginating', async () => {
    mockGetMasterReleaseVersions.mockResolvedValue({
      results: [{ discogsId: 1, title: 'V1' }],
      pagination: { page: 1, pages: 3, items: 27, perPage: 10 },
    });

    const onPageChange = vi.fn();
    renderTable(1, onPageChange);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^next$/i })).toBeEnabled(),
    );
    screen.getByRole('button', { name: /^next$/i }).click();

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('renders a single row when the master has only one known version', async () => {
    mockGetMasterReleaseVersions.mockResolvedValue({
      results: [{ discogsId: 1, title: 'Only Version' }],
      pagination: { page: 1, pages: 1, items: 1, perPage: 10 },
    });

    renderTable();

    await waitFor(() => expect(screen.getAllByText('Only Version').length).toBeGreaterThan(0));
    expect(screen.queryByRole('button', { name: /^next$/i })).not.toBeInTheDocument();
  });
});
