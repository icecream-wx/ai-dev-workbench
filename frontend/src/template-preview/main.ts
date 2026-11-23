import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import TemplatePreviewApp from './TemplatePreviewApp.vue'
import { registerPmV3 } from '../design-system/pm-v3/pm-register'
import { installPmMock } from '../design-system/pm-v3/mock/index.js'

/**
 * P7-7b-2a 自定义模板预览入口（frontend/template-preview.html）。
 *
 * 与设计模板中心 `preview.html` / 应用 `design-preview.html` 同一构建：
 * Element Plus + pm-v3 子集 + 本地 mock；输入是自定义 pack（草稿或已发布）的
 * `reference` / `contract` 页，不写 PNG、不连接真实平台。
 */
const app = createApp(TemplatePreviewApp)

app.use(ElementPlus, { locale: zhCn })
registerPmV3(app)
installPmMock(app)

app.mount('#app')
