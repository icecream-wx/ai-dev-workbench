/** 设计阶段业务错误：携带 HTTP 状态与 issues/warnings，供统一错误出口使用 */
export class DesignError extends Error {
  readonly status: number
  readonly issues: unknown[]
  readonly warnings: string[]

  constructor(status: number, message: string, issues: unknown[] = [], warnings: string[] = []) {
    super(message)
    this.status = status
    this.issues = issues
    this.warnings = warnings
  }
}
