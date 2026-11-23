/**
 * 产物变化事件中枢：每个应用一个 docs watcher，多个 SSE 订阅者共享
 *
 * SSE 帧：`artifacts-changed { appId, paths, hashes }`
 * 无订阅者时保留 watcher（下次订阅复用）；进程退出时 closeAllWatchers()。
 */
import type { Response } from 'express'
import { appDirOf } from '../apps/scaffold'
import { docsHashes } from './artifacts'
import { watchAppDocs, type DocsWatcher } from './watcher'

export interface AppEventSubscription {
  close: () => void
}

interface Entry {
  watcher: DocsWatcher
  subscribers: Set<Response>
}

const registry = new Map<string, Entry>()

function write(res: Response, frame: unknown): void {
  if (res.writableEnded) return
  try {
    res.write(`data: ${JSON.stringify(frame)}\n\n`)
  } catch {
    // 客户端已断开
  }
}

function entryFor(appId: string): Entry {
  const existing = registry.get(appId)
  if (existing) return existing
  const appDir = appDirOf(appId)
  const entry: Entry = {
    watcher: watchAppDocs(appDir, paths => {
      const hashes = docsHashes(appDir)
      for (const subscriber of entry.subscribers) {
        write(subscriber, { type: 'artifacts-changed', appId, paths, hashes })
      }
    }),
    subscribers: new Set()
  }
  registry.set(appId, entry)
  return entry
}

function dropIfIdle(appId: string, entry: Entry): void {
  if (entry.subscribers.size) return
  entry.watcher.close()
  registry.delete(appId)
}

/** 订阅应用产物变化（SSE 响应由调用方负责写头/心跳/结束） */
export function subscribeAppEvents(appId: string, res: Response): AppEventSubscription {
  const entry = entryFor(appId)
  entry.subscribers.add(res)
  const onClose = (): void => {
    entry.subscribers.delete(res)
    dropIfIdle(appId, entry)
  }
  res.on('close', onClose)
  return {
    close: () => {
      res.removeListener('close', onClose)
      onClose()
    }
  }
}

export function closeAllWatchers(): void {
  for (const entry of registry.values()) entry.watcher.close()
  registry.clear()
}
