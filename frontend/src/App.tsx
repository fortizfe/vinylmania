import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from './auth/AuthContext';
import { AppHeader } from './components/AppHeader';
import { AddRecordPage } from './pages/AddRecordPage';
import { DashboardPage } from './pages/DashboardPage';
import { LandingPage } from './pages/LandingPage';
import { LibraryListPage } from './pages/LibraryListPage';
import { ProfilePage } from './pages/ProfilePage';
import { RecordDetailPage } from './pages/RecordDetailPage';
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
        path="/app/library/add"
        element={
          <AuthenticatedLayout>
            <AddRecordPage />
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
    </Routes>
  );
}

export default App;
