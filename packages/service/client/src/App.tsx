import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { BrandingProvider } from '@/lib/BrandingProvider';
import { AuthProvider } from '@/lib/auth';
import { useAuth } from '@/lib/AuthContext';
import { UndoProvider } from '@/lib/UndoContext';
import { FileBrowser } from '@/pages/FileBrowser';
import { Home } from '@/pages/Home';
import { Runner } from '@/pages/Runner';
import { RunnerJob } from '@/pages/RunnerJob';
import { PublicContent } from '@/pages/PublicContent';
import { SignIn } from '@/pages/SignIn';

/** Render children when authenticated, SignIn page otherwise. */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, authenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (!authenticated) {
    return <SignIn />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrandingProvider>
      <AuthProvider>
        <BrowserRouter>
          <UndoProvider>
            <Routes>
              <Route path="/readme" element={<PublicContent slug="readme" />} />
              <Route path="/privacy" element={<PublicContent slug="privacy" />} />
              <Route path="/terms" element={<PublicContent slug="terms" />} />
              <Route
                path="*"
                element={
                  <AuthGate>
                    <Routes>
                      <Route path="/runner/:jobId" element={<RunnerJob />} />
                      <Route path="/runner" element={<Runner />} />
                      <Route path="/browse/*" element={<FileBrowser />} />
                      <Route path="/" element={<Home />} />
                    </Routes>
                  </AuthGate>
                }
              />
            </Routes>
          </UndoProvider>
        </BrowserRouter>
      </AuthProvider>
    </BrandingProvider>
  );
}
