import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 生产构建部署在服务器网关的子路径 /grain/ 下（nginx 统一分发）；本地 dev 保持根路径
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'development' ? '/' : '/grain/',
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
}))
