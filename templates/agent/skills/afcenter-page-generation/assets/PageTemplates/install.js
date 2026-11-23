import {
  BusinessListPage, TreeListPage, TreePanel, StandardFormPage,
  FormSection, QueryPanel, RowActions, ThreePartPagination
} from './index.js'
import './style.css'

const components = {
  BusinessListPage, TreeListPage, TreePanel, StandardFormPage,
  FormSection, QueryPanel, RowActions, ThreePartPagination
}

// 在子项目自己的 Vue 实例安装本地模板。
export function installPageTemplates(app) {
  Object.entries(components).forEach(([name, component]) => {
    app.component(name, component)
  })
}

export default { install: installPageTemplates }
// Modified by AI on 2026-11-12 14:10:03
