import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { BrandingProvider } from '@/lib/BrandingProvider';
import { AuthStatusProvider } from '@/lib/AuthStatusProvider';
import { UndoProvider } from '@/lib/UndoContext';
import { FileBrowser } from '@/pages/FileBrowser';
import { Home } from '@/pages/Home';
import { Runner } from '@/pages/Runner';
import { RunnerJob } from '@/pages/RunnerJob';
import { PublicContent } from '@/pages/PublicContent';

export default function App() {
  return (
    <BrandingProvider>
      <AuthStatusProvider>
        <BrowserRouter>
          <UndoProvider>
            <Routes>
              <Route path="/readme" element={<PublicContent key="readme" slug="readme" />} />
              <Route path="/privacy" element={<PublicContent key="privacy" slug="privacy" />} />
              <Route path="/terms" element={<PublicContent key="terms" slug="terms" />} />
              <Route path="/runner/:jobId" element={<RunnerJob />} />
              <Route path="/runner" element={<Runner />} />
              <Route path="/browse/*" element={<FileBrowser />} />
              <Route path="/" element={<Home />} />
            </Routes>
          </UndoProvider>
        </BrowserRouter>
      </AuthStatusProvider>
    </BrandingProvider>
  );
}
