import { reactive } from 'vue'
import { api } from './api'

/**
 * 运行时引擎状态：manifest（契约）+ 页面导航栈
 * - manifest 每 3 秒轮询版本号，变更即热更新（菜单/页面随之刷新）
 * - 导航为简易栈：列表 → 表单/详情 → 返回
 */
export const store = reactive({
  manifest: null,
  current: null, // { pageId, mode: 'page'|'create'|'edit'|'detail', record? }
  history: [],
  manifestError: ''
})

export function pageOf(pageId) {
  return (store.manifest?.pages ?? []).find(p => p.id === pageId) ?? null
}

export function entityOf(id) {
  return (store.manifest?.entities ?? []).find(e => e.id === id) ?? null
}

export function menuPages() {
  return (store.manifest?.pages ?? []).filter(p => p.inMenu)
}

export function defaultCurrent() {
  const first = menuPages()[0]
  return first ? { pageId: first.id, mode: 'page' } : null
}

export async function loadManifest() {
  try {
    const next = await api.manifest()
    if (!store.manifest || next.version !== store.manifest.version) {
      const prev = store.manifest
      store.manifest = next
      // 当前页被移除时回退到首页
      if (store.current && !pageOf(store.current.pageId)) {
        store.current = defaultCurrent()
      }
      if (!prev) store.current = store.current ?? defaultCurrent()
      store.manifestError = ''
    }
  } catch (err) {
    store.manifestError = err.message
  }
}

export function openPage(pageId, params = {}) {
  if (store.current) store.history.push({ ...store.current })
  store.current = { pageId, mode: 'page', ...(params ?? {}) }
}

/** 进入实体的表单/详情：优先复用 Spec 声明的页面，缺失时构造临时页（引擎按默认布局渲染） */
export function openEntityPage(entityId, mode, record) {
  const pages = store.manifest?.pages ?? []
  const formPage = pages.find(p => p.entity === entityId && p.type === 'form')
  const detailPage = pages.find(p => p.entity === entityId && p.type === 'detail')
  if (mode === 'detail') {
    const target = detailPage ?? formPage
    if (!target) return
    openPage(target.id, { mode: 'detail', record })
    return
  }
  // create / edit → 表单页（无声明页时构造临时页）
  const target = formPage ?? { id: `${entityId}-auto-form`, type: 'form', title: entityName(entityId), entity: entityId, layout: {} }
  openPage(target.id, { mode, ...(record ? { record } : {}) })
}

export function goBack() {
  store.current = store.history.pop() ?? defaultCurrent()
}

export function entityName(entityId) {
  return store.manifest?.entities?.find(e => e.id === entityId)?.name ?? entityId
}

export function pageTitle(pageId) {
  return pageOf(pageId)?.title ?? pageId
}
