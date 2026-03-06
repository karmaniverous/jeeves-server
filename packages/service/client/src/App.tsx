import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { AuthProvider } from '@/lib/auth';
import { FileBrowser } from '@/pages/FileBrowser';
import { Home } from '@/pages/Home';
import { Runner } from '@/pages/Runner';
import { RunnerJob } from '@/pages/RunnerJob';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/runner/:jobId" element={<RunnerJob />} />
          <Route path="/runner" element={<Runner />} />
          <Route path="/browse/*" element={<FileBrowser />} />
          <Route path="/" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
