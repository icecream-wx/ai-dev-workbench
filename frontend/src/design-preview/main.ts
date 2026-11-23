import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import DesignPreviewApp from './DesignPreviewApp.vue'
import { registerPmV3 } from '../design-system/pm-v3/pm-register'
import { installPmMock } from '../design-system/pm-v3/mock/index.js'

/**
 * P9 设计产物模板风格预览入口（frontend/design-preview.html）。
 *
 * 与模板中心 `preview.html` 同一构建：Element Plus + pm-v3 子集 + 本地 mock，
 * 区别是渲染输入为工作台 design.json（经 /api/apps/:id/artifacts 读取）。
 */
const app = createApp(DesignPreviewApp)

app.use(ElementPlus, { locale: zhCn })
registerPmV3(app)
installPmMock(app)

app.mount('#app')
