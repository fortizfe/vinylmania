import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Proxy API calls to the local backend so the frontend can call
    // relative `/api/...` paths in dev. In production the frontend and
    // backend are separate Vercel projects, so requests instead go to the
    // absolute `VITE_API_BASE_URL` (see services/apiClient.ts).
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_ORIGIN || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
