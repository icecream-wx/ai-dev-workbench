/**
 * docs watcher：写文件 → 防抖后回调；close 后不再回调
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-watcher-'))
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')

after(async () => {
  try {
    const dbModule = await import('../db')
    dbModule.db.close()
  } catch {
    // 数据库未打开
  }
  fs.rmSync(root, { recursive: true, force: true })
})

function waitFor(check: () => boolean, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const timer = setInterval(() => {
      if (check()) {
        clearInterval(timer)
        resolve()
        return
      }
      if (Date.now() - started > timeoutMs) {
        clearInterval(timer)
        reject(new Error('等待超时'))
      }
    }, 50)
  })
}

test('docs 变化 → 防抖后触发一次事件（含 paths）', async () => {
  const { watchAppDocs, DEBOUNCE_MS } = await import('./watcher')
  const appDir = path.join(root, 'projects', 'watch-app')
  fs.mkdirSync(path.join(appDir, 'docs', 'requirements'), { recursive: true })

  const batches: string[][] = []
  const watcher = watchAppDocs(appDir, paths => batches.push(paths))
  try {
    const file = path.join(appDir, 'docs', 'requirements', 'EP-001-测试.md')
    fs.writeFileSync(file, '# 测试\n', 'utf8')
    fs.appendFileSync(file, '\n补充。\n', 'utf8')
    await waitFor(() => batches.length > 0)
    // 防抖：短时间多次写入合并为少量批次
    assert.ok(batches.length <= 2, `事件批次过多：${batches.length}`)
    assert.ok(batches[0].some(item => item.includes('EP-001') || item === '.'), `paths 不含文件名：${JSON.stringify(batches[0])}`)
    assert.ok(DEBOUNCE_MS >= 200 && DEBOUNCE_MS <= 1000)
  } finally {
    watcher.close()
  }

  const before = batches.length
  fs.writeFileSync(path.join(appDir, 'docs', 'requirements', 'EP-002-关闭后.md'), '# 关闭后\n', 'utf8')
  await new Promise(resolve => setTimeout(resolve, 800))
  assert.equal(batches.length, before, 'close 后不应再触发事件')
  fs.rmSync(appDir, { recursive: true, force: true })
})
