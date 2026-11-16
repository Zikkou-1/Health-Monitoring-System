import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const target = process.env.API_TARGET || 'http://127.0.0.1:5001'

export default defineConfig({
  plugins: [react()],
  esbuild: { jsx: 'automatic' },
  server: { port: 5001, proxy: { '/api': { target, changeOrigin: true } } },
})