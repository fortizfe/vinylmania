import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { queryClient } from './lib/queryClient';
import { ThemeProvider } from './theme/ThemeContext';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <div
              data-testid="app-shell"
              className="min-h-dvh bg-white font-sans text-stone-900 antialiased dark:bg-surface dark:text-stone-100"
            >
              <App />
            </div>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
