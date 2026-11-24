/**
 * 应用级 `designHash`（D1）
 *
 * `designHash = sha256(entities.json + pages.json + design-system.json)`：
 * - 固定顺序、字节级拼接；
 * - 缺失文件按空内容处理（不抛错）；
 * - **不包含 `api-design.md`**：接口文档变化不应让 PNG 过期。
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/** 固定顺序：改顺序会让已有 manifest 全部过期，除非明确要迁移 */
export const DESIGN_HASH_FILES = [
  'docs/design/entities.json',
  'docs/design/pages.json',
  'docs/design/design-system.json'
] as const

function readIfExists(file: string): Buffer {
  try {
    return fs.readFileSync(file)
  } catch {
    return Buffer.alloc(0)
  }
}

/** 计算应用级 designHash（任意缺失文件按空） */
export function designHashOf(appDir: string): string {
  const hash = createHash('sha256')
  for (const relative of DESIGN_HASH_FILES) hash.update(readIfExists(path.join(appDir, relative)))
  return hash.digest('hex')
}
