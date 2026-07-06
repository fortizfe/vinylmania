import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from './auth/AuthContext';
import { AppHeader } from './components/AppHeader';
import { DashboardPage } from './pages/DashboardPage';
import { DiscogsCallbackPage } from './pages/DiscogsCallbackPage';
import { LandingPage } from './pages/LandingPage';
import { LibraryListPage } from './pages/LibraryListPage';
import { ProfilePage } from './pages/ProfilePage';
import { RecordDetailPage } from './pages/RecordDetailPage';
import { SearchResultsPage } from './pages/SearchResultsPage';
import { WishlistPage } from './pages/WishlistPage';

function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (!loading && !user) {
    return <Navigate to="/" replace />;
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/app"
        element={
          <AuthenticatedLayout>
            <DashboardPage />
          </AuthenticatedLayout>
        }
      />
      <Route
        path="/app/library"
        element={
          <AuthenticatedLayout>
            <LibraryListPage />
          </AuthenticatedLayout>
        }
      />
      <Route
        path="/app/search"
        element={
          <AuthenticatedLayout>
            <SearchResultsPage />
          </AuthenticatedLayout>
        }
      />
      <Route
        path="/app/library/records/:entryId"
        element={
          <AuthenticatedLayout>
            <RecordDetailPage />
          </AuthenticatedLayout>
        }
      />
      <Route
        path="/app/wishlist"
        element={
          <AuthenticatedLayout>
            <WishlistPage />
          </AuthenticatedLayout>
        }
      />
      <Route
        path="/app/profile"
        element={
          <AuthenticatedLayout>
            <ProfilePage />
          </AuthenticatedLayout>
        }
      />
      <Route
        path="/app/profile/discogs/callback"
        element={
          <AuthenticatedLayout>
            <DiscogsCallbackPage />
          </AuthenticatedLayout>
        }
      />
    </Routes>
  );
}

export default App;
