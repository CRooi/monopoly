import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 后台面板单独打包：产物放在 dist-admin/（不在公开的 dist/ 里），
// 由后端 /api/admin/app.js 校验管理员令牌后才下发
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@shared': path.resolve(import.meta.dirname, './shared'),
    },
  },
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'dist-admin',
    emptyOutDir: true,
    copyPublicDir: false,
    minify: true,
    lib: {
      entry: path.resolve(import.meta.dirname, './src/screens/admin/protected.tsx'),
      formats: ['es'],
      fileName: () => 'admin.js',
    },
    // lib 的 es 格式默认不压缩空白，这份代码只给后台用，直接完整压缩
    rolldownOptions: { output: { minify: true } },
  },
})
