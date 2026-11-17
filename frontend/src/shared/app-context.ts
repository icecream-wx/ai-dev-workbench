/**
 * 当前应用上下文。
 *
 * 入口（App.vue）在渲染应用工作区前设置；模型设置（settings/store）等需要按应用
 * 调用 `/api/apps/:id/...` 的模块通过 getActiveAppId() 读取。
 */
let activeAppId = ''

export function setActiveAppId(appId: string): void {
  activeAppId = appId.trim()
}

export function getActiveAppId(): string {
  return activeAppId
}
