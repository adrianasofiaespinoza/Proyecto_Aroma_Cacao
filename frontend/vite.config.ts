import { defineConfig } from 'vitest/config'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const API = 'http://127.0.0.1:8000'
const API_ROUTES = [
  '/auth', '/products', '/movements', '/users', '/alerts', '/categories', '/units',
  '/machines', '/loans', '/workers', '/suppliers', '/lots', '/public', '/health',
]

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: Object.fromEntries(API_ROUTES.map((route) => [route, API])),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
