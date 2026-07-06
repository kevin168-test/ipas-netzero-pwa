import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/ipas-netzero-pwa/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      registerSW: true,
      includeAssets: ['favicon.ico', 'icon-192.jpg', 'icon-512.jpg'],
      manifest: {
        name: 'IPAS 淨零碳規劃管理師 模擬測驗系統',
        short_name: 'IPAS 淨零測驗',
        description: '雙科目離線 PWA 刷題與模擬考系統',
        theme_color: '#10b981',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'icon-192.jpg',
            sizes: '192x192',
            type: 'image/jpeg'
          },
          {
            src: 'icon-512.jpg',
            sizes: '512x512',
            type: 'image/jpeg'
          }
        ]
      }
    })
  ]
})
