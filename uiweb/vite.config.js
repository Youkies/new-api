import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// uiweb is served at /u/* by the newapi Go backend via a second //go:embed
// Keep base in sync with router/uiweb-router.go
export default defineConfig({
  plugins: [react()],
  base: '/u/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5174,
    strictPort: false,
    // Proxy target is the local test instance (3001), not production (3000).
    // Keeps dev traffic isolated from any real running newapi on port 3000.
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/v1': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
