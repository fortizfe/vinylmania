import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';

// Fresh, retry-disabled QueryClient per test so cache state never leaks
// across test cases and failures surface immediately instead of retrying.
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

export function renderWithQueryClient(ui: ReactElement, client: QueryClient = createTestQueryClient()): RenderResult {
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
