import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['hero.png', 'react.svg'],
      manifest: {
        name: 'PocketLog',
        short_name: 'PocketLog',
        description: 'Serverless Expense Tracker',
        theme_color: '#020617',
        icons: [
          {
            src: 'react.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'react.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
  server: {
    proxy: {
      '/api': {
        // You can change this to your deployed API Gateway URL for local testing
        // or rely on CloudFront in production.
        target: process.env.VITE_API_URL || 'https://a96s1wn6z1.execute-api.us-east-1.amazonaws.com',
        changeOrigin: true,
      }
    }
  }
})
