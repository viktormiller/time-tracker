import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Backend dev server, overridable when port 3000 is taken (BACKEND_URL=http://127.0.0.1:3010 npm run dev)
const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:3000'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: backendUrl, // Leitet an Backend weiter
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: backendUrl,
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
