import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { AuthProvider } from '@/lib/auth';
import { ContentPage } from '@/pages/ContentPage';
import { FileBrowser } from '@/pages/FileBrowser';
import { Home } from '@/pages/Home';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/browse/*" element={<FileBrowser />} />
          <Route path="/content/:file" element={<ContentPage />} />
          <Route path="/" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
