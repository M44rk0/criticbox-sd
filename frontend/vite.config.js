import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const GATEWAY_URL = process.env.VITE_GATEWAY_URL || 'http://localhost:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/movies': GATEWAY_URL,
      '/reviews': GATEWAY_URL,
      '/auth': GATEWAY_URL,
      '/docs': GATEWAY_URL,
      '/openapi.json': GATEWAY_URL,
    }
  }
})
