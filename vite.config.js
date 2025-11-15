import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => ({
  base: '/static/dist/',
  build: {
    outDir: 'static/dist',
    assetsDir: 'assets',
    manifest: true,
    emptyOutDir: true,
    sourcemap: mode === 'development',
    rollupOptions: {
      input: {
        chat: resolve(__dirname, 'static/src/main.js'),
        admin: resolve(__dirname, 'static/src/admin.js'),
      },
      output: {
        entryFileNames: '[name].[hash].js',
        chunkFileNames: 'chunks/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]'
      }
    }
  }
}));
