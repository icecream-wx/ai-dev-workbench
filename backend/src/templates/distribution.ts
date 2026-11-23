/**
 * 模板库 → 应用工作区的“模板即 skill”分发/同步
 *
 * 布局（一个模板一个 skill）：
 *   .opencode/skills/adw-template-req-<id>/
 *     SKILL.md                              何时加载 + 章节清单 + 使用方式
 *     assets/template.md                    需求模板骨架（MOD-XXX 占位）
 *     _manifest.json                        {managed, kind, sourceId, templateName, hash}
 *   .opencode/skills/adw-template-proto-<applicationType>/   设计模板 skill（pack 型）
 *     SKILL.md                              页面库/蓝图/配方/组件映射/一致性清单
 *     assets/design-system.json             应用设计系统摘要
 *     _manifest.json                        {managed, kind: design-system, sourceId, templateName, hash}
 *   .opencode/skills/adw-requirements-document/   方法 skill（不含模板副本）
 *   .opencode/skills/adw-design-artifacts/        方法 skill（references/scripts 保留）
 *   .opencode/skills/adw-frontend-implementation/ 开发方法 skill
 *   .opencode/commands/*.md
 *
 * 规则：
 * - 只写 `.opencode/skills/adw-template-<id>/`（外加方法 skill/commands 的对齐），
 *   **不改** docs/requirements、docs/design 正文；
 * - 同步是覆盖式、幂等；全部模板保存后立即同步所有引用应用；
 * - 清理只删 `_manifest.json` 白名单里的模板 skill，不碰方法 skill 与用户自建 skill；
 * - 需求模板删除保护：仍被模块 frontmatter 引用 → 拒绝（调用方返回 409）；
 * - 设计阶段只用设计模板（应用类型 × 视觉风格 + 页面库），旧原型模板已彻底删除。
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { db } from '../db'
import { appDirOf } from '../apps/scaffold'
import { readDesignSelection, resolveDesignSelection } from '../apps/design-system'
import { getPack } from '../design/pack'
import {
  buildDesignSystemSummary,
  writeDesignSystemWorkspace,
  type DesignSelectionInput,
  type DesignSystemSummary
} from '../design/system-file'
import { readFrontmatterFile } from '../workspace/frontmatter'
import { renderModuleMarkdown } from './render'
import type { RequirementTemplate } from '../requirements/types'

export type TemplateKind = 'requirement'

/** 方法 skill：模板选择规则写在这里，模板本体放在 adw-template-* skill */
export const SKILL_IDS: Record<TemplateKind, string> = {
  requirement: 'adw-requirements-document'
}

/** 团队 skill（随工作台资产分发；模板 skill 通过相对路径引用它们） */
export const TEAM_SKILL_IDS = ['afcenter-page-generation', 'pm-components-usage'] as const

/** 开发方法 skill：对照表/蓝图复制/组件规范/截图比对/冲突与汇报 */
export const DEVELOPMENT_SKILL_ID = 'adw-frontend-implementation'

/** 方法 skill（所有应用都分发） */
export const METHOD_SKILL_IDS = [SKILL_IDS.requirement, 'adw-design-artifacts', DEVELOPMENT_SKILL_ID] as const

const TEMPLATE_SKILL_PREFIX: Record<TemplateKind, string> = {
  requirement: 'adw-template-req-'
}

/** 设计模板 skill（pack 型，按应用类型命名） */
const DESIGN_SKILL_PREFIX = 'adw-template-proto-'

/** 设计模板 skill 的 manifest kind（与需求模板区分） */
const DESIGN_SKILL_KIND = 'design-system'

/** 工作台内置 agent 资产源（与 templates/eos-app 并列） */
export function agentAssetsRoot(): string {
  return path.resolve(__dirname, '../../../templates/agent')
}

/** 模板 id 安全化（小写字母/数字/点/下划线/连字符），与旧副本命名同规则 */
export function safeTemplateId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, '-')
}

export function templateSkillId(kind: TemplateKind, id: string): string {
  return `${TEMPLATE_SKILL_PREFIX[kind]}${safeTemplateId(id)}`
}

export function templateSkillDir(appDir: string, kind: TemplateKind, id: string): string {
  return path.join(appDir, '.opencode', 'skills', templateSkillId(kind, id))
}

export interface TemplateSkillManifest {
  managed: true
  kind: TemplateKind
  skill: string
  sourceId: string
  templateName: string
  hash: string
}

export function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}

/** 读单个模板 skill 的 manifest；不是本工作台生成（或损坏）时返回 null */
export function readTemplateSkillManifest(
  appDir: string,
  kind: TemplateKind,
  id: string
): TemplateSkillManifest | null {
  const dir = templateSkillDir(appDir, kind, id)
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, '_manifest.json'), 'utf8')) as Partial<TemplateSkillManifest>
    if (parsed?.managed !== true || parsed?.kind !== kind) return null
    if (parsed?.skill !== templateSkillId(kind, id)) return null
    if (typeof parsed?.sourceId !== 'string' || parsed.sourceId !== id) return null
    return {
      managed: true,
      kind,
      skill: parsed.skill,
      sourceId: parsed.sourceId,
      templateName: typeof parsed.templateName === 'string' ? parsed.templateName : id,
      hash: typeof parsed.hash === 'string' ? parsed.hash : ''
    }
  } catch {
    return null
  }
}

function writeIfChanged(file: string, content: string): boolean {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (fs.existsSync(file)) {
    try {
      if (fs.readFileSync(file, 'utf8') === content) return false
    } catch {
      // 读失败按需要重写处理
    }
  }
  fs.writeFileSync(file, content, 'utf8')
  return true
}

function writeManifest(dir: string, manifest: TemplateSkillManifest): void {
  writeIfChanged(
    path.join(dir, '_manifest.json'),
    `${JSON.stringify(
      {
        managed: true,
        kind: manifest.kind,
        skill: manifest.skill,
        sourceId: manifest.sourceId,
        templateName: manifest.templateName,
        hash: manifest.hash
      },
      null,
      2
    )}\n`
  )
}

/** 仅内容不同才写：应用打开时对齐大量团队 skill 不做无意义复制 */
function copyFileIfChanged(source: string, target: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  try {
    if (fs.existsSync(target) && fs.readFileSync(target).equals(fs.readFileSync(source))) return
  } catch {
    // 读取失败按需要复制
  }
  fs.copyFileSync(source, target)
}

/** 复制工作台内置 skills / commands（SKILL.md 与 commands 随工作台版本对齐） */
export function installAgentAssets(appDir: string): { skills: string[]; commands: string[] } {
  const root = agentAssetsRoot()
  const skillsDir = path.join(root, 'skills')
  const commandsDir = path.join(root, 'commands')
  const skills: string[] = []
  const commands: string[] = []

  if (fs.existsSync(skillsDir)) {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      skills.push(entry.name)
      const from = path.join(skillsDir, entry.name)
      const to = path.join(appDir, '.opencode', 'skills', entry.name)
      for (const file of listFiles(from)) {
        const relative = path.relative(from, file)
        // manifest 属于应用侧派生数据，不从仓库资产覆盖
        if (relative === '_manifest.json') continue
        copyFileIfChanged(file, path.join(to, relative))
      }
    }
  }

  if (fs.existsSync(commandsDir)) {
    for (const entry of fs.readdirSync(commandsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
      commands.push(entry.name.replace(/\.md$/, ''))
      copyFileIfChanged(path.join(commandsDir, entry.name), path.join(appDir, '.opencode', 'commands', entry.name))
    }
  }

  return { skills, commands }
}

function listFiles(directory: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) listFiles(full, out)
    else if (entry.isFile()) out.push(full)
  }
  return out
}

interface AppTemplateRow {
  id: string
  name: string
  requirement_template_id: string | null
}

function appRow(appId: string): AppTemplateRow | undefined {
  return db
    .prepare('SELECT id, name, requirement_template_id FROM apps WHERE id = ?')
    .get(appId) as AppTemplateRow | undefined
}

/** 模块 frontmatter 的 template 引用（文件是唯一事实源） */
function moduleTemplateRefs(appDir: string): Array<{ file: string; module: string; template: string }> {
  const dir = path.join(appDir, 'docs', 'requirements')
  if (!fs.existsSync(dir)) return []
  const refs: Array<{ file: string; module: string; template: string }> = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name.toLowerCase() === 'readme.md') continue
    const file = path.join(dir, entry.name)
    try {
      const parsed = readFrontmatterFile(file)
      const template = parsed.data.template?.trim()
      if (!template) continue
      refs.push({ file: path.relative(appDir, file), module: parsed.data.module ?? '', template })
    } catch {
      // 读失败不影响其它文件
    }
  }
  return refs
}

function requirementTemplateOrNull(id: string | null | undefined): RequirementTemplate | null {
  if (!id) return null
  try {
    // 延迟 require：templates.ts 也会 import 本模块，避免循环依赖初始化问题
    const templates = require('../requirements/templates') as typeof import('../requirements/templates')
    return templates.getRequirementTemplateOrThrow(id)
  } catch {
    return null
  }
}

/** 应用要携带的需求模板集合：应用默认模板 + 模块 frontmatter 引用（文件是唯一事实源） */
function selectedRequirementTemplates(
  appDir: string,
  defaultId: string | null | undefined,
  warnings: string[]
): RequirementTemplate[] {
  const defaults = require('../requirements/templates') as typeof import('../requirements/templates')
  const appDefault = requirementTemplateOrNull(defaultId) ?? defaults.defaultRequirementTemplate()
  const ids = new Set<string>([appDefault.id])
  for (const ref of moduleTemplateRefs(appDir)) {
    const template = requirementTemplateOrNull(ref.template)
    if (template) ids.add(template.id)
    else warnings.push(`模块 ${ref.module || ref.file} 引用的需求模板不存在：${ref.template}`)
  }
  return [...ids]
    .sort()
    .map(id => requirementTemplateOrNull(id))
    .filter((template): template is RequirementTemplate => Boolean(template))
}

function oneLine(text: string): string {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 模板副本是“示例骨架”，不是某个具体模块：避免 agent 看到 `MOD-001-标准PRD.md`
 * 就照抄成真实模块。新建模块时必须替换 module / title / order。
 */
function requirementTemplateAsset(template: RequirementTemplate, templateId: string): string {
  const skeleton = renderModuleMarkdown(template, {
    module: 'MOD-XXX',
    title: '<模块标题>',
    order: 1,
    templateId
  })
  const note =
    '<!-- 模板示例：新建模块时替换 module / title / order；本文件是受管副本，不要直接当模块文件使用。 -->'
  return skeleton.replace('\n# ', `\n${note}\n\n# `)
}

function yamlValue(value: string): string {
  return JSON.stringify(oneLine(value))
}

function requirementSkillMarkdown(template: RequirementTemplate): string {
  const id = template.id
  const lines: string[] = [
    '---',
    `name: ${yamlValue(`需求模板：${template.name}`)}`,
    `description: ${yamlValue(
      `需求模板：${template.name}；模块 frontmatter 的 template 指向 ${id} 时加载，用于章节结构与写作要求`
    )}`,
    '---',
    '',
    `# 需求模板：${template.name}`,
    '',
    `- 模板 id：\`${id}\``,
    `- 模板提示词：${oneLine(template.prompt) || '—'}`,
    '',
    '## 何时加载',
    '',
    `- 模块 frontmatter 的 \`template\` 等于 \`${id}\` 时：先加载本 skill，再写/改该模块。`,
    '- 找不到模块指定的模板 skill 时，先找应用默认模板 skill；仍找不到则按方法 skill',
    '  `adw-requirements-document` 的通用要求写，并在回复里说明缺少模板。',
    '',
    '## 章节清单',
    ''
  ]
  let level2 = 0
  let level3 = 0
  for (const section of template.sections) {
    let heading: string
    if (section.level === 3) {
      level3 += 1
      heading = `### ${level2}.${level3} ${section.title}`
    } else {
      level2 += 1
      level3 = 0
      heading = `## ${level2}. ${section.title}`
    }
    const level = section.level === 3 ? '三级' : '二级'
    const required = section.required ? '必需' : '可选'
    const guidance = oneLine(section.guidance)
    lines.push(`- \`${heading}\`（${level}，${required}）${guidance ? `：${guidance}` : ''}`)
  }
  lines.push(
    '',
    '## 使用方式',
    '',
    '- 骨架文件：`assets/template.md`（受管资源，不要修改）。',
    `- 新建模块：复制骨架到 \`docs/requirements/MOD-xxx-<标题>.md\`，替换 frontmatter 的`,
    `  \`module\` / \`title\` / \`order\`，保留 \`template: ${id}\`。`,
    '- 更新模块：按本模板章节结构增量修改，不重写整篇、不新建重复模块。',
    '- 业务规则、用户故事、验收标准写清楚；Controller 类名、内部表结构、接口路径属于设计/代码，不要写。',
    '- 需求与设计必须一致；需要时加载 `adw-design-artifacts` 同步 `docs/design/<MOD>/design.json`。',
    '- 完成后用中文汇报：关键判断、改了哪些文件/章节、待确认项。',
    ''
  )
  return lines.join('\n')
}

function writeRequirementTemplateSkill(
  appDir: string,
  template: RequirementTemplate
): { id: string; skill: string; hash: string } {
  const id = template.id
  const skill = templateSkillId('requirement', id)
  const dir = templateSkillDir(appDir, 'requirement', id)
  const skillContent = requirementSkillMarkdown(template)
  const assetContent = requirementTemplateAsset(template, id)
  writeIfChanged(path.join(dir, 'SKILL.md'), skillContent)
  writeIfChanged(path.join(dir, 'assets', 'template.md'), assetContent)
  const hash = sha256(`${skillContent}\n${assetContent}`)
  writeManifest(dir, {
    managed: true,
    kind: 'requirement',
    skill,
    sourceId: id,
    templateName: template.name,
    hash
  })
  return { id, skill, hash }
}

export interface DesignTemplateSkillManifest {
  managed: true
  kind: typeof DESIGN_SKILL_KIND
  skill: string
  sourceId: string
  templateName: string
  hash: string
  /** P7-7c：模板来源（内置/自定义；旧 manifest 缺省按 builtin 兼容） */
  templateKind?: 'builtin' | 'custom'
  /** P7-7c：pack 版本（可选，向后兼容） */
  packVersion?: string
}

export function designTemplateSkillId(applicationType: string): string {
  return `${DESIGN_SKILL_PREFIX}${safeTemplateId(applicationType)}`
}

function designTemplateSkillMarkdown(summary: DesignSystemSummary): string {
  const pack = getPack(summary.pack)
  const lines: string[] = [
    '---',
    `name: ${yamlValue(`设计模板：${summary.applicationTypeName} · ${summary.styleName}`)}`,
    `description: ${yamlValue(
      `设计模板：${summary.applicationTypeName}（风格 ${summary.style}）；写 design.json 与实现 Vue3 页面时加载，提供页面库/蓝图/组件映射/一致性清单`
    )}`,
    '---',
    '',
    `# 设计模板：${summary.applicationTypeName}`,
    '',
    `- 模板包：\`${summary.pack}\` v${summary.packVersion}（${summary.packName}）`,
    `- 应用类型：\`${summary.applicationType}\`（${summary.applicationTypeName}）`,
    `- 视觉风格：\`${summary.style}\`（${summary.styleName}）· \`${summary.styleClassName}\``,
    '- 应用级摘要：`docs/design/design-system.json`（受管，不要手改）',
    `- 蓝图目录：\`${summary.templateDir}/\`（\`pages/*.vue\` + \`structure.css\` + \`assets/\`）`,
    `- 样式：\`${summary.styles.shared ?? '（无 shared.css）'}\` + \`${summary.styles.style}\``,
    '',
    '## 何时加载',
    '',
    '- 设计视图：为一个模块写 `docs/design/<MOD>/design.json` 前加载，确定页面骨架、配方、',
    '  组件与交互（`recipe`/`catalogRef`/`blueprint`）。',
    '- 开发视图：把蓝图复制到 `frontend/src/views/`、替换 mock/接口前加载。',
    '- 蓝图是视觉与结构基准；PNG 是模板风格截图（无显式契约的旧设计为线框）。两者冲突时以蓝图/预览为准并记录差异。',
    '',
    '## 团队 skill（同级分发，受管）',
    '',
    '- 页面模板/配方/偏好：`../afcenter-page-generation/SKILL.md`',
    '- pm-* 组件用法：`../pm-components-usage/SKILL.md`',
    '- 页面实现优先用目标工程 `src/components/PageTemplates/index.js`，不重复造模板。',
    '',
    '## 页面库与蓝图',
    '',
    '| 页面 id | 名称 | 种类 | 配方 | 蓝图/契约 | 主要组件 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...summary.pages.map(page => {
      const kind = page.kind ?? 'blueprint'
      const where =
        kind === 'contract'
          ? `契约（无蓝图） \`${page.contractFile ?? ''}\``
          : kind === 'reference'
            ? `蓝图 \`${page.blueprint ?? ''}\`（source=${page.source?.pack ?? ''}/${page.source?.applicationType ?? ''}/${
                page.source?.pageId ?? ''
              }）`
            : `蓝图 \`${page.blueprint ?? ''}\``
      return `| \`${page.id}\` | ${page.name} | \`${kind}\` | \`${page.recipe}\` | ${where} | ${
        page.components.length ? page.components.map(item => `\`${item}\``).join('、') : '—'
      } |`
    }),
    '',
    `应用类型结构样式：\`${summary.structure}\`。`,
    '',
    ...(summary.pages.some(page => page.kind === 'contract')
      ? [
          '## 契约页实现（无蓝图）',
          '',
          '- 契约页没有 `.vue` 蓝图：读 `contracts/<page>.json` + `docs/design/<MOD>/design.json` 的页面契约，',
          '  用 PageTemplates + pm-* 实现；不要复制/编造蓝图。',
          '- 页面根类用 `baseApplicationType`（见 `docs/design/design-system.json` 的 `preview`）；',
          '  合并后的 `structure.css` 已包含来源类型的结构规则。',
          '- 实现后 ui-check 记录“无蓝图，按契约实现”；缺字段时回到 design.json 补契约，不要凭感觉造字段。',
          ''
        ]
      : []),
    '## 页面配方',
    '',
    ...Object.entries(pack.pageRecipes).map(([recipe, blocks]) => `- \`${recipe}\`：${blocks.map(item => `\`${item}\``).join('、')}`),
    '',
    '## 组件映射',
    '',
    ...Object.entries(pack.componentMap).map(([field, component]) => `- \`${field}\` → \`${component}\``),
    '',
    '## 一致性清单（conformance）',
    '',
    ...pack.conformance.map(item => `- ${item}`),
    '',
    '## 读取顺序',
    '',
    '设计与开发都先读本 skill；随后：',
    '',
    '1. `docs/design/design-system.json`（本应用 pack/类型/风格/页面清单）；',
    '2. `docs/design/<MOD>/design.json`（数据模型/页面契约），以及 `design-brief.md`、',
    '   `tokens.json`、`prototypes/*.png`（模板风格截图；无显式契约的旧设计为线框，PNG 过期先说明）；',
    `3. 选中的页面蓝图 + \`structure.css\` + \`${summary.styles.style}\`；`,
    '4. 按 `afcenter-page-generation` 选页面配方/偏好，按 `pm-components-usage` 选组件；',
    '5. 开发完成后启动页面截图，与蓝图/预览逐页对照并写差异。',
    '',
    '## ui-check.md 要求',
    '',
    '- 工作台在 `docs/design/<MOD>/ui-check.md` 生成骨架；实现前填',
    '  「设计页 → 路由 → 蓝图 → 字段/列 → 操作 → 布局/交互 → 差异/决策」。',
    '- 实现后填「设计页 → 实现文件 → 截图 → 一致项 → 差异 → 原因/处理」。',
    '- 未填写不阻断实现，但要在会话摘要/验收中标记“流程未完成”。',
    '',
    '## 冲突上报与边界',
    '',
    '- 需求 / design.json / 蓝图 / tokens 冲突：先报告并说明取舍，不静默偏离。',
    '- `tokens.json` 与 PNG 只约束 Vue3 前端；EOS 后端不吃风格，不要为样式改后端结构。',
    '- 不要修改本 skill、团队 skill、`design-system.json` 与蓝图副本（受管资源会被覆盖）；',
    '  开发改的是 `frontend/src/views/` 下的实现页面。',
    '- 完成后用中文汇报：改了哪些文件、页面与蓝图对照结果、偏差、待确认项。',
    ''
  ]
  return lines.join('\n')
}

function writeDesignTemplateSkill(
  appDir: string,
  selection: DesignSelectionInput,
  appId?: string
): { id: string; skill: string; hash: string } {
  const summary = buildDesignSystemSummary(selection, appId ? { appId } : {})
  const id = summary.applicationType
  const skill = designTemplateSkillId(id)
  const dir = path.join(appDir, '.opencode', 'skills', skill)
  const skillContent = designTemplateSkillMarkdown(summary)
  const assetContent = `${JSON.stringify(summary, null, 2)}\n`
  writeIfChanged(path.join(dir, 'SKILL.md'), skillContent)
  writeIfChanged(path.join(dir, 'assets', 'design-system.json'), assetContent)
  const hash = sha256(`${skillContent}\n${assetContent}`)
  writeIfChanged(
    path.join(dir, '_manifest.json'),
    `${JSON.stringify(
      {
        managed: true,
        kind: DESIGN_SKILL_KIND,
        skill,
        sourceId: id,
        templateName: summary.applicationTypeName,
        hash,
        templateKind: summary.origin?.kind === 'custom' ? 'custom' : 'builtin',
        packVersion: summary.packVersion
      },
      null,
      2
    )}\n`
  )
  return { id, skill, hash }
}

/** 读单个设计模板 skill 的 manifest；不是本工作台生成（或损坏）时返回 null */
export function readDesignTemplateSkillManifest(
  appDir: string,
  applicationType: string
): DesignTemplateSkillManifest | null {
  const skill = designTemplateSkillId(applicationType)
  const dir = path.join(appDir, '.opencode', 'skills', skill)
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, '_manifest.json'), 'utf8')) as Partial<DesignTemplateSkillManifest>
    if (parsed?.managed !== true || parsed?.kind !== DESIGN_SKILL_KIND) return null
    if (parsed?.skill !== skill || parsed?.sourceId !== applicationType) return null
    return {
      managed: true,
      kind: DESIGN_SKILL_KIND,
      skill,
      sourceId: applicationType,
      templateName: typeof parsed.templateName === 'string' ? parsed.templateName : applicationType,
      hash: typeof parsed.hash === 'string' ? parsed.hash : ''
    }
  } catch {
    return null
  }
}

/** 列出应用里由工作台生成、且 manifest 自洽的设计模板 skill */
function listManagedDesignSkills(appDir: string): Array<{ id: string; dir: string }> {
  const skillsRoot = path.join(appDir, '.opencode', 'skills')
  if (!fs.existsSync(skillsRoot)) return []
  const found: Array<{ id: string; dir: string }> = []
  for (const entry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(DESIGN_SKILL_PREFIX)) continue
    const dir = path.join(skillsRoot, entry.name)
    let parsed: Partial<DesignTemplateSkillManifest>
    try {
      parsed = JSON.parse(fs.readFileSync(path.join(dir, '_manifest.json'), 'utf8')) as Partial<DesignTemplateSkillManifest>
    } catch {
      continue
    }
    if (parsed?.managed !== true || parsed?.kind !== DESIGN_SKILL_KIND) continue
    if (parsed?.skill !== entry.name || typeof parsed?.sourceId !== 'string') continue
    found.push({ id: parsed.sourceId, dir })
  }
  return found
}

/** 清理 manifest 白名单里、已不再被引用的设计模板 skill */
function cleanupStaleDesignSkills(appDir: string, expectedIds: Set<string>): void {
  for (const found of listManagedDesignSkills(appDir)) {
    if (expectedIds.has(found.id)) continue
    try {
      fs.rmSync(found.dir, { recursive: true, force: true })
    } catch {
      // 单个目录清理失败忽略
    }
  }
}

/** 列出应用里由工作台生成、且 manifest 自洽的模板 skill */
function listManagedTemplateSkills(
  appDir: string,
  kind: TemplateKind
): Array<{ id: string; dir: string; manifest: TemplateSkillManifest }> {
  const skillsRoot = path.join(appDir, '.opencode', 'skills')
  if (!fs.existsSync(skillsRoot)) return []
  const prefix = TEMPLATE_SKILL_PREFIX[kind]
  const found: Array<{ id: string; dir: string; manifest: TemplateSkillManifest }> = []
  for (const entry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(prefix)) continue
    const dir = path.join(skillsRoot, entry.name)
    let parsed: Partial<TemplateSkillManifest>
    try {
      parsed = JSON.parse(fs.readFileSync(path.join(dir, '_manifest.json'), 'utf8')) as Partial<TemplateSkillManifest>
    } catch {
      continue
    }
    if (parsed?.managed !== true || parsed?.kind !== kind) continue
    if (parsed?.skill !== entry.name || typeof parsed?.sourceId !== 'string') continue
    found.push({
      id: parsed.sourceId,
      dir,
      manifest: {
        managed: true,
        kind,
        skill: parsed.skill,
        sourceId: parsed.sourceId,
        templateName: typeof parsed.templateName === 'string' ? parsed.templateName : parsed.sourceId,
        hash: typeof parsed.hash === 'string' ? parsed.hash : ''
      }
    })
  }
  return found
}

/** 清理 manifest 白名单里、已不再被引用的模板 skill（不碰方法/用户 skill） */
function cleanupStaleTemplateSkills(appDir: string, kind: TemplateKind, expectedIds: Set<string>): void {
  for (const found of listManagedTemplateSkills(appDir, kind)) {
    if (expectedIds.has(found.manifest.sourceId)) continue
    try {
      fs.rmSync(found.dir, { recursive: true, force: true })
    } catch {
      // 单个目录清理失败忽略
    }
  }
}

function removeDirIfEmpty(dir: string): void {
  try {
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir)
  } catch {
    // 忽略
  }
}

interface LegacyManifest {
  managed?: boolean
  templates?: Record<string, { file?: string }>
}

function legacyManifestPath(appDir: string, kind: TemplateKind): string {
  return path.join(appDir, '.opencode', 'skills', SKILL_IDS[kind], '_manifest.json')
}

function legacyTemplatesDir(appDir: string, kind: TemplateKind): string {
  return path.join(appDir, '.opencode', 'skills', SKILL_IDS[kind], 'assets', 'templates')
}

function readLegacyManifest(appDir: string, kind: TemplateKind): LegacyManifest | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(legacyManifestPath(appDir, kind), 'utf8')) as LegacyManifest
    if (parsed?.managed !== true) return null
    return parsed
  } catch {
    return null
  }
}

/** 旧版把模板副本放在方法 skill 的 assets/templates：按旧 manifest 白名单清理 */
function cleanupLegacyMethodAssets(appDir: string, kind: TemplateKind): void {
  const manifest = readLegacyManifest(appDir, kind)
  if (!manifest) return
  const templatesDir = path.resolve(legacyTemplatesDir(appDir, kind))
  for (const entry of Object.values(manifest.templates ?? {})) {
    const file = entry && typeof entry.file === 'string' ? entry.file : ''
    if (!file) continue
    const target = path.resolve(templatesDir, file)
    if (target === templatesDir || !target.startsWith(templatesDir + path.sep)) continue
    try {
      fs.rmSync(target, { force: true })
    } catch {
      // 旧副本已不存在
    }
  }
  removeDirIfEmpty(templatesDir)
  removeDirIfEmpty(path.dirname(templatesDir))
  try {
    fs.rmSync(legacyManifestPath(appDir, kind), { force: true })
  } catch {
    // 忽略
  }
}

/** 删除单个模板的旧版副本条目（全局删除后调用） */
function removeLegacyTemplateEntry(appDir: string, kind: TemplateKind, id: string): void {
  const manifest = readLegacyManifest(appDir, kind)
  if (!manifest) return
  const entry = manifest.templates?.[id]
  if (!entry) return
  const templatesDir = path.resolve(legacyTemplatesDir(appDir, kind))
  const file = typeof entry.file === 'string' ? entry.file : ''
  if (file) {
    const target = path.resolve(templatesDir, file)
    if (target !== templatesDir && target.startsWith(templatesDir + path.sep)) {
      try {
        fs.rmSync(target, { force: true })
      } catch {
        // 忽略
      }
    }
  }
  delete (manifest.templates as Record<string, { file?: string }>)[id]
  try {
    if (Object.keys(manifest.templates ?? {}).length === 0) {
      fs.rmSync(legacyManifestPath(appDir, kind), { force: true })
    } else {
      fs.writeFileSync(legacyManifestPath(appDir, kind), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    }
  } catch {
    // 忽略
  }
  removeDirIfEmpty(templatesDir)
  removeDirIfEmpty(path.dirname(templatesDir))
}

export interface SyncTemplatesResult {
  requirementTemplates: string[]
  /** 本次生成/保留的模板 skill id（方法 skill 之外） */
  templateSkills: string[]
  warnings: string[]
}

export interface SyncTemplatesOptions {
  requirementTemplateId?: string | null
  /** 应用设计系统（pack/applicationType/style）；有值时生成 pack 型设计模板 skill */
  designSystem?: DesignSelectionInput | null
  /** 应用 id：设计模板 skill 摘要写入 preview.structureUrl（可选） */
  appId?: string
}

/**
 * 分发/对齐单个应用的模板 skill（幂等，覆盖式）；不读 DB 的版本供创建应用使用。
 * 只生成被选中的模板（应用默认 + 模块 frontmatter 引用）。
 */
export function syncTemplatesInto(appDir: string, options: SyncTemplatesOptions = {}): SyncTemplatesResult {
  const warnings: string[] = []
  if (!fs.existsSync(appDir)) {
    return { requirementTemplates: [], templateSkills: [], warnings: [`应用目录不存在：${appDir}`] }
  }

  const requirements = selectedRequirementTemplates(appDir, options.requirementTemplateId, warnings)
  const requirementTemplates: string[] = []
  const templateSkills: string[] = []
  for (const template of requirements) {
    try {
      const written = writeRequirementTemplateSkill(appDir, template)
      requirementTemplates.push(written.id)
      templateSkills.push(written.skill)
    } catch (error) {
      warnings.push(`生成需求模板 skill 失败（${template.id}）：${error instanceof Error ? error.message : String(error)}`)
    }
  }
  cleanupStaleTemplateSkills(appDir, 'requirement', new Set(requirementTemplates))
  cleanupLegacyMethodAssets(appDir, 'requirement')

  // 设计模板 skill（pack/type/style）+ 两个团队 skill
  const designSystem = options.designSystem ?? null
  const designIds = new Set<string>()
  if (designSystem) {
    designIds.add(designSystem.applicationType)
    try {
      const written = writeDesignTemplateSkill(appDir, designSystem, options.appId)
      designIds.add(written.id)
      templateSkills.push(written.skill)
    } catch (error) {
      warnings.push(
        `生成设计模板 skill 失败（${designSystem.applicationType}）：${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }
  cleanupStaleDesignSkills(appDir, designIds)

  return { requirementTemplates, templateSkills, warnings }
}

/** 应用的设计系统选择（app_settings 三键）；无选择时按默认 pack 解析 */
function appDesignSelection(appId: string): DesignSelectionInput | null {
  const current = readDesignSelection(appId)
  try {
    return resolveDesignSelection(current)
  } catch (error) {
    console.warn(
      `[templates] 应用设计系统失效，回退默认（${appId}）：${error instanceof Error ? error.message : String(error)}`
    )
    try {
      return resolveDesignSelection({})
    } catch {
      return null
    }
  }
}

/** 按应用默认模板分发/对齐（读 DB）；应用打开/会话启动兜底用 */
export function syncAppTemplates(appId: string): SyncTemplatesResult {
  const app = appRow(appId)
  if (!app) return { requirementTemplates: [], templateSkills: [], warnings: [`应用不存在：${appId}`] }
  return syncTemplatesInto(appDirOf(appId), {
    requirementTemplateId: app.requirement_template_id,
    designSystem: appDesignSelection(appId),
    appId
  })
}

/** 应用打开 / 会话启动时的幂等对齐（工作台资产 + 设计系统文件 + 模板 skill） */
export function ensureWorkspaceAssets(appId: string): { skills: string[]; commands: string[]; warnings: string[] } {
  const appDir = appDirOf(appId)
  if (!fs.existsSync(appDir)) return { skills: [], commands: [], warnings: [`应用目录不存在：${appDir}`] }
  const installed = installAgentAssets(appDir)
  const warnings: string[] = []
  const designSystem = appDesignSelection(appId)
  if (designSystem) {
    try {
      writeDesignSystemWorkspace(appDir, designSystem, { appId })
    } catch (error) {
      warnings.push(`设计系统文件对齐失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }
  try {
    const synced = syncAppTemplates(appId)
    return { ...installed, warnings: [...warnings, ...synced.warnings] }
  } catch (error) {
    return { ...installed, warnings: [...warnings, error instanceof Error ? error.message : String(error)] }
  }
}

/** 当前应用期望存在的 skill（方法 skill + 团队 skill + 当前需求模板/设计模板 skill），用于 opencode 加载校验 */
export function expectedSkillIds(appId: string): string[] {
  const ids = new Set<string>([...METHOD_SKILL_IDS, ...TEAM_SKILL_IDS])
  const app = appRow(appId)
  if (!app) return [...ids]
  const warnings: string[] = []
  const appDir = appDirOf(appId)
  for (const template of selectedRequirementTemplates(appDir, app.requirement_template_id, warnings)) {
    ids.add(templateSkillId('requirement', template.id))
  }
  const designSystem = appDesignSelection(appId)
  if (designSystem) ids.add(designTemplateSkillId(designSystem.applicationType))
  return [...ids]
}

export interface SyncTemplateToAppsResult {
  kind: TemplateKind
  id: string
  apps: string[]
  templateSkill: string
  warnings: string[]
}

/** 全局模板保存后：重新生成并同步所有引用该模板的应用（幂等） */
export function syncTemplateToApps(kind: TemplateKind, id: string): SyncTemplateToAppsResult {
  const rows = db.prepare('SELECT id FROM apps ORDER BY created_at ASC').all() as Array<{ id: string }>
  const synced: string[] = []
  const warnings: string[] = []
  for (const row of rows) {
    const appDir = appDirOf(row.id)
    if (!fs.existsSync(appDir)) continue
    if (!templateReferencedBy(appDir, row.id, id)) continue
    try {
      const result = syncAppTemplates(row.id)
      for (const warning of result.warnings) warnings.push(`${row.id}: ${warning}`)
      synced.push(row.id)
    } catch (error) {
      warnings.push(`${row.id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return { kind, id, apps: synced, templateSkill: templateSkillId(kind, id), warnings }
}

function templateReferencedBy(appDir: string, appId: string, id: string): boolean {
  const app = appRow(appId)
  if (!app) return false
  if (app.requirement_template_id === id) return true
  if (moduleTemplateRefs(appDir).some(ref => ref.template === id)) return true
  return Boolean(readTemplateSkillManifest(appDir, 'requirement', id))
}

export interface TemplateUsage {
  kind: TemplateKind
  id: string
  apps: Array<{ appId: string; appName: string; modules: Array<{ module: string; file: string }> }>
}

/** 模板使用情况：需求模板按模块 frontmatter 引用统计（用于删除保护 409） */
export function templateUsage(kind: TemplateKind, id: string): TemplateUsage {
  const rows = db.prepare('SELECT id, name FROM apps ORDER BY created_at ASC').all() as Array<{ id: string; name: string }>
  const apps: TemplateUsage['apps'] = []
  for (const row of rows) {
    const appDir = appDirOf(row.id)
    if (!fs.existsSync(appDir)) continue
    const modules = moduleTemplateRefs(appDir)
      .filter(ref => ref.template === id)
      .map(ref => ({ module: ref.module, file: ref.file }))
    if (modules.length) apps.push({ appId: row.id, appName: row.name, modules })
  }
  return { kind, id, apps }
}

/** 模板删除后：移除各应用里对应的模板 skill / 旧副本（只动受管资源） */
export function removeTemplateAssets(kind: TemplateKind, id: string): { kind: TemplateKind; id: string; apps: string[] } {
  const rows = db.prepare('SELECT id FROM apps ORDER BY created_at ASC').all() as Array<{ id: string }>
  const touched: string[] = []
  for (const row of rows) {
    const appDir = appDirOf(row.id)
    if (!fs.existsSync(appDir)) continue
    let changed = false
    if (readTemplateSkillManifest(appDir, kind, id)) {
      try {
        fs.rmSync(templateSkillDir(appDir, kind, id), { recursive: true, force: true })
        changed = true
      } catch {
        // 单应用清理失败不阻塞其它应用
      }
    }
    removeLegacyTemplateEntry(appDir, kind, id)
    if (changed) touched.push(row.id)
  }
  return { kind, id, apps: touched }
}
