import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Cornerstone requiere estos módulos específicos de Node.js
      include: ['events', 'stream', 'util', 'buffer'],
    }),
  ],
  server: {
    host: true,
    port: 5173,
    headers: {
      "Cross-Origin-Embedder-Policy": "credentialless",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
    watch: {
      usePolling: true,
    },
    allowedHosts: [
      'erratic-irritable-occupier.ngrok-free.dev',
      '.ngrok-free.dev',
      'portal.mipacs.net'
    ],
    proxy: {
      '/api': {
        target: 'http://192.168.5.21:8000',
        changeOrigin: true,
      }
    }
  }
})