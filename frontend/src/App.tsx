import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from './auth/AuthContext';
import { AppHeader } from './components/AppHeader';
import { AddRecordPage } from './pages/AddRecordPage';
import { LandingPage } from './pages/LandingPage';
import { LibraryListPage } from './pages/LibraryListPage';
import { RecordDetailPage } from './pages/RecordDetailPage';

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
            <LibraryListPage />
          </AuthenticatedLayout>
        }
      />
      <Route
        path="/app/add"
        element={
          <AuthenticatedLayout>
            <AddRecordPage />
          </AuthenticatedLayout>
        }
      />
      <Route
        path="/app/records/:entryId"
        element={
          <AuthenticatedLayout>
            <RecordDetailPage />
          </AuthenticatedLayout>
        }
      />
    </Routes>
  );
}

export default App;
