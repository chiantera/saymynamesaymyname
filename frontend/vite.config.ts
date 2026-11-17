// Adapted from SchedaPRO: same-origin API proxy. Root assets also work on auth routes.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { previewHeaders } from './security-headers.mjs';
export default defineConfig(({ isPreview }) => ({
  base: '/', plugins: [react()],
  server: { port: 5174, strictPort: true, fs: { allow: ['..'] },
    proxy: { '/api': process.env.DEMO_API_TARGET ?? 'http://127.0.0.1:8002' } },
  preview: { headers: isPreview ? previewHeaders(process.env) : undefined },
  build: { rollupOptions: { output: { manualChunks: { 'vendor-react': ['react', 'react-dom'] } } } },
}));
