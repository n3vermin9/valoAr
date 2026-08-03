import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Allow Cap app on a physical phone to load the Vite dev server.
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
})
