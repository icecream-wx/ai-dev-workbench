import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { loadJson, saveJson } from '../shared/storage'
import { getActiveAppId } from '../shared/app-context'

/** 前端只保留模型引用与超时；API Key/provider 由 opencode 自己管理 */
export interface LlmSettings {
  /** providerID/modelID */
  model: string
  timeout?: number
}

export interface OpencodeModelInfo {
  id: string
  providerID: string
  modelID: string
  name: string
  status?: string
  enabled?: boolean
  limit?: { context?: number; output?: number }
}

export type ThemeMode = 'light' | 'dark'

const THEME_KEY = 'rg.theme'

/** 读取已持久化的主题；只有明确写入 light/dark 才算有效 */
function storedTheme(): ThemeMode | null {
  const value = loadJson<ThemeMode | string | null>(THEME_KEY, null)
  return value === 'dark' || value === 'light' ? value : null
}

/** 初始主题：localStorage → 系统偏好（prefers-color-scheme） → light */
function initialTheme(): ThemeMode {
  const stored = storedTheme()
  if (stored) return stored
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
    } catch {
      // 老浏览器/受限环境忽略
    }
  }
  return 'light'
}

export type ModelStage = 'requirements' | 'design' | 'development'

function stageFromHash(): ModelStage {
  if (typeof window === 'undefined') return 'requirements'
  const hash = window.location.hash
  if (/#\/apps\/[^/]+\/design/.test(hash)) return 'design'
  if (/#\/apps\/[^/]+\/development/.test(hash)) return 'development'
  return 'requirements'
}

/** 把主题应用到文档根节点（Element Plus dark css-vars 以 html.dark 生效） */
function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', mode === 'dark')
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<LlmSettings>({ model: '', timeout: 600000 })
  const theme = ref<ThemeMode>(initialTheme())
  const models = ref<OpencodeModelInfo[]>([])
  const runtimeReady = ref(false)
  const runtimeVersion = ref<string | null>(null)
  const loadingModels = ref(false)
  const modelError = ref('')
  let initialized = false

  async function refreshRuntime(): Promise<void> {
    try {
      const res = await fetch('/api/opencode/health')
      if (!res.ok) return
      const data = (await res.json()) as { ready?: boolean; version?: string | null }
      runtimeReady.value = Boolean(data.ready)
      runtimeVersion.value = typeof data.version === 'string' ? data.version : null
    } catch {
      runtimeReady.value = false
    }
  }

  /** 读取当前阶段的模型选择（stored 优先，未启动 serve 时回退为空） */
  async function refreshStageModel(): Promise<void> {
    const appId = getActiveAppId()
    if (!appId) {
      settings.value.model = ''
      return
    }
    try {
      const res = await fetch(`/api/apps/${encodeURIComponent(appId)}/model?stage=${stageFromHash()}`)
      if (!res.ok) return
      const data = (await res.json()) as { model?: { providerID?: string; id?: string } | null; fallback?: { providerID?: string; id?: string } | null }
      const selected = data.model ?? data.fallback
      settings.value.model = selected?.providerID && selected?.id ? `${selected.providerID}/${selected.id}` : ''
    } catch {
      // 后端不可用时保留当前值
    }
  }

  /** 应用启动时调用：读取当前阶段的模型选择（不主动启动 serve） */
  async function init(): Promise<void> {
    if (initialized) return
    initialized = true
    await refreshRuntime()
    await refreshStageModel()
  }

  /** 设置面板打开时调用：启动/连接 serve 并列出模型 */
  async function loadModels(): Promise<void> {
    loadingModels.value = true
    modelError.value = ''
    try {
      const res = await fetch('/api/opencode/models')
      const data = (await res.json().catch(() => ({}))) as { models?: OpencodeModelInfo[]; error?: string }
      if (!res.ok) throw new Error(data.error || `读取模型失败（HTTP ${res.status}）`)
      models.value = Array.isArray(data.models) ? data.models : []
      await refreshRuntime()
      await refreshStageModel()
    } catch (err) {
      modelError.value = err instanceof Error ? err.message : String(err)
    } finally {
      loadingModels.value = false
    }
  }

  /** 保存当前阶段的模型；空字符串表示清除（使用 opencode 默认模型） */
  async function saveModel(ref: string): Promise<void> {
    const appId = getActiveAppId()
    if (!appId) throw new Error('请先打开一个应用')
    const value = ref.trim()
    let model: { providerID: string; id: string } | null = null
    if (value) {
      const index = value.indexOf('/')
      if (index <= 0 || index === value.length - 1) throw new Error('模型格式应为 providerID/modelID')
      model = { providerID: value.slice(0, index), id: value.slice(index + 1) }
    }
    const res = await fetch(`/api/apps/${encodeURIComponent(appId)}/model`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: stageFromHash(), model })
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) throw new Error(data.error || `保存模型失败（HTTP ${res.status}）`)
    settings.value.model = model ? `${model.providerID}/${model.id}` : ''
  }

  watch(theme, value => saveJson(THEME_KEY, value), { immediate: true })

  watch(
    theme,
    value => applyTheme(value),
    { immediate: true }
  )

  /** 设置主题（localStorage 持久化 + 应用到 html.dark） */
  function setTheme(mode: ThemeMode): void {
    theme.value = mode === 'dark' ? 'dark' : 'light'
  }

  /** 在浅色/深色之间切换（顶栏与设置面板共用） */
  function toggleTheme(): void {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  return {
    settings,
    theme,
    models,
    runtimeReady,
    runtimeVersion,
    loadingModels,
    modelError,
    init,
    loadModels,
    refreshStageModel,
    saveModel,
    setTheme,
    toggleTheme
  }
})
