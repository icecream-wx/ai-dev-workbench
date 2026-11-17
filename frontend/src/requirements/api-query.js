/**
 * 需求 API query 拼接（纯函数，便于 Node 直接单测）
 *
 * 约定：空串/缺省/纯空格 = 默认模块，不拼 moduleId 参数（旧接口兼容）。
 */
export function moduleQuery(moduleId) {
  const value = typeof moduleId === 'string' ? moduleId.trim() : ''
  return value ? `?moduleId=${encodeURIComponent(value)}` : ''
}
