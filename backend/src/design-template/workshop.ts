/**
 * 模板工作室资产初始化（P7-7b-1）
 *
 * 工作室根：`<dataDir>/design-system/_workshop/`（共享 location；P7-7a 已建 drafts/catalog）
 *
 * - 写/覆盖 `AGENTS.md`、`opencode.json`、`workshop.json`（内容不同才写）；
 * - 把 `templates/workshop/**` 的受管资产复制到 `.opencode/{skills,commands,scripts}`；
 * - 刷新 `catalog/builtin/<packId>/**` 内置 pack 只读镜像（按版本/mtime/内容 hash）；
 * - 调用 `ensureCatalog` 生成/复用派生知识库；
 * - 资产有变化时 best-effort `opencode.reloadLocations()`（失败只 warning）。
 *
 * 边界：不改内置 pack、不发布、不写应用工作区；workshop.json 不含任何凭据。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config'
import { builtinDesignSystemRoot, customDesignSystemRoot, getBuiltinPack } from '../design/pack'
import { opencode } from '../opencode/runtime'
import { ensureCatalog, readCatalog } from './catalog'
import { workshopScriptsRoot } from './core'
import {
  catalogRoot,
  dirExists,
  draftsRoot,
  fileExists,
  studioRoot,
  workshopFile,
  writeFileAtomic,
  writeJsonAtomic
} from './paths'

export const STUDIO_SKILL_ID = 'adw-design-template-authoring'
export const STUDIO_COMMAND_NAME = 'generate-design-template'

export interface StudioAssetsResult {
  changed: boolean
  warnings: string[]
  mirror: { pack: string; version: string; files: number; rebuilt: boolean }
}

const BUILTIN_FILES = ['pack.json'] as const
const BUILTIN_DIRS = ['application-types', 'styles'] as const

function workshopSkillRoot(): string {
  return path.resolve(workshopScriptsRoot(), '..')
}

function workshopCommandsRoot(): string {
  return path.resolve(__dirname, '../../../templates/workshop/commands')
}

function studioWorkshopConfig(): Record<string, unknown> {
  return {
    builtinRoot: builtinDesignSystemRoot(),
    customRoot: customDesignSystemRoot(),
    draftRoot: draftsRoot(),
    workbenchPort: config.port
  }
}

function studioAgentsMarkdown(): string {
  return `# 设计模板编写工作室

你是「设计模板工作室」的编写 agent：根据用户需求，读取现有模板知识，写出一份可发布的设计模板草稿。
你**不写模板包**，也不发布；模板包由确定性生成器从 \`spec.json\` 产出，发布只能由用户点击「发布」。

## 读取顺序

1. 本文件 \`AGENTS.md\`；
2. \`catalog/index.json\`（来源 pack/版本/计数）；
3. \`catalog/pages.json\`、\`catalog/components.json\`、\`catalog/styles.json\`、\`catalog/recipes.json\`；
4. \`catalog/builtin/\` 中 \`readPath\` / \`structureReadPath\` 指向的蓝图与结构样式；
5. 当前草稿 \`drafts/<packId>/spec.json\`（若有）、\`drafts/<packId>/generation.json\`、\`drafts/<packId>/notes.md\`；
6. 用户消息。

**不要拼仓库路径**（\`templates/design-system/**\` 不在当前 location 内）；只能使用 catalog 给出的 \`readPath\`。

## 只允许写

- \`drafts/<packId>/spec.json\`
- \`drafts/<packId>/notes.md\`（可选）

**禁止**修改 \`catalog/**\`、\`drafts/<packId>/pack/**\`、\`.opencode/**\`、仓库源码、\`projects/**\` 或任何应用工作区。
权限层也会阻止越界写入；被阻止时请告诉用户只能改 spec.json。

## 不发布

发布只能由用户点击「发布」；你只负责生成、校验、解释错误与给出建议。

## 引用规则

- \`source.pack\` 固定 \`afcenter-app-templates-v1\`；\`applicationType\`/\`pageId\` 必须来自 \`catalog/pages.json\` 的真实条目；
- \`contract\` 页的列/查询/表单/树/子表字段必须来自该页 \`sampleEntity.fields\`（子表来自 \`sampleSubEntities\`）；
- 不发明页面 id、组件名、风格 id；风格只能选 catalog 中的 1 套。

## 生成与校验

- 生成：\`node .opencode/scripts/generate.cjs --draft <packId>\`
- 预检：\`node .opencode/scripts/validate.cjs --draft <packId>\`

预检不是发布依据；发布时后端会重新做权威校验。生成后把 \`errors\`/\`warnings\` 用中文汇报，并提示用户预览/发布。

## 汇报（中文）

完成后汇报：页面清单（reference / contract）、风格、生成/校验结果（errors/warnings）、未实现项、发布前待确认。
所有面向用户的文字（回复、思考/进度说明、工具说明、汇报）一律使用中文。
`
}

function studioOpencodeJson(): Record<string, unknown> {
  return {
    $schema: 'https://opencode.ai/config.json',
    permissions: [
      { action: 'edit', resource: '*', effect: 'deny' },
      { action: 'edit', resource: '*drafts/*/spec.json', effect: 'allow' },
      { action: 'edit', resource: '*drafts/*/notes.md', effect: 'allow' },
      { action: 'read', resource: '*', effect: 'allow' },
      { action: 'shell', resource: '*', effect: 'deny' },
      { action: 'shell', resource: 'node .opencode/scripts/generate.cjs *', effect: 'allow' },
      { action: 'shell', resource: 'node .opencode/scripts/validate.cjs *', effect: 'allow' },
      { action: 'external_directory', resource: '*', effect: 'deny' }
    ]
  }
}

/** 内容不同才原子写；返回是否发生写入 */
function writeIfChanged(file: string, content: string | Buffer): boolean {
  const next = typeof content === 'string' ? Buffer.from(content, 'utf8') : content
  if (fileExists(file)) {
    try {
      if (fs.readFileSync(file).equals(next)) return false
    } catch {
      // 读失败按需要重写处理
    }
  }
  writeFileAtomic(file, next)
  return true
}

function listRelativeFiles(root: string, prefix = ''): string[] {
  if (!dirExists(root)) return []
  const files: string[] = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    const full = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...listRelativeFiles(full, relative))
    } else if (entry.isFile()) {
      files.push(relative)
    }
  }
  return files.sort()
}

/**
 * 同步目录（内容不同才写；删除目标里源不存在的受管文件）。
 * filter 用于排除 skill 内的 scripts（脚本单独复制到 .opencode/scripts）。
 */
function syncDirectory(source: string, target: string, filter?: (relative: string) => boolean): boolean {
  if (!dirExists(source)) return false
  let changed = false
  const wanted = new Set<string>()
  for (const relative of listRelativeFiles(source)) {
    if (filter && !filter(relative)) continue
    wanted.add(relative)
    const from = path.join(source, relative)
    const to = path.join(target, relative)
    const content = fs.readFileSync(from)
    if (writeIfChanged(to, content)) changed = true
  }
  if (dirExists(target)) {
    for (const relative of listRelativeFiles(target)) {
      if (wanted.has(relative)) continue
      fs.rmSync(path.join(target, relative), { force: true })
      changed = true
    }
  }
  return changed
}

interface MirrorStamp {
  schemaVersion: 1
  pack: string
  version: string
  mtimeMs: number
  hash: string
  files: number
}

function mirrorStampFile(): string {
  return path.join(catalogRoot(), 'builtin', '.mirror.json')
}

function builtinPackDir(packId: string): string {
  return path.join(builtinDesignSystemRoot(), packId)
}

function builtinSourceFiles(packId: string): string[] {
  const root = builtinPackDir(packId)
  const files: string[] = []
  for (const name of BUILTIN_FILES) {
    if (fileExists(path.join(root, name))) files.push(name)
  }
  for (const dir of BUILTIN_DIRS) {
    files.push(...listRelativeFiles(path.join(root, dir), dir))
  }
  return files
}

function builtinFingerprint(packId: string): { version: string; mtimeMs: number; hash: string } {
  const root = builtinPackDir(packId)
  const packFile = path.join(root, 'pack.json')
  const version = getBuiltinPack(packId).version
  const mtimeMs = fileExists(packFile) ? fs.statSync(packFile).mtimeMs : 0
  const hash = crypto.createHash('sha256')
  for (const relative of builtinSourceFiles(packId)) {
    hash.update(`${relative}\0`)
    hash.update(fs.readFileSync(path.join(root, relative)))
    hash.update('\n')
  }
  return { version, mtimeMs, hash: `sha256:${hash.digest('hex')}` }
}

function readMirrorStamp(): MirrorStamp | null {
  try {
    const raw = fs.readFileSync(mirrorStampFile(), 'utf8')
    const value = JSON.parse(raw) as MirrorStamp
    return value && typeof value === 'object' ? value : null
  } catch {
    return null
  }
}

function mirrorHealthy(packId: string, stamp: MirrorStamp, fingerprint: { version: string; mtimeMs: number; hash: string }): boolean {
  if (
    stamp.pack !== packId ||
    stamp.version !== fingerprint.version ||
    stamp.mtimeMs !== fingerprint.mtimeMs ||
    stamp.hash !== fingerprint.hash
  ) {
    return false
  }
  const target = path.join(catalogRoot(), 'builtin', packId)
  const files = builtinSourceFiles(packId)
  if (stamp.files !== files.length) return false
  return files.every(relative => fileExists(path.join(target, relative)))
}

/**
 * 刷新内置 pack 只读镜像（`catalog/builtin/<packId>/**`）。
 * - 版本/mtime/内容 hash 一致且文件齐全 → 跳过；
 * - 否则复制到临时目录后原子替换（不写半成品）。
 */
function refreshBuiltinMirror(packId: string): { files: number; rebuilt: boolean } {
  const fingerprint = builtinFingerprint(packId)
  const files = builtinSourceFiles(packId)
  const stamp = readMirrorStamp()
  if (stamp && mirrorHealthy(packId, stamp, fingerprint)) return { files: files.length, rebuilt: false }

  const builtinRoot = path.join(catalogRoot(), 'builtin')
  fs.mkdirSync(builtinRoot, { recursive: true })
  const temp = path.join(builtinRoot, `.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`)
  const target = path.join(builtinRoot, packId)
  const backup = path.join(builtinRoot, `.old-${process.pid}-${crypto.randomBytes(4).toString('hex')}`)
  try {
    const source = builtinPackDir(packId)
    for (const relative of files) {
      writeFileAtomic(path.join(temp, relative), fs.readFileSync(path.join(source, relative)))
    }
    const hadTarget = dirExists(target)
    if (hadTarget) fs.renameSync(target, backup)
    try {
      fs.renameSync(temp, target)
    } catch (error) {
      if (hadTarget && dirExists(backup)) fs.renameSync(backup, target)
      throw error
    }
    if (hadTarget) fs.rmSync(backup, { recursive: true, force: true })
    const nextStamp: MirrorStamp = {
      schemaVersion: 1,
      pack: packId,
      version: fingerprint.version,
      mtimeMs: fingerprint.mtimeMs,
      hash: fingerprint.hash,
      files: files.length
    }
    writeJsonAtomic(mirrorStampFile(), nextStamp)
    return { files: files.length, rebuilt: true }
  } catch (error) {
    fs.rmSync(temp, { recursive: true, force: true })
    throw error
  }
}

/** 复制共享控件映射（只读参考；catalog 仍读仓库原文件生成） */
function refreshComponentControls(): boolean {
  const source = path.join(builtinDesignSystemRoot(), 'component-controls.json')
  if (!fileExists(source)) return false
  const target = path.join(catalogRoot(), 'component-controls.json')
  return writeIfChanged(target, fs.readFileSync(source, 'utf8'))
}

/**
 * 幂等初始化工作室资产；返回是否发生变化与 warning。
 * 不主动启动 opencode：只在已就绪时 reload（失败只 warning）。
 */
export async function ensureStudioAssets(options: { force?: boolean } = {}): Promise<StudioAssetsResult> {
  const warnings: string[] = []
  let changed = false

  fs.mkdirSync(studioRoot(), { recursive: true })
  fs.mkdirSync(draftsRoot(), { recursive: true })
  fs.mkdirSync(catalogRoot(), { recursive: true })

  changed = writeIfChanged(path.join(studioRoot(), 'AGENTS.md'), studioAgentsMarkdown()) || changed
  changed =
    writeIfChanged(path.join(studioRoot(), 'opencode.json'), `${JSON.stringify(studioOpencodeJson(), null, 2)}\n`) || changed
  changed = writeIfChanged(workshopFile(), `${JSON.stringify(studioWorkshopConfig(), null, 2)}\n`) || changed

  // 受管资产：skill（不含 scripts）、command、脚本（生成核心副本）
  const skillTarget = path.join(studioRoot(), '.opencode', 'skills', STUDIO_SKILL_ID)
  changed =
    syncDirectory(workshopSkillRoot(), skillTarget, relative => !relative.startsWith('scripts/')) || changed
  const commandSource = path.join(workshopCommandsRoot(), `${STUDIO_COMMAND_NAME}.md`)
  if (fileExists(commandSource)) {
    changed =
      writeIfChanged(path.join(studioRoot(), '.opencode', 'commands', `${STUDIO_COMMAND_NAME}.md`), fs.readFileSync(commandSource, 'utf8')) ||
      changed
  }
  changed = syncDirectory(workshopScriptsRoot(), path.join(studioRoot(), '.opencode', 'scripts')) || changed

  // 内置 pack 只读镜像（36 文件）
  const packId = getBuiltinPack().id
  let mirror: StudioAssetsResult['mirror'] = { pack: packId, version: '', files: 0, rebuilt: false }
  try {
    const result = refreshBuiltinMirror(packId)
    mirror = {
      pack: packId,
      version: getBuiltinPack(packId).version,
      files: result.files,
      rebuilt: result.rebuilt
    }
    changed = result.rebuilt || changed
  } catch (error) {
    warnings.push(`内置模板镜像刷新失败：${error instanceof Error ? error.message : String(error)}`)
  }
  changed = refreshComponentControls() || changed

  // catalog：派生只读知识库（镜像变化不改变事实源；强制重建只在显式 force）
  try {
    ensureCatalog({ force: options.force === true || mirror.rebuilt })
  } catch (error) {
    warnings.push(`catalog 生成失败：${error instanceof Error ? error.message : String(error)}`)
  }

  if (changed && opencode.status().ready) {
    try {
      await opencode.reloadLocations()
    } catch (error) {
      warnings.push(`opencode 重载工作室配置失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return { changed, warnings, mirror }
}

/** 工作室当前 catalog 摘要（未生成时为 null；不触发写入） */
export function studioCatalogSummary(): ReturnType<typeof readCatalog>['index'] | null {
  try {
    return readCatalog().index
  } catch {
    return null
  }
}
