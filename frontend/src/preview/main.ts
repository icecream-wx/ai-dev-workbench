import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import PreviewApp from './PreviewApp.vue'
import { registerPmV3 } from '../design-system/pm-v3/pm-register'
import { installPmMock } from '../design-system/pm-v3/mock/index.js'

/**
 * P7-2 预览入口（frontend/preview.html）。
 *
 * 与工作台主入口同一构建；这里只注册 Element Plus + pm-v3 子集 + 本地 mock，
 * 不读取工作台 API、不连接真实平台。
 */
const app = createApp(PreviewApp)

app.use(ElementPlus, { locale: zhCn })
registerPmV3(app)
installPmMock(app)

app.mount('#app')
