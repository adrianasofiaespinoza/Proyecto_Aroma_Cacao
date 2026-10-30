import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/products': 'http://127.0.0.1:8000',
      '/movements': 'http://127.0.0.1:8000',
      '/users': 'http://127.0.0.1:8000',
      '/alerts': 'http://127.0.0.1:8000',
      '/public': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
    },
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        login: resolve(import.meta.dirname, 'login.html'),
        dashboard: resolve(import.meta.dirname, 'dashboard.html'),
        productos: resolve(import.meta.dirname, 'productos.html'),
        movimientos: resolve(import.meta.dirname, 'movimientos.html'),
        proveedores: resolve(import.meta.dirname, 'proveedores.html'),
        usuarios: resolve(import.meta.dirname, 'usuarios.html'),
        maquinas: resolve(import.meta.dirname, 'maquinas.html'),
        prestamos: resolve(import.meta.dirname, 'prestamos.html'),
      },
    },
  },
})