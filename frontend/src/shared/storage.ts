/** localStorage JSON 读写（工作台轻量偏好，如主题） */

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    // 静默失败会导致「编辑正常、刷新后全部丢失」且无从排查——必须把异常暴露出来
    console.error(`[rg-storage] 保存失败（常见原因：localStorage 配额已满）：${key}`, e)
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    return
  }
}
