import { Route, Routes } from 'react-router-dom';

import { AuthenticatedPlaceholderPage } from './pages/AuthenticatedPlaceholderPage';
import { LandingPage } from './pages/LandingPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<AuthenticatedPlaceholderPage />} />
    </Routes>
  );
}

export default App;
