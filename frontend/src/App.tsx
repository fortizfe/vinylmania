import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from './auth/AuthContext';
import { AppHeader } from './components/AppHeader';
import { VinylmaniaGrungeFilter } from './components/brand/VinylmaniaGrungeFilter';
import { DashboardPage } from './pages/DashboardPage';
import { DiscogsCallbackPage } from './pages/DiscogsCallbackPage';
import { LandingPage } from './pages/LandingPage';
import { LibraryListPage } from './pages/LibraryListPage';
import { LoginCallbackPage } from './pages/LoginCallbackPage';
import { ProfilePage } from './pages/ProfilePage';
import { RecordDetailPage } from './pages/RecordDetailPage';
import { MasterReleaseDetailPage } from './pages/MasterReleaseDetailPage';
import { ReleaseDetailPage } from './pages/ReleaseDetailPage';
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
    <>
      <VinylmaniaGrungeFilter />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login/callback" element={<LoginCallbackPage />} />
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
          path="/app/releases/:discogsId"
          element={
            <AuthenticatedLayout>
              <ReleaseDetailPage />
            </AuthenticatedLayout>
          }
        />
        <Route
          path="/app/masters/:discogsId"
          element={
            <AuthenticatedLayout>
              <MasterReleaseDetailPage />
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
    </>
  );
}

export default App;
