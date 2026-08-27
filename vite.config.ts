import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1000,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['lumpat.online', 'www.lumpat.online'],
    proxy: {
      '/api': {
        target: 'http://localhost:3069',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:3069',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:3069',
        ws: true,
      },
    },
  },
})
