import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * 开发时代理到后端的端口：API_PORT 环境变量优先，其次 api/.env 里后端用的 PORT，默认 3001。
 * 不读前端自己环境里的 PORT，那常常是给前端开发服务器用的，读了会代理到自己。
 */
function apiPort() {
  if (process.env.API_PORT) return process.env.API_PORT
  const file = path.resolve(import.meta.dirname, 'api/.env')
  const m = existsSync(file) ? /^\s*PORT\s*=\s*["']?(\d+)/m.exec(readFileSync(file, 'utf8')) : null
  return m?.[1] ?? '3001'
}

// https://vite.dev/config/
export default defineConfig(() => {
  const port = apiPort()
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
        '/api': `http://localhost:${port}`,
        '/ws': { target: `ws://localhost:${port}`, ws: true },
      },
    },
  }
})
