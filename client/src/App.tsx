import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { FileBrowser } from '@/pages/FileBrowser';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/browse/*" element={<FileBrowser />} />
        <Route path="/" element={<Navigate to="/browse" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
