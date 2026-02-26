import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  // Base path: /admin-app/ for production build
  base: '/admin-app/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5179,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/api/v1': {
        target: 'http://localhost:8001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../../dist/admin-app',
    emptyOutDir: true,
    sourcemap: true
  }
})
