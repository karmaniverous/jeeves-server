import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { About } from '@/pages/About';
import { FileBrowser } from '@/pages/FileBrowser';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/browse/*" element={<FileBrowser />} />
        <Route path="/about" element={<About />} />
        <Route path="/" element={<Navigate to="/browse" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
