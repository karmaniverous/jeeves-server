import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { AuthProvider } from '@/lib/auth';
import { About } from '@/pages/About';
import { FileBrowser } from '@/pages/FileBrowser';
import { Home } from '@/pages/Home';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/browse/*" element={<FileBrowser />} />
          <Route path="/about" element={<About />} />
          <Route path="/" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
