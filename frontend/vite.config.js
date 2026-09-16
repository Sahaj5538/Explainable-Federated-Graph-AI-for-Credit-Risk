import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev server: `npm run dev` -> http://localhost:5173
// /api requests are proxied to the FastAPI backend on port 8000.
// Production: `npm run build` -> frontend/dist, served by FastAPI.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
