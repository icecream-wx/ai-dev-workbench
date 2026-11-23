/**
 * 只监听 `docs/`（需求与设计），不监听整个工作区
 *
 * - 首选 `fs.watch(docs/, {recursive:true})` + 300ms 防抖；
 * - 平台不支持/监听失败 → 降级为 2s 轮询（比对文件 hash）；
 * - 进程退出/应用事件流全部断开时由调用方 close()。
 */
import fs from 'node:fs'
import path from 'node:path'
import { docsHashes } from './artifacts'

export const DEBOUNCE_MS = 300
const POLL_INTERVAL_MS = 2000

export interface DocsWatcher {
  readonly mode: () => 'watch' | 'poll'
  close: () => void
}

function relativeSet(appDir: string, filenames: Array<string | null>): string[] {
  const out = new Set<string>()
  for (const filename of filenames) {
    if (!filename) continue
    out.add(filename.replace(/\\/g, '/'))
  }
  if (!out.size) {
    // 平台没有给出具体文件名：交给调用方按 hash 重读
    out.add('.')
  }
  return [...out]
}

export function watchAppDocs(appDir: string, onChange: (paths: string[]) => void): DocsWatcher {
  const docsDir = path.join(appDir, 'docs')
  let mode: 'watch' | 'poll' = 'watch'
  let closed = false
  let watcher: fs.FSWatcher | null = null
  let debounceTimer: NodeJS.Timeout | null = null
  let pollTimer: NodeJS.Timeout | null = null
  let pending = new Set<string>()
  let snapshot = docsHashes(appDir)

  const flush = (): void => {
    debounceTimer = null
    if (closed) return
    const paths = [...pending]
    pending = new Set()
    if (!paths.length) return
    snapshot = docsHashes(appDir)
    onChange(paths)
  }

  const schedule = (filenames: Array<string | null>): void => {
    for (const item of relativeSet(appDir, filenames)) pending.add(item)
    if (debounceTimer) return
    debounceTimer = setTimeout(flush, DEBOUNCE_MS)
    debounceTimer.unref?.()
  }

  const startPolling = (): void => {
    if (closed || pollTimer) return
    mode = 'poll'
    try {
      watcher?.close()
    } catch {
      // 已关闭
    }
    watcher = null
    pollTimer = setInterval(() => {
      if (closed) return
      const next = docsHashes(appDir)
      const changed: string[] = []
      for (const key of new Set([...Object.keys(next), ...Object.keys(snapshot)])) {
        if (next[key] !== snapshot[key]) changed.push(key)
      }
      snapshot = next
      if (changed.length) onChange(changed)
    }, POLL_INTERVAL_MS)
    pollTimer.unref?.()
  }

  try {
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true })
    watcher = fs.watch(docsDir, { recursive: true }, (_event, filename) => {
      schedule([typeof filename === 'string' ? filename : null])
    })
    watcher.on('error', () => startPolling())
  } catch {
    startPolling()
  }

  return {
    mode: () => mode,
    close: () => {
      closed = true
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = null
      if (pollTimer) clearInterval(pollTimer)
      pollTimer = null
      try {
        watcher?.close()
      } catch {
        // 已关闭
      }
      watcher = null
    }
  }
}
