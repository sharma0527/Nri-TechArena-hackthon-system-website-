import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'nri-techarena-hackathon-system-website-main-frontend-production.up.render.com'
    ]
  }
})
