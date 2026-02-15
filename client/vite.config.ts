import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3457',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:3457',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3457',
        changeOrigin: true,
      },
    },
  },
  base: '/app/',
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
  },
});
