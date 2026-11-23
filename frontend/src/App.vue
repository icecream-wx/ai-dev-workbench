<template>
  <AppShell v-if="route.kind === 'app'" :app-id="route.appId" :stage="route.stage" />
  <StudioView v-else-if="route.kind === 'studio'" :key="route.packId" :pack-id="route.packId" />
  <HomeShell v-else />
</template>

<script setup lang="ts">
/**
 * 应用入口
 *
 * - `#/apps/<app-id>/requirements|design|development`：应用工作区（阶段栏 + 需求文档/设计/开发）
 * - `#/studio/<packId>`：模板工作室（P7-7b-2a；共享右侧预览 + AgentChatPanel 工作室 API）
 * - 其他：应用列表首页
 *
 * 同一页面切换应用时强制刷新，避免把上一个应用的模型/设置上下文带入新应用。
 */
import { onMounted, onUnmounted, ref } from 'vue'
import './shared/theme.css'
import './shared/ui.css'
import './shared/pinia'
import { setActiveAppId } from './shared/app-context'
import { useSettingsStore } from './settings/store'
import HomeShell from './workbench/HomeShell.vue'
import AppShell from './workbench/AppShell.vue'
import StudioView from './studio/StudioView.vue'

type AppStage = 'requirements' | 'design' | 'development'
type Route =
  | { kind: 'home' }
  | { kind: 'app'; appId: string; stage?: AppStage }
  | { kind: 'studio'; packId: string }

const APP_HASH = /^#\/apps\/([a-z0-9][a-z0-9-]{0,63})(?:\/(requirements|design|development))?\/?$/
const STUDIO_HASH = /^#\/studio\/([a-z0-9][a-z0-9-]{0,63})\/?$/

function parseRoute(): Route {
  if (typeof window === 'undefined') return { kind: 'home' }
  const studioMatch = STUDIO_HASH.exec(window.location.hash)
  if (studioMatch) return { kind: 'studio', packId: studioMatch[1] }
  const match = APP_HASH.exec(window.location.hash)
  if (!match) return { kind: 'home' }
  const stage = match[2] as AppStage | undefined
  return { kind: 'app', appId: match[1], ...(stage ? { stage } : {}) }
}

const route = ref<Route>(parseRoute())
let loadedAppId: string | null = null

// 主题在首屏即生效（首页不依赖应用上下文）：创建 store 会立即套用 localStorage/系统偏好
useSettingsStore()

/** 进入应用：记录 activeAppId（模型设置按应用读写）并加载模型设置 */
function enterApp(appId: string): void {
  setActiveAppId(appId)
  void useSettingsStore().init()
}

function onHashChange(): void {
  const next = parseRoute()
  if (next.kind === 'app') {
    // 同一页面切换应用：整页刷新，确保 activeAppId/设置不串数据
    if (loadedAppId && loadedAppId !== next.appId) {
      window.location.reload()
      return
    }
    route.value = next
    loadedAppId = next.appId
    enterApp(next.appId)
    return
  }
  route.value = next
}

onMounted(() => {
  window.addEventListener('hashchange', onHashChange)
  if (route.value.kind === 'app') {
    loadedAppId = route.value.appId
    enterApp(route.value.appId)
  }
  document.getElementById('boot')?.remove()
})

onUnmounted(() => window.removeEventListener('hashchange', onHashChange))
</script>
