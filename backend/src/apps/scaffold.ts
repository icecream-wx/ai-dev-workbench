/**
 * 应用目录脚手架
 *
 * 把 `templates/eos-app` 复制为 `projects/<app-id>/backend/`，并生成：
 * - `docs/handoff/`（P3 写入交接包）
 * - `.opencode/agents/`（P2 写入 req/design agent）
 * - `AGENTS.md`、`README.md`
 *
 * 占位符在创建时一次性替换；未提供的敏感项写成显式 `CHANGE_ME`，不写入示例凭据。
 * 模板中部分文件是 GBK 编码，占位符替换按字节进行（替换值必须为 ASCII），
 * 复制后再把 Markdown 统一转为 UTF-8，保证新应用内文档可读。
 */
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config'

export interface AppSecretsInput {
  eosSysKey?: string
  dbHost?: string
  dbPort?: string
  dbName?: string
  dbUser?: string
  dbPassword?: string
  mailHost?: string
  mailUsername?: string
  mailPassword?: string
}

export interface ScaffoldInput {
  appId: string
  appName: string
  backendPort: number
  secrets?: AppSecretsInput
}

const TEMPLATE_DIR = path.resolve(__dirname, '../../../templates/eos-app')
const CHANGE_ME = 'CHANGE_ME'

const REQ_AGENT = `---
description: 需求对话 Agent（只输出文本与协议 JSON，不读写文件/不执行命令）
mode: primary
tools:
  bash: false
  edit: false
  write: false
  read: false
  grep: false
  glob: false
  list: false
  patch: false
  webfetch: false
  websearch: false
  todowrite: false
  task: false
  question: false
  skill: false
---
你是需求梳理对话 Agent。

- 只输出给用户的中文回复；结构化结果严格按用户消息中给出的 <<<DOC_JSON>>> 协议输出。
- 不要读取、创建或修改任何文件，不要执行命令，不要调用工具。
- 需求文档的最终写入由工作台完成；你只给出提案。
`

const DESIGN_AGENT = `---
description: 设计对话 Agent（只输出文本与协议 JSON，不读写文件/不执行命令）
mode: primary
tools:
  bash: false
  edit: false
  write: false
  read: false
  grep: false
  glob: false
  list: false
  patch: false
  webfetch: false
  websearch: false
  todowrite: false
  task: false
  question: false
  skill: false
---
你是设计分解对话 Agent。

- 只输出给用户的中文回复；结构化结果严格按用户消息中的 <<<DESIGN_JSON>>> 协议输出。
- 不要读取、创建或修改任何文件，不要执行命令，不要调用工具。
- Entity/Page/Flow/Rule/Permission 等设计的最终写入由工作台完成；你只给出提案。
`

function replaceAll(buffer: Buffer, search: Buffer, replacement: Buffer): Buffer {
  if (!buffer.includes(search)) return buffer
  const parts: Buffer[] = []
  let from = 0
  for (;;) {
    const index = buffer.indexOf(search, from)
    if (index < 0) {
      parts.push(buffer.subarray(from))
      break
    }
    parts.push(buffer.subarray(from, index), replacement)
    from = index + search.length
  }
  return Buffer.concat(parts)
}

function renderBuffer(buffer: Buffer, replacements: Record<string, string>): Buffer {
  let out = buffer
  for (const [key, value] of Object.entries(replacements)) {
    out = replaceAll(out, Buffer.from(`{{${key}}}`, 'ascii'), Buffer.from(value, 'utf8'))
  }
  return out
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function xmlEscaped(replacements: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(replacements)) out[key] = xmlEscape(value)
  return out
}

/** 模板中的非 UTF-8 Markdown 转为 UTF-8（只处理 .md） */
function normalizeMarkdown(file: string): void {
  try {
    const buffer = fs.readFileSync(file)
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buffer)
      return
    } catch {
      const text = new TextDecoder('gb18030').decode(buffer)
      fs.writeFileSync(file, text, 'utf8')
    }
  } catch {
    // 文档转换失败不影响应用创建
  }
}

function copyTemplate(source: string, target: string, replacements: Record<string, string>): void {
  fs.mkdirSync(target, { recursive: true })
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'target') continue
    const from = path.join(source, entry.name)
    const to = path.join(target, entry.name)
    if (entry.isDirectory()) {
      copyTemplate(from, to, replacements)
      continue
    }
    if (!entry.isFile()) continue
    const buffer = fs.readFileSync(from)
    const isXml = entry.name.toLowerCase().endsWith('.xml')
    fs.writeFileSync(to, buffer.includes('{{') ? renderBuffer(buffer, isXml ? xmlEscaped(replacements) : replacements) : buffer)
    if (entry.name.toLowerCase().endsWith('.md')) normalizeMarkdown(to)
  }
}

function writeIfMissing(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (!fs.existsSync(file)) fs.writeFileSync(file, content, 'utf8')
}

/** 模板 README 的“占位符”章节对已生成的应用没有意义，替换为渲染完成说明，避免残留 {{...}} */
function cleanTemplateReadme(file: string): void {
  if (!fs.existsSync(file)) return
  try {
    const text = fs.readFileSync(file, 'utf8')
    if (!text.includes('## 模板占位符')) return
    const next = text.replace(
      /## 模板占位符[\s\S]*?## 结构/,
      '## 创建时已完成渲染\n\n应用标识、端口、EOS sys-key、数据库/邮件占位符已在创建应用时替换；未提供的值写为 `CHANGE_ME`。\n\n## 结构'
    )
    fs.writeFileSync(file, next, 'utf8')
  } catch {
    // 文档整理失败不影响应用创建
  }
}

export function appDirOf(appId: string, projectsRoot: string = config.projectsDir): string {
  return path.join(projectsRoot, appId)
}

/** 写入 req/design agent（已存在则不覆盖，允许用户自定义） */
export function ensureAppAgents(appId: string, projectsRoot: string = config.projectsDir): void {
  const dir = path.join(appDirOf(appId, projectsRoot), '.opencode', 'agents')
  fs.mkdirSync(dir, { recursive: true })
  const files: Array<[string, string]> = [
    ['req.md', REQ_AGENT],
    ['design.md', DESIGN_AGENT]
  ]
  for (const [name, content] of files) {
    const file = path.join(dir, name)
    if (!fs.existsSync(file)) fs.writeFileSync(file, content, 'utf8')
  }
}

/** 校验所有会被写进模板的值：只允许 ASCII，避免破坏 GBK 模板文件 */
export function assertAsciiSecrets(secrets: AppSecretsInput | undefined): void {
  if (!secrets) return
  for (const [key, value] of Object.entries(secrets)) {
    if (value !== undefined && value !== '' && /[^\x20-\x7E]/.test(value)) {
      throw Object.assign(new Error(`字段 ${key} 只允许 ASCII 字符（模板渲染限制）`), { status: 400 })
    }
  }
}

export function scaffoldApp(input: ScaffoldInput, projectsRoot: string = config.projectsDir): void {
  const target = appDirOf(input.appId, projectsRoot)
  if (fs.existsSync(target)) {
    throw Object.assign(new Error(`应用目录已存在：${input.appId}`), { status: 409 })
  }
  const secrets = input.secrets ?? {}
  assertAsciiSecrets(secrets)
  const replacements: Record<string, string> = {
    APP_ID: input.appId,
    // spring.application.name / artifactId 等必须使用 ASCII 标识，不使用中文显示名
    APP_NAME: input.appId,
    PORT: String(input.backendPort),
    EOS_SYS_KEY: secrets.eosSysKey || CHANGE_ME,
    DB_HOST: secrets.dbHost || CHANGE_ME,
    DB_PORT: secrets.dbPort || CHANGE_ME,
    DB_NAME: secrets.dbName || CHANGE_ME,
    DB_USER: secrets.dbUser || CHANGE_ME,
    DB_PASSWORD: secrets.dbPassword || CHANGE_ME,
    MAIL_HOST: secrets.mailHost || CHANGE_ME,
    MAIL_USERNAME: secrets.mailUsername || CHANGE_ME,
    MAIL_PASSWORD: secrets.mailPassword || CHANGE_ME
  }

  if (!fs.existsSync(TEMPLATE_DIR)) throw new Error(`EOS 模板不存在：${TEMPLATE_DIR}`)

  try {
    copyTemplate(TEMPLATE_DIR, path.join(target, 'backend'), replacements)
    cleanTemplateReadme(path.join(target, 'backend', 'README.md'))
    fs.mkdirSync(path.join(target, 'docs', 'handoff'), { recursive: true })
    fs.mkdirSync(path.join(target, '.opencode', 'agents'), { recursive: true })
    fs.writeFileSync(path.join(target, 'docs', 'handoff', '.gitkeep'), '', 'utf8')
    ensureAppAgents(input.appId, projectsRoot)
    writeIfMissing(
      path.join(target, 'AGENTS.md'),
      [
        `# ${input.appName}`,
        '',
        `- 应用 ID：${input.appId}`,
        `- 后端：Java + EOS 9.0.0，参考 \`backend/\`；前端：Vue 3，目录结构自定。`,
        `- 开始开发前先读 \`docs/handoff/00-README.md\`（设计确认后生成）。`,
        `- 所有回复与思考/进度说明使用中文。`,
        `- 完成后请总结：实现摘要、关键文件、运行方式、自测结果、未解决事项。`,
        `- 不要提交真实 DB/Nacos/Redis/邮件凭据。`,
        ''
      ].join('\n')
    )
    writeIfMissing(
      path.join(target, 'README.md'),
      [
        `# ${input.appName}`,
        '',
        `- 应用 ID：${input.appId}`,
        `- 当前阶段：需求`,
        `- 交接文档：\`docs/handoff/\`（设计确认后生成）`,
        `- 后端：\`backend/\`（EOS 9.0.0 模板）`,
        `- 前端：待开发 agent 创建（Vue 3）`,
        ''
      ].join('\n')
    )
  } catch (error) {
    // 创建失败时清理半成品目录，避免“目录存在但不可用”
    fs.rmSync(target, { recursive: true, force: true })
    throw error
  }
}

/** 删除应用目录（只删本地目录，不处理任何远端资源） */
export function removeAppDir(appId: string, projectsRoot: string = config.projectsDir): void {
  const target = appDirOf(appId, projectsRoot)
  const root = path.resolve(projectsRoot)
  const relative = path.relative(root, path.resolve(target))
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('应用目录越界')
  fs.rmSync(target, { recursive: true, force: true })
}
