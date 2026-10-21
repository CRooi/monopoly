import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 后端端口和后端用同一个 PORT：环境变量优先，其次 api/.env，默认 3001
  const apiPort = process.env.PORT || loadEnv(mode, path.resolve(import.meta.dirname, 'api'), '').PORT || '3001'
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
        '@shared': path.resolve(import.meta.dirname, './shared'),
      },
    },
    server: {
      host: true,
      proxy: {
        '/api': `http://localhost:${apiPort}`,
        '/ws': { target: `ws://localhost:${apiPort}`, ws: true },
      },
    },
  }
})
