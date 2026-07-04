import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { AuthProvider } from './auth/AuthContext';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-dvh bg-white font-sans text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
          <App />
        </div>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
