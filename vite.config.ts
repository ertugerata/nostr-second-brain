import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          'react-force-graph': ['react-force-graph-2d', 'react-force-graph-3d'],
          ndk: ['@nostr-dev-kit/ndk', 'nostr-tools']
        }
      }
    }
  }
});
