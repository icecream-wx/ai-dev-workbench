import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router/index'

/**
 * 独立运行入口（`npm run dev`）。
 *
 * 作为 Module Federation remote 被宿主加载时，宿主负责 pm-* 全局组件、
 * 登录态与菜单；本文件只创建最小 Vue 应用。
 */
const app = createApp(App)
app.use(router)
app.use(ElementPlus)
app.mount('#app')
