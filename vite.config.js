import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { capacitorLiveReload } from './scripts/capacitorDev.mjs'
import { getLocalIp } from './scripts/getLocalIp.mjs'

const DEV_PORT = Number(process.env.CAP_DEV_PORT || 5173)
const rawHost = (process.env.CAP_DEV_HOST || 'localhost').trim().toLowerCase()
const useLan = rawHost === 'lan' || rawHost === 'auto' || rawHost === 'ip'
const resolvedHost = useLan
  ? getLocalIp()
  : process.env.CAP_DEV_HOST?.trim() || 'localhost'
// HMR websocket host must match the URL the WebView actually loads.
const HMR_HOST = process.env.CAP_HMR_HOST || resolvedHost

export default defineConfig({
  plugins: [react(), tailwindcss(), capacitorLiveReload()],
  server: {
    host: '0.0.0.0',
    port: DEV_PORT,
    strictPort: true,
    // Cap sync copies into ios/ — never let that trigger Vite full reloads.
    watch: {
      ignored: [
        '**/ios/**',
        '**/android/**',
        '**/dist/**',
        '**/capacitor.config.json',
        '**/.git/**',
      ],
    },
    hmr: {
      protocol: 'ws',
      host: HMR_HOST,
      port: DEV_PORT,
      clientPort: DEV_PORT,
    },
  },
})
