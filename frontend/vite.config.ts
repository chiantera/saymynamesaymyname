// Adapted from our SchedaPRO Vite configuration: relative assets + same-origin API proxy.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: './', plugins: [react()],
  server: { port: 5174, strictPort: true, fs: { allow: ['..'] },
    proxy: { '/api': process.env.DEMO_API_TARGET ?? 'http://127.0.0.1:8002' } },
  build: { rollupOptions: { output: { manualChunks: { 'vendor-react': ['react', 'react-dom'] } } } },
});
