/**
 * 应用目录脚手架
 *
 * 把 `templates/eos-app` 复制为 `projects/<app-id>/backend/`，并生成共享工作区：
 *
 * ```
 * AGENTS.md
 * README.md
 * opencode.json                                permission.edit：受管资源 deny
 * .opencode/skills/adw-requirements-document/  方法 skill（SKILL.md）
 * .opencode/skills/adw-design-artifacts/       方法 skill（SKILL.md + references + scripts）
 * .opencode/skills/adw-template-req-<id>/      需求模板 skill（SKILL.md + assets/template.md + _manifest.json）
 * .opencode/skills/adw-template-proto-<applicationType>/ 设计模板 skill（SKILL.md + assets/design-system.json + _manifest.json）
 * .opencode/commands/*.md
 * docs/requirements/requirements.md         需求单文档骨架（按所选需求模板纯渲染，不调模型）
 * docs/design/                                 空目录（entities.json / pages.json 由设计 agent 首次生成）
 * backend/                                     EOS 骨架
 * ```
 *
 * - 不创建 `.opencode/agents`（退役 req/design agent）；
 * - **不创建任何 git 文件、不执行任何 git 命令**；
 * - 占位符一次替换；未提供的敏感项写成显式 `CHANGE_ME`。
 */
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config'
import { buildDesignSystemSummary, writeDesignSystemWorkspace, type DesignSelectionInput } from '../design/system-file'
import { installAgentAssets, syncTemplatesInto } from '../templates/distribution'
import { renderRequirementsMarkdown } from '../templates/render'
import { CHINESE_INSTRUCTION } from '../chat/prompts'

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
  /** 应用默认需求模板（创建时写入工作区副本；DB 登记由调用方完成） */
  requirementTemplateId?: string | null
  /** 应用设计系统（pack/applicationType/style）；提供时生成 MF remote + 设计系统/蓝图/设计模板 skill */
  designSystem?: DesignSelectionInput | null
}

const TEMPLATE_DIR = path.resolve(__dirname, '../../../templates/eos-app')
const REMOTE_TEMPLATE_DIR = path.resolve(__dirname, '../../../templates/afc-remote')
const CHANGE_ME = 'CHANGE_ME'

function appAgentsMd(withDesignSystem: boolean): string {
  const designLines = withDesignSystem
    ? '- `docs/design/design-system.json`：应用设计系统摘要（pack/应用类型/风格/页面库/蓝图/契约路径，受管）\n' +
      '- `docs/design/template/`：页面蓝图、契约页 JSON 与风格副本（受管；开发复制到 `frontend/src/views/`）\n' +
      '- 契约页：`docs/design/template/<applicationType>/contracts/<page>.json`（无蓝图，按契约实现）\n' +
      '- 风格样式：`docs/design/template/styles/<styleId>/style.css` + `styles/shared.css`（以 design-system.json 的 styles 为准）\n' +
      '- `frontend/`：独立 MF remote 骨架（webpack + Module Federation）；页面从蓝图复制/适配\n'
    : ''
  const designSkillLine = withDesignSystem
    ? '- 页面布局/风格以 `adw-template-proto-<applicationType>` skill 为准（pack/类型/风格、页面库/蓝图、\n' +
      '  组件映射、conformance、ui-check 要求）。\n'
    : '- 设计/开发按应用设计模板（应用类型 × 视觉风格）执行；当前工作区未生成设计系统文件，\n' +
      '  请先在设计视图选择设计模板后重新对齐。\n'
  const designSystemSection = withDesignSystem
    ? `## 设计系统与开发规则

- 应用设计系统：pack / 应用类型 / 视觉风格见 \`docs/design/design-system.json\`；
  页面库、蓝图与样式见 \`docs/design/template/\`。**蓝图/摘要/样式是受管副本，不要修改**。
- 风格样式：\`docs/design/template/styles/<styleId>/style.css\`（共享变量 \`styles/shared.css\`；
  以 design-system.json 的 \`styles\` 为准）。
- 团队 skill：\`afcenter-page-generation\`（PageTemplates/页面配方/偏好）、
  \`pm-components-usage\`（pm-* 用法）；开发方法 skill：\`adw-frontend-implementation\`。
- 读取顺序：AGENTS.md → design-system.json → \`docs/design/entities.json\` /
  \`docs/design/pages.json\` / design-brief.md / tokens.json / prototypes → 蓝图 → \`frontend/\` 现有代码。
- 优先级：**需求 > design-system/pages.json 契约 > entities.json > 蓝图（布局/组件） > brief/tokens（视觉变量）
  > prototypes/*.png（模板风格截图；无显式契约的旧设计为线框）**。任何冲突先报告（附文件/字段证据），不要静默取舍。
- **先填后写（软门禁，不阻断）**：开发前先填写 \`docs/design/ui-check.md\` 的
  「实现前」对照表（按 Epic/页面集分节；页面 → 路由 → 蓝图 → 字段/列 → 操作 → 布局/交互 → 差异/决策），
  实现后补「实现后」表；未填写不阻断，但完成汇报要标记“流程未完成”。
- **蓝图复制/适配**：从 \`docs/design/template/<applicationType>/pages/*.vue\` 复制到
  \`frontend/src/views/\`，保留结构/样式/组件，替换 mock/接口；不要手写一套 UI 替代模板。
- **契约页实现（无蓝图）**：\`docs/design/template/<applicationType>/contracts/<page>.json\` 是默认骨架；
  结合 \`docs/design/pages.json\` 的页面契约 + PageTemplates/pm-* 实现，**不要为契约页复制/编造蓝图**；
  页面根类用 \`baseApplicationType\`（见 \`design-system.json\` 的 \`preview\`），实现后 ui-check 记录“无蓝图，按契约实现”。
- **模板组件**：优先使用 \`frontend/src/components/PageTemplates/\`
  （BusinessListPage/TreeListPage/StandardFormPage/FormSection/QueryPanel/RowActions/ThreePartPagination）；
  新增/编辑默认 \`pm-form-dialog\`；\`el-table\` 统一 \`v-auto-height\`；业务字段 > 8 用双列；
  批量操作放 \`batch-actions\`；树节点菜单用 MoreFilled。
- **pm-* 由 AFCenter 宿主全局提供**，不要重复注册/打包；缺少 pm-* 或 PageTemplates 时停下报告，
  不要自造同名组件。
- 统一导入 \`frontend/src/preferences/GlobalPreference.js\`；预设只在页面 computed 合并，
  不要直接修改全局偏好单例。
- 偏离设计时写明原因与影响（ui-check.md 的差异列 + 完成汇报）；PNG 是模板风格截图
  （无显式契约的旧设计为线框），蓝图/预览是视觉事实；\`prototypes/_manifest.json\` 的 designHash 不一致视为过期，先说明再参考。
- EOS 后端不吃风格：tokens / PNG / 蓝图只约束 Vue3 前端，不要为样式改后端结构。

`
    : ''
  return `# 应用约定

本目录是一个应用的共享工作区：**产物是文件，单一事实源是工作区**。

## 布局

- \`docs/requirements/requirements.md\`：唯一需求文档（单文档；frontmatter 只 title/template）
- \`docs/design/entities.json\`：实体集（实体 + 关系，全局一张 ER 图）
- \`docs/design/pages.json\`：页面集（页面集 = Epic；页面契约）
- \`docs/design/api-design.md\`：接口设计（固定模板：索引/覆盖矩阵/详情/错误码/权限）
${designLines}- \`backend/\`：Java + EOS 9.0.0 后端骨架
- \`.opencode/skills/\`、\`.opencode/commands/\`：**受管资源**（工作台写入，勿手改）

## 需求文档契约

- 开头必须是 frontmatter：\`title\`、\`template\`（不再有 module/order）。
- 正文用 \`##\` 章节；章节结构以 frontmatter 的 \`template\` 对应的
  \`adw-template-req-<id>\` skill 为准（骨架在 \`assets/template.md\`）；找不到时用应用默认模板 skill。
- Epic 用 \`### EP-001 标题\`、Story 用 \`#### US-001 标题\` 稳定 ID；设计页面集按 Epic 引用。
- 单文档：不要新建 \`MOD-xxx-*.md\`。

## 设计文件契约

- \`docs/design/entities.json\`：\`{schemaVersion, entities, relations}\`；实体 \`id/name/table/fields\`，
  字段必须有英文 \`code\`（lowerCamel）+ 中文 \`name\` + \`type\`；enum 用 \`options:[{value,label}]\`；ref 写 \`ref\`。
- \`docs/design/pages.json\`：\`{schemaVersion, pageSets}\`；页面集 \`id/epic/title/pages\`，
  页面契约引用字段 \`code\`；页面 id 应用内唯一。
- 格式以 \`.opencode/skills/adw-design-artifacts/references/entities.schema.json\` 与
  \`pages.schema.json\` 为准；写完可运行 \`.opencode/skills/adw-design-artifacts/scripts/validate.mjs\` 自查。
- 接口设计：\`docs/design/api-design.md\`，固定模板/规范见 \`adw-api-design\` skill；
  写完运行 \`.opencode/skills/adw-api-design/scripts/validate-api-design.mjs --app .\`（errors 必须清零）。
${designSkillLine}- 实体/关系全局唯一；页面用 \`pageSets\` 分组，不做目录/权限/会话。

${designSystemSection}## 设计参考（开发）

- 结构唯一来源：\`docs/design/entities.json\` + \`docs/design/pages.json\`（页面契约/字段/操作）。
- 开发参考：\`docs/design/design-brief.md\`（概览/导航/页面/组件/风格）、
  \`tokens.json\`（色板/字体/圆角/间距）、\`prototypes/*.png\`（模板风格截图；无显式契约的旧设计为线框）。
- 优先级：需求 > pages.json 的结构/字段/交互 > entities.json / api-design.md > design-brief/tokens/PNG 的风格。
- PNG 过期（\`prototypes/_manifest.json\` 的 \`designHash\` 与当前设计产物不一致）时先说明，不要盲从旧图。
- tokens/PNG 只约束 Vue3 前端；EOS 后端不吃风格，不要为样式改后端结构。
- \`tokens.json\` 与 \`prototypes/**\` 由工作台生成，**不要手改**。

## 必须遵守

- 需求写**目标与验收**；不写 Controller 类名、内部表结构、接口路径。
- 需求与设计必须一致；改了一边要同步另一边，并说明改了哪里。
- ${CHINESE_INSTRUCTION}
- 不要修改 \`.opencode/skills/**\` 与 \`.opencode/commands/**\`（受管资源会被覆盖）。
- **不要执行任何 git 操作**（不 init / commit / revert）。
- 不要提交真实 DB/Nacos/Redis/邮件凭据。
- 完成后汇报：关键判断、改了哪些文件/章节、自测或校验结果、待确认项。
`
}

function readmeOf(input: ScaffoldInput): string {
  const frontend = input.designSystem
    ? '- 前端：`frontend/`（Module Federation remote 骨架；页面从 `docs/design/template/` 复制）'
    : '- 前端：Vue 3（按需创建）'
  const designLine = input.designSystem
    ? '- 设计系统：`docs/design/design-system.json`（受管；含 pack/应用类型/风格/页面蓝图/契约）'
    : ''
  return `# ${input.appName}

- 应用 ID：\`${input.appId}\`
- 需求：\`docs/requirements/requirements.md\`（单文档）
- 设计：\`docs/design/entities.json\` + \`docs/design/pages.json\` + \`docs/design/api-design.md\`
- 后端：\`backend/\`（EOS 9.0.0 模板，端口 ${input.backendPort}）
${frontend}
${designLine}

工作台提供三个视图（需求 / 设计 / 开发）与对话；产物以文件为准。
`
}

function opencodeJson(): string {
  return `${JSON.stringify(
    {
      $schema: 'https://opencode.ai/config.json',
      permission: {
        edit: {
          '*': 'allow',
          '.opencode/skills/**': 'deny',
          '.opencode/commands/**': 'deny'
        }
      }
    },
    null,
    2
  )}\n`
}

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

/** 校验所有会被写进模板的值：只允许 ASCII，避免破坏 GBK 模板文件 */
export function assertAsciiSecrets(secrets: AppSecretsInput | undefined): void {
  if (!secrets) return
  for (const [key, value] of Object.entries(secrets)) {
    if (value !== undefined && value !== '' && /[^\x20-\x7E]/.test(value)) {
      throw Object.assign(new Error(`字段 ${key} 只允许 ASCII 字符（模板渲染限制）`), { status: 400 })
    }
  }
}

export interface ScaffoldResult {
  skills: string[]
  commands: string[]
  warnings: string[]
}

export function scaffoldApp(input: ScaffoldInput, projectsRoot: string = config.projectsDir): ScaffoldResult {
  // 先校验设计系统（非法参数不建目录、不落半成品）
  const designSystem = input.designSystem ?? null
  const designSummary = designSystem ? buildDesignSystemSummary(designSystem, { appId: input.appId }) : null
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
  if (designSummary && !fs.existsSync(REMOTE_TEMPLATE_DIR)) {
    throw new Error(`前端 MF 模板不存在：${REMOTE_TEMPLATE_DIR}`)
  }

  try {
    copyTemplate(TEMPLATE_DIR, path.join(target, 'backend'), replacements)
    cleanTemplateReadme(path.join(target, 'backend', 'README.md'))

    fs.mkdirSync(path.join(target, 'docs', 'requirements'), { recursive: true })
    fs.mkdirSync(path.join(target, 'docs', 'design'), { recursive: true })
    // 单需求文档骨架（按所选需求模板；不调模型、不生成内容；已存在不覆盖由调用方保证）
    {
      const templates = require('../requirements/templates') as typeof import('../requirements/templates')
      let template
      try {
        template = input.requirementTemplateId
          ? templates.getRequirementTemplateOrThrow(input.requirementTemplateId)
          : templates.defaultRequirementTemplate()
      } catch {
        template = templates.defaultRequirementTemplate()
      }
      fs.writeFileSync(
        path.join(target, 'docs', 'requirements', 'requirements.md'),
        renderRequirementsMarkdown(template, { title: input.appName, templateId: template.id }),
        'utf8'
      )
    }

    if (designSystem) {
      // MF remote 骨架（setting.json/package.json 的应用名在复制时替换）
      copyTemplate(REMOTE_TEMPLATE_DIR, path.join(target, 'frontend'), replacements)
      // 设计系统摘要 + 蓝图/契约/风格副本（只复制选中的应用类型）
      writeDesignSystemWorkspace(target, designSystem, { appId: input.appId })
    }

    fs.writeFileSync(path.join(target, 'AGENTS.md'), appAgentsMd(Boolean(designSystem)), 'utf8')
    fs.writeFileSync(path.join(target, 'README.md'), readmeOf(input), 'utf8')
    fs.writeFileSync(path.join(target, 'opencode.json'), opencodeJson(), 'utf8')

    const installed = installAgentAssets(target)
    const synced = syncTemplatesInto(target, {
      requirementTemplateId: input.requirementTemplateId ?? null,
      designSystem,
      appId: input.appId
    })
    return { skills: installed.skills, commands: installed.commands, warnings: synced.warnings }
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
