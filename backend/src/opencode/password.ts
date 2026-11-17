/** 从 opencode serve stdout 中捕获随机密码（只保存在内存，不落盘/不日志） */
export class PasswordScanner {
  private buffer = ''

  feed(chunk: string): string | null {
    this.buffer += chunk
    const match = this.buffer.match(/server password (\S+)/)
    if (!match) {
      // 避免异常输出把缓冲撑大
      if (this.buffer.length > 8192) this.buffer = this.buffer.slice(-1024)
      return null
    }
    this.buffer = ''
    return match[1]
  }

  reset(): void {
    this.buffer = ''
  }
}
