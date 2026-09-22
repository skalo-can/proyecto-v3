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
    host: true, // Permite que el servidor sea accesible fuera del contenedor Docker
    port: 5173, // Asegura el puerto expuesto
    
    // 🚀 AQUÍ ESTÁ LA MAGIA: Cabeceras de aislamiento para habilitar SharedArrayBuffer
    headers: {
      "Cross-Origin-Embedder-Policy": "credentialless",
      "Cross-Origin-Opener-Policy": "same-origin",
    },

    watch: {
      usePolling: true, // 🔥 Obliga a Vite a buscar cambios, solucionando el bloqueo de Ctrl+S
    },
    // Agregamos esto para permitir que Ngrok y Cloudflare se conecten sin bloqueos
    allowedHosts: [
      'erratic-irritable-occupier.ngrok-free.dev',
      '.ngrok-free.dev',
      'portal.mipacs.net' // <-- Tu dominio público agregado aquí
    ],
    proxy: {
      // Todo lo que empiece con /api será redirigido internamente a FastAPI
      '/api': {
        target: 'http://192.168.5.21:8000',
        changeOrigin: true,
      }
    }
  }
})