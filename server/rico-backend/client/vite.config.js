import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies API calls to the Express backend on :3000 so
// `npm run dev` here works against a locally running rico-backend without
// CORS friction. In production, Express serves this app's build output
// directly (same origin, no proxy needed).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/search': 'http://localhost:3000',
      '/deals': 'http://localhost:3000',
      '/classify': 'http://localhost:3000',
      '/places': 'http://localhost:3000',
      '/submit-deal': 'http://localhost:3000',
      '/business': { target: 'http://localhost:3000', changeOrigin: true },
      '/admin': 'http://localhost:3000',
    },
  },
});
