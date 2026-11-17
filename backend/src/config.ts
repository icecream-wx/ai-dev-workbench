/**
 * 工作台配置
 *
 * 只读取工作台自己的运行参数；不在这里保存任何模型密钥。
 * 模型/provider 由 opencode 自身配置管理，工作台只选模型。
 */
import path from 'node:path'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'

function expandHome(value: string): string {
  if (value === '~') return process.env.USERPROFILE || process.env.HOME || value
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    const home = process.env.USERPROFILE || process.env.HOME || ''
    return path.join(home, value.slice(2))
  }
  return value
}

function resolveDir(value: string | undefined, fallback: string): string {
  const raw = value?.trim()
  return path.resolve(raw ? expandHome(raw) : fallback)
}

function numberEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const repoRoot = path.resolve(__dirname, '../..')

/** 当前工作台进程实例 ID（用于区分“另一个工作台实例”与自身残留 serve） */
export const workbenchInstanceId = randomUUID()

export const config = {
  /** 工作台 HTTP 端口 */
  port: numberEnv(process.env.PORT, 3300),
  /** SQLite 数据目录（默认 <repo>/data） */
  dataDir: resolveDir(process.env.RG_DATA_DIR, path.join(repoRoot, 'data')),
  /** 应用目录根：每个应用一个子目录（默认 <repo>/projects） */
  projectsDir: resolveDir(process.env.RG_PROJECTS_DIR, path.join(repoRoot, 'projects')),
  opencode: {
    /** 显式指定 opencode 可执行文件；为空时从 PATH 查找 */
    bin: process.env.OPENCODE_BIN?.trim() || null,
    /** 只监听回环地址；不对外暴露 serve */
    host: '127.0.0.1',
    /** 单个 serve 进程端口 */
    port: numberEnv(process.env.OPENCODE_PORT, 4771),
    /** 启动等待上限 */
    startTimeoutMs: numberEnv(process.env.OPENCODE_START_TIMEOUT_MS, 60000),
    /** 是否在工作台启动/首页探测时自动拉起 serve（默认 true；设 OPENCODE_AUTO_START=false 关闭） */
    autoStart: process.env.OPENCODE_AUTO_START !== 'false',
    /** 可选：覆盖 opencode 默认模型（provider/model） */
    defaultModel: process.env.OPENCODE_DEFAULT_MODEL?.trim() || null,
    /** 事件环形缓冲条数（仅用于调试/断线补看，不作为可靠重放） */
    eventBufferSize: numberEnv(process.env.OPENCODE_EVENT_BUFFER, 500),
  },
} as const

export function ensureRuntimeDirs(): void {
  fs.mkdirSync(config.dataDir, { recursive: true })
  fs.mkdirSync(config.projectsDir, { recursive: true })
}
