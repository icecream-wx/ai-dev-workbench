import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5180,
    proxy: {
      '/api': {
        target: 'http://localhost:3300',
        changeOrigin: true
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 6144,
    rollupOptions: {
      // 多入口：工作台主入口 + 设计模板预览入口（P7-2）+ 设计产物模板风格预览（P9）
      //        + 自定义模板预览（P7-7b）
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        preview: fileURLToPath(new URL('./preview.html', import.meta.url)),
        'design-preview': fileURLToPath(new URL('./design-preview.html', import.meta.url)),
        'template-preview': fileURLToPath(new URL('./template-preview.html', import.meta.url))
      },
      output: {
        manualChunks: {
          'element-plus': ['element-plus']
        }
      }
    }
  }
})
