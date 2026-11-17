import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// APP_BASE / APP_PORT / API_PORT 由生成器（runner）以环境变量注入
// 引擎以相对路径请求 api/（页面 /app/<id>/ 下解析为 /app/<id>/api/...），此处用正则匹配并剥掉前缀
export default defineConfig({
  plugins: [vue()],
  base: process.env.APP_BASE || '/',
  server: {
    host: '127.0.0.1',
    port: Number(process.env.APP_PORT) || 5300,
    strictPort: true,
    proxy: {
      ['^/app/[^/]+/api']: {
        target: `http://127.0.0.1:${process.env.API_PORT || 3390}`,
        changeOrigin: true,
        rewrite: p => p.replace(/^\/app\/[^/]+/, '')
      },
      '/api': {
        target: `http://127.0.0.1:${process.env.API_PORT || 3390}`,
        changeOrigin: true
      }
    }
  }
})
