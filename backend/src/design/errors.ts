/**
 * 设计域错误：模板包 / 设计系统 / 原型导出等 API 统一映射为 4xx。
 *
 * 独立成文件，避免错误类型依附在已删除的旧原型模板服务上。
 * P7-7a 起可携带 `code`（如 `spec-changed` / `pack-referenced`）与 `details`（如引用应用列表）。
 */
export class DesignError extends Error {
  readonly status: number
  readonly code?: string
  readonly details?: unknown

  constructor(status: number, message: string, options: { code?: string; details?: unknown } = {}) {
    super(message)
    this.status = status
    if (options.code) this.code = options.code
    if (options.details !== undefined) this.details = options.details
  }
}
