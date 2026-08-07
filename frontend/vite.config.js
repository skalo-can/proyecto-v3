import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Agregamos esto para permitir que Ngrok se conecte sin bloqueos
    allowedHosts: [
      'erratic-irritable-occupier.ngrok-free.dev',
      '.ngrok-free.dev'
    ],
    proxy: {
      // Todo lo que empiece con /api será redirigido internamente a FastAPI
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  }
})