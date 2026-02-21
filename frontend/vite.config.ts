import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig(({ command }) => ({
    // Base path: '/' for dev, '/app/' for production build
    base: command === 'build' ? '/app/' : '/',
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 5177,
        proxy: {
            '/api': {
                target: 'http://localhost:8000',
                changeOrigin: true
            },
            '/static': {
                target: 'http://localhost:8000',
                changeOrigin: true
            },
            '/login': {
                target: 'http://localhost:8000',
                changeOrigin: true
            },
            '/logout': {
                target: 'http://localhost:8000',
                changeOrigin: true
            },
            '/upload': {
                target: 'http://localhost:8000',
                changeOrigin: true
            },
            '/about': {
                target: 'http://localhost:8000',
                changeOrigin: true
            },
            '/change_password': {
                target: 'http://localhost:8000',
                changeOrigin: true
            },
            '/admin': {
                target: 'http://localhost:8000',
                changeOrigin: true
            },
            '/register': {
                target: 'http://localhost:8000',
                changeOrigin: true
            },
            '/login_azure': {
                target: 'http://localhost:8000',
                changeOrigin: true
            },
            '/request_password_reset': {
                target: 'http://localhost:8000',
                changeOrigin: true
            }
        }
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: true
    }
}))
