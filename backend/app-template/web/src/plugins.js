/** 自定义页面插件注册表：web/plugins/<pageId>.vue 由智能体产出，Vite 自动 glob + HMR */
const modules = import.meta.glob('../plugins/**/*.vue')

export function resolvePlugin(pageId) {
  return modules[`../plugins/${pageId}.vue`] ?? modules[`../plugins/${pageId}/index.vue`] ?? null
}
