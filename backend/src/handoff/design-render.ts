/**
 * 设计 → 开发交接包：确定性渲染（D5 / M6）
 *
 * 不调用模型，只把 DesignHandoffBundle 渲染成：
 * 00-README / 01-REQUIREMENTS / 02-DATA-MODEL / 03-PAGES / 04-PLAN / 05-CHANGES
 * + schema.sql + prototype-template.json + manifest.json
 *
 * M6：交接包是一个应用级包，内部按模块组织（`bundle.modules`）；
 * 实体/页面集/页面使用全局稳定编号；原型 PNG 路径 `prototypes/<MOD-KEY>/<ps-XXX>/page-XXX.png`。
 * 面向开发 agent：业务语言、稳定编号、可执行契约；PNG 只作视觉参考。
 */
import type { DesignField } from '../design/types'
import type {
  DesignHandoffBundle,
  DesignHandoffEntity,
  DesignHandoffFileMeta,
  DesignHandoffModule,
  DesignHandoffModuleCounts,
  DesignHandoffPage,
  DesignHandoffPageSet,
  DesignHandoffScale,
  DesignHandoffTextFile
} from './design-types'
import type { DesignHandoffPhaseDraft } from './design-scale'
import { handoffScaleSummary, handoffScaleTriggerText } from './design-scale'
import { handoffModuleCounts, moduleSummariesOf } from './design-bundle'

export const FILE_README = '00-README.md'
export const FILE_REQUIREMENTS = '01-REQUIREMENTS.md'
export const FILE_DATA_MODEL = '02-DATA-MODEL.md'
export const FILE_PAGES = '03-PAGES.md'
export const FILE_PLAN = '04-PLAN.md'
export const FILE_CHANGES = '05-CHANGES.md'
export const FILE_SCHEMA = 'schema.sql'
export const FILE_TEMPLATE = 'prototype-template.json'
export const FILE_MANIFEST = 'manifest.json'

const MARKDOWN_FILES = [
  FILE_README,
  FILE_REQUIREMENTS,
  FILE_DATA_MODEL,
  FILE_PAGES,
  FILE_PLAN,
  FILE_CHANGES
] as const

function text(value: unknown): string {
  return String(value ?? '').trim()
}

function cell(value: unknown): string {
  return String(value ?? '')
    .replace(/\|/g, '｜')
    .replace(/\r?\n/g, ' ')
    .trim()
}

function formatIso(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.toISOString().slice(0, 19).replace('T', ' ')} UTC`
}

function list(items: Array<string | undefined | null>, ordered = false): string {
  const values = items.map(item => text(item)).filter(Boolean)
  if (!values.length) return '（无）'
  return values.map((item, index) => `${ordered ? `${index + 1}.` : '-'} ${item}`).join('\n')
}

function table(headers: string[], rows: string[][]): string {
  const head = `| ${headers.join(' | ')} |`
  const divider = `| ${headers.map(() => '---').join(' | ')} |`
  const body = rows.map(row => `| ${row.map(item => cell(item)).join(' | ')} |`)
  return [head, divider, ...body].join('\n')
}

function codeBlock(content: string, lang = ''): string {
  const fence = content.includes('```') ? '````' : '```'
  return `${fence}${lang}\n${content.replace(/\s+$/, '')}\n${fence}`
}

function shortHash(hash: string): string {
  return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash
}

function typeLabel(field: DesignField): string {
  return field.type
}

function sqlType(field: DesignField): string {
  switch (field.type) {
    case 'string':
      return `VARCHAR(${Math.min(Math.max(field.length ?? 255, 1), 4000)})`
    case 'text':
      return 'TEXT'
    case 'number':
      return field.precision !== undefined ? `DECIMAL(18, ${Math.min(Math.max(field.precision, 0), 6)})` : 'BIGINT'
    case 'decimal':
      return `DECIMAL(18, ${Math.min(Math.max(field.precision ?? 2, 0), 6)})`
    case 'date':
      return 'DATE'
    case 'datetime':
      return 'DATETIME'
    case 'time':
      return 'TIME'
    case 'boolean':
      return 'TINYINT(1)'
    case 'enum':
      return 'VARCHAR(64)'
    case 'ref':
      return 'VARCHAR(64)'
    default:
      return 'VARCHAR(255)'
  }
}

function escapeSql(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "''")
}

function sqlDefault(field: DesignField): string | null {
  if (field.default === undefined || field.default === null || field.default === '') return null
  if (typeof field.default === 'boolean') return field.default ? '1' : '0'
  if (typeof field.default === 'number') return String(field.default)
  return `'${escapeSql(String(field.default))}'`
}

function primaryFieldOf(entity: DesignHandoffEntity): DesignField | null {
  return entity.fields.find(field => field.name === 'id') ?? entity.fields.find(field => field.unique) ?? null
}

function fieldOptions(field: DesignField): string {
  const parts: string[] = []
  if (field.options?.length) parts.push(`选项：${field.options.join(' / ')}`)
  if (field.ref) parts.push(`引用：${field.ref}`)
  if (field.length !== undefined) parts.push(`长度：${field.length}`)
  if (field.precision !== undefined) parts.push(`精度：${field.precision}`)
  return parts.join('；')
}

function routeOf(page: DesignHandoffPage): string {
  const base = `/${(page.entityTable ?? 'pages').replace(/_/g, '-')}`
  if (page.type === 'list') return base
  if (page.type === 'form') {
    if (page.mode === 'create') return `${base}/new`
    if (page.mode === 'edit') return `${base}/:id/edit`
    return `${base}/new 或 ${base}/:id/edit`
  }
  if (page.type === 'detail') return `${base}/:id`
  if (page.type === 'dashboard') return '/dashboard'
  return `${base}-${page.type}`
}

function pageTypeLabel(page: DesignHandoffPage): string {
  if (page.type === 'form') {
    if (page.mode === 'create') return '创建表单'
    if (page.mode === 'edit') return '编辑表单'
    return '表单'
  }
  if (page.type === 'list') return '列表'
  if (page.type === 'detail') return '详情'
  return page.type
}

function pageFields(page: DesignHandoffPage): string[] {
  return page.spec.fields ?? page.spec.columns ?? page.layout.table?.columns ?? []
}

function allStoryAcceptance(bundle: DesignHandoffBundle): Map<string, string[]> {
  return new Map(bundle.requirements.input.stories.map(story => [story.id, story.acceptance]))
}

function moduleLabel(module: DesignHandoffModule): string {
  return `${module.key} ${module.title}`
}

function totalCounts(bundle: DesignHandoffBundle): DesignHandoffModuleCounts {
  return bundle.modules.reduce(
    (sum, module) => {
      const counts = handoffModuleCounts(module)
      return {
        scenes: sum.scenes + counts.scenes,
        epics: sum.epics + counts.epics,
        stories: sum.stories + counts.stories,
        entities: sum.entities + counts.entities,
        fields: sum.fields + counts.fields,
        relations: sum.relations + counts.relations,
        pageSets: sum.pageSets + counts.pageSets,
        pages: sum.pages + counts.pages,
        prototypes: sum.prototypes + counts.prototypes
      }
    },
    { scenes: 0, epics: 0, stories: 0, entities: 0, fields: 0, relations: 0, pageSets: 0, pages: 0, prototypes: 0 }
  )
}

function moduleIndexTable(bundle: DesignHandoffBundle): string {
  return table(
    ['模块', 'key', '需求', '设计', '实体', '页面集', '页面', 'Epic/Story'],
    bundle.modules.map(module => {
      const counts = handoffModuleCounts(module)
      return [
        module.title,
        module.key,
        `v${module.requirements.version}`,
        `v${module.design.version}（${module.design.status === 'confirmed' ? '已确认' : '草稿'}）`,
        String(counts.entities),
        String(counts.pageSets),
        String(counts.pages),
        `${counts.epics} / ${counts.stories}`
      ]
    })
  )
}

/** 跨模块依赖：实体关系/页面绑定到其它模块的实体 */
function crossModuleDependencies(bundle: DesignHandoffBundle): {
  relations: string[]
  pages: string[]
} {
  const owner = new Map<string, DesignHandoffModule>()
  for (const module of bundle.modules) {
    for (const entity of module.entities) owner.set(entity.code, module)
  }
  const relations: string[] = []
  const pages: string[] = []
  for (const module of bundle.modules) {
    for (const entity of module.entities) {
      for (const relation of entity.relations) {
        if (!relation.targetCode) continue
        const target = owner.get(relation.targetCode)
        if (!target || target.id === module.id) continue
        relations.push(
          `实体 ${entity.code}「${entity.name}」→ ${relation.targetCode}「${relation.targetName}」（${moduleLabel(module)} → ${moduleLabel(target)}）`
        )
      }
    }
    for (const set of module.pageSets) {
      for (const page of set.pages) {
        if (!page.entityCode) continue
        const target = owner.get(page.entityCode)
        if (!target || target.id === module.id) continue
        pages.push(
          `页面 ${page.code}「${page.title}」绑定 ${page.entityCode}「${page.entityName}」（${moduleLabel(module)} → ${moduleLabel(target)}）`
        )
      }
    }
  }
  return { relations: Array.from(new Set(relations)), pages: Array.from(new Set(pages)) }
}

// ---- 00-README ----

function renderReadme(bundle: DesignHandoffBundle, scale?: DesignHandoffScale | null): string {
  const counts = totalCounts(bundle)
  const goal =
    text(bundle.app.description) ||
    text(bundle.requirements.input.epics[0]?.goal) ||
    text(bundle.requirements.input.epics[0]?.title) ||
    '按 01-REQUIREMENTS.md 实现。'
  const dependencies = crossModuleDependencies(bundle)
  const lines: string[] = []
  lines.push(`# ${bundle.app.name} 开发交接包`, '')
  lines.push('> 本目录是开发阶段的唯一入口。需求、数据模型、页面契约、实施计划都在这里，不需要回工作台查看。', '')
  lines.push('> 交接包是**一个应用级包**，内部按业务模块组织；开发仍是一个应用、一个代码库。', '')

  lines.push('## 1. 版本与来源', '')
  lines.push(`- 应用：${bundle.app.name}（\`${bundle.app.id}\`）`)
  lines.push(`- 生成时间：${formatIso(bundle.generatedAt)}`)
  lines.push(
    `- 变更单：#${bundle.changeSet.seq} ${bundle.changeSet.title}（scope=${bundle.changeSet.scope}，status=${bundle.changeSet.status}）`
  )
  const handoffNote =
    bundle.changeSet.seq === 1
      ? bundle.version === 1
        ? '基线：无，首次开发'
        : '同一变更单 #1 内重新生成；开发目录可能已有代码'
      : `变更 #${bundle.changeSet.seq} · 基线：${
          bundle.baselineHandoffVersion ? `v${bundle.baselineHandoffVersion}` : '—'
        } · 当前：v${bundle.version}`
  lines.push(`- 交接包：v${bundle.version}（${handoffNote}）`)
  lines.push(
    `- 需求：${bundle.modules.length} 个模块 · 聚合${
      bundle.requirementsBundle ? ` v${bundle.requirementsBundle.version}` : '（无快照）'
    } · 文档 v${bundle.requirements.version} · \`${bundle.requirements.templateName}\``
  )
  lines.push(`- 设计：v${bundle.design.version} · ${bundle.design.status} · 确认于 ${formatIso(bundle.design.confirmedAt)}`)
  lines.push(
    `- 原型模板：${bundle.template.name}（\`${bundle.template.id}\`，hash \`${shortHash(bundle.templateHash)}\`，更新于 ${formatIso(bundle.template.updatedAt)}）`
  )
  lines.push(
    `- 统计：模块 ${bundle.modules.length} / 场景 ${counts.scenes} / Epic ${counts.epics} / Story ${counts.stories} / 实体 ${counts.entities} / 页面集 ${counts.pageSets} / 页面 ${counts.pages} / 原型图 ${counts.prototypes}`
  )
  lines.push('')

  lines.push('## 2. 模块索引', '')
  lines.push(moduleIndexTable(bundle), '')
  lines.push('每个模块都有一份完整 PRD + 独立设计（实体/页面集/原型）。模块 key（`MOD-xxx`）用于目录与稳定引用。', '')

  lines.push('## 3. 一句话目标', '', goal, '')

  lines.push('## 4. 范围', '')
  lines.push('### 4.1 要做的事', '')
  if (bundle.requirements.input.epics.length) {
    const moduleByEpic = new Map<string, DesignHandoffModule>()
    for (const module of bundle.modules) {
      for (const epic of module.requirements.input.epics) moduleByEpic.set(epic.id, module)
    }
    for (const epic of bundle.requirements.input.epics) {
      const owner = moduleByEpic.get(epic.id)
      lines.push(
        `- **${epic.id} ${epic.title}**${owner ? `（${moduleLabel(owner)}）` : ''}：${
          text(epic.goal) || '目标见 01-REQUIREMENTS.md'
        }`
      )
      for (const story of epic.stories) {
        lines.push(`  - ${story.id} ${story.title}${story.acceptance.length ? `（验收：${story.acceptance.join('；')}）` : ''}`)
      }
    }
  } else {
    lines.push('- 需求文档未包含 Epic/Story 结构；以 01-REQUIREMENTS.md 的正文为准。')
  }
  lines.push('')
  lines.push('### 4.2 不做什么', '')
  lines.push('- 不实现本交接包未列出的功能；不要自行扩展范围或补造业务规则。')
  lines.push('- 不修改 `docs/handoff/` 下的交接文档；如需变更，回到工作台重新生成。')
  lines.push('- 不提交真实数据库/Nacos/Redis/邮件/license 凭据；缺失项保持 `CHANGE_ME` 或使用环境变量。')
  lines.push('- 不因为“更完整”而实现未确认的草稿/开放问题；遇到未决问题先询问用户。')
  lines.push('')

  lines.push('## 5. 跨模块依赖', '')
  if (!dependencies.relations.length && !dependencies.pages.length) {
    lines.push('（没有跨模块引用）', '')
  } else {
    lines.push('以下引用跨模块实体：允许存在，但实现时需要保证模块间数据一致（提示不阻塞）。', '')
    for (const item of dependencies.relations) lines.push(`- ${item}`)
    for (const item of dependencies.pages) lines.push(`- ${item}`)
    lines.push('')
  }

  lines.push('## 6. 技术栈与工程约束', '')
  lines.push('- 后端：Java 17 + EOS 9.0.0；`backend/` 是起点，依赖以 `backend/pom.xml` 为准（最小依赖）。')
  lines.push('- 前端：Vue 3；构建工具、TypeScript、UI 组件库、目录结构由实现者决定，不强制固定骨架。')
  lines.push('- 数据库：MySQL；参考 DDL 见 `schema.sql`，可按实际环境调整，但不生成真实外键。')
  lines.push('- 页面视觉：遵守 `prototype-template.json` 的 Token/Shell/页面模式；组件库不强制。')
  lines.push('- 不生成 OpenAPI：后端接口路径/方法按页面动作与实体 CRUD 自行设计，但必须满足 `03-PAGES.md` 的页面行为。')
  lines.push('- 直接在应用目录里实现可运行代码，不要只输出代码片段。')
  lines.push('')

  lines.push('## 7. 文件清单与阅读顺序', '')
  lines.push(
    table(
      ['文件', '内容'],
      [
        ['`01-REQUIREMENTS.md`', '按模块的已确认需求原文（Scene/Epic/Story 稳定 ID、验收标准、开放问题）'],
        ['`02-DATA-MODEL.md`', '按模块的实体/字段/关系、Mermaid ER、跨模块引用、类型映射'],
        ['`03-PAGES.md`', '按模块的页面集/页面规格/导航；页面规格是契约'],
        ['`04-PLAN.md`', '按模块的实施顺序、测试/验收清单、风险与开放问题'],
        [
          '`05-CHANGES.md`',
          bundle.changeSet.seq > 1
            ? '本次变更按模块的差异（选中模块 diff、未选模块“未变更”）；变更开发必须先读'
            : '本次变更集；首次开发为“无基线差异”'
        ],
        ['`schema.sql`', '全部模块的参考 DDL（可按实际调整；不含真实外键/凭据）'],
        ['`prototype-template.json`', '原型模板 Token/Shell/页面模式（应用级共享，视觉约束）'],
        ['`prototypes/<MOD-KEY>/`', '按模块的页面 PNG 原型（视觉参考）与可选 HTML 快照'],
        ['`manifest.json`', '版本/哈希/模块/文件清单/统计/变更单']
      ]
    ),
    ''
  )
  lines.push(
    bundle.changeSet.seq > 1
      ? '阅读顺序：**05 → 01 → 02 → 03 → 04**（05 是本次增量差异，必须先读）；生成前先看 `prototype-template.json` 与 `prototypes/`。'
      : '阅读顺序：**01 → 02 → 03 → 04**；生成前先看 `prototype-template.json` 与 `prototypes/`。',
    ''
  )
  if (scale?.suggested) {
    lines.push(
      `本交接包较大（${handoffScaleSummary(scale)}），建议按 \`04-PLAN.md\` 的《建议分阶段开发》推进；也可单会话完成。`,
      ''
    )
    if (bundle.changeSet.seq > 1) {
      lines.push(`本次为变更 #${bundle.changeSet.seq}，增量范围以 \`05-CHANGES.md\` 为准。`, '')
    }
  }

  lines.push('## 8. 关键约束（务必遵守）', '')
  lines.push('- `01-REQUIREMENTS.md` 是需求来源；`02-DATA-MODEL.md` + `schema.sql` 是数据模型参考。')
  lines.push('- `03-PAGES.md` 是页面契约；`prototypes/` 下的 PNG 是视觉参考。**两者冲突时以页面规格为准。**')
  lines.push('- 不要只依赖 PNG 图片猜实现：字段、动作、状态、验收标准才是可执行契约。')
  lines.push('- 模板 Token/Shell/页面模式必须遵守（颜色/字体/圆角/密度/侧栏或顶栏/表单呈现方式）。')
  lines.push('- 接口由页面动作与实体推导，不需要也不存在 OpenAPI 契约。')
  lines.push('- 交接包中出现的 `ENT-xxx / PS-xxx / PAGE-xxx` 是全局稳定编号，与业务名称一一对应，不要按编号猜实现。')
  lines.push('- 模块是业务分组：同一应用使用同一套代码/数据库；不要按模块拆成多个应用。')
  lines.push('')

  lines.push('## 9. 完成定义', '')
  lines.push('- `03-PAGES.md` 中所有模块的所有页面均已实现，字段/动作/状态/验收满足规格。')
  lines.push('- `02-DATA-MODEL.md` 中的实体与关系已落到数据库/后端服务。')
  lines.push('- 后端可构建（`mvn -B package` 或等价命令），前端可构建。')
  lines.push('- 按 `04-PLAN.md` 的测试/验收清单完成自测，并在总结中给出结果。')
  lines.push('- 输出实现摘要：已实现需求（Story/页面编号）、关键文件、如何运行、自测结果、未解决事项。')
  lines.push('')
  return lines.join('\n')
}

// ---- 01-REQUIREMENTS ----

function renderRequirements(bundle: DesignHandoffBundle): string {
  const lines: string[] = []
  lines.push('# 需求文档（已确认原文）', '')
  lines.push(`- 应用：${bundle.app.name}（\`${bundle.app.id}\`）`)
  lines.push(`- 模块：${bundle.modules.length} 个（下方按模块顺序）`)
  lines.push(
    `- 聚合需求：${
      bundle.requirementsBundle ? `bundle v${bundle.requirementsBundle.version} · hash \`${shortHash(bundle.requirementsBundle.hash)}\`` : '无落库快照'
    }`
  )
  lines.push('')
  lines.push(moduleIndexTable(bundle), '')
  lines.push('---', '')

  for (const module of bundle.modules) {
    lines.push(`## 模块：${module.title}（${module.key} · 需求 v${module.requirements.version}）`, '')
    lines.push(`- 文档：${module.requirements.title}`)
    lines.push(
      `- 模板：${module.requirements.templateName} · 确认时间：${formatIso(module.requirements.confirmedAt)}`
    )
    lines.push(
      `- 设计输入：\`${module.requirements.input.id}\` · 结构：${module.requirements.input.structure} · 设计 v${module.design.version}`
    )
    lines.push('')
    if (module.requirements.input.structure === 'fallback') {
      lines.push('> 注意：该模块需求文档不是标准 PRD 结构，设计输入已回退到 Scene/章节；Epic/Story 覆盖以正文为准。', '')
    }
    lines.push(module.requirements.contentMd.trim(), '')
    if (module.requirements.input.openQuestions.length) {
      lines.push('### 开放问题（来自需求文档，不阻塞开发但需注意）', '')
      lines.push(list(module.requirements.input.openQuestions.map(item => `**${item.id}** ${item.question}`)), '')
    }
    if (module.requirements.input.glossary.length) {
      lines.push('### 术语表', '')
      lines.push(
        table(
          ['术语', '说明'],
          module.requirements.input.glossary.map(item => [item.term, item.definition])
        ),
        ''
      )
    }
    lines.push('---', '')
  }
  return lines.join('\n')
}

// ---- 02-DATA-MODEL ----

function renderErDiagram(bundle: DesignHandoffBundle): string {
  const lines: string[] = ['erDiagram']
  for (const entity of bundle.entities) {
    lines.push(`  ${entity.tableName} {`)
    for (const field of entity.fields.slice(0, 12)) {
      const type = sqlType(field).replace(/\(.*$/, '').replace(/\s+/g, '_')
      lines.push(`    ${type} ${field.name}`)
    }
    lines.push('  }')
  }
  const cardinality: Record<string, string> = {
    'one-to-one': '||--||',
    'one-to-many': '||--o{',
    'many-to-one': '}o--||',
    'many-to-many': '}o--o{'
  }
  for (const entity of bundle.entities) {
    for (const relation of entity.relations) {
      if (!relation.targetTable) continue
      lines.push(
        `  ${entity.tableName} ${cardinality[relation.type] ?? '||--o{'} ${relation.targetTable} : "${cell(
          relation.name || relation.targetName
        )}"`
      )
    }
  }
  return lines.join('\n')
}

function renderEntityDetails(entity: DesignHandoffEntity): string[] {
  const lines: string[] = []
  lines.push(`#### ${entity.code} ${entity.name}`, '')
  lines.push(`- 表名：\`${entity.tableName}\``)
  if (entity.description) lines.push(`- 说明：${entity.description}`)
  if (entity.requirementRefs.length) lines.push(`- 需求依据：${entity.requirementRefs.join('、')}`)
  lines.push('')
  lines.push(
    table(
      ['字段', '标签', '类型', 'DDL 类型', '必填', '唯一', '默认', '选项/引用/长度', '备注'],
      entity.fields.map(field => [
        `\`${field.name}\``,
        field.label,
        typeLabel(field),
        sqlType(field),
        field.required ? '是' : '',
        field.unique ? '是' : '',
        field.default === undefined || field.default === null || field.default === '' ? '' : String(field.default),
        fieldOptions(field),
        field.note ?? ''
      ])
    ),
    ''
  )
  if (entity.relations.length) {
    lines.push('关系：', '')
    lines.push(
      table(
        ['关系', '类型', '目标', '源字段', '目标字段', '说明'],
        entity.relations.map(relation => [
          relation.name,
          relation.type,
          `${relation.targetCode} ${relation.targetName}${relation.targetTable ? `（\`${relation.targetTable}\`）` : ''}`,
          relation.sourceField ?? '',
          relation.targetField ?? '',
          relation.description ?? ''
        ])
      ),
      ''
    )
  }
  return lines
}

function renderDataModel(bundle: DesignHandoffBundle): string {
  const lines: string[] = []
  const counts = totalCounts(bundle)
  lines.push('# 数据模型', '')
  lines.push(
    `- 来源：设计 ${bundle.modules.map(module => `${module.key} v${module.design.version}`).join('、')}；需求文档 ${bundle.modules
      .map(module => `${module.key} v${module.requirements.version}`)
      .join('、')}`
  )
  lines.push(`- 模块 ${bundle.modules.length} 个；实体 ${counts.entities} 个；参考 DDL 见 \`${FILE_SCHEMA}\`。`)
  lines.push('- 本文件与 `schema.sql` 是数据模型参考；不生成真实外键约束，关系以列/注释表达。')
  lines.push('')

  lines.push('## 1. 实体总览', '')
  lines.push(
    table(
      ['编号', '模块', '实体', '表名', '字段数', '关系数', '需求依据'],
      bundle.modules.flatMap(module =>
        module.entities.map(entity => [
          entity.code,
          moduleLabel(module),
          entity.name,
          `\`${entity.tableName}\``,
          String(entity.fields.length),
          String(entity.relations.length),
          entity.requirementRefs.length ? entity.requirementRefs.join('、') : '（无）'
        ])
      )
    ),
    ''
  )

  lines.push('## 2. 模块实体详情', '')
  for (const module of bundle.modules) {
    lines.push(`### 模块：${module.title}（${module.key} · 设计 v${module.design.version}）`, '')
    if (!module.entities.length) {
      lines.push('（该模块没有实体）', '')
      continue
    }
    for (const entity of module.entities) lines.push(...renderEntityDetails(entity))
  }

  lines.push('## 3. ER 图', '')
  if (bundle.entities.length) {
    lines.push(codeBlock(renderErDiagram(bundle), 'mermaid'), '')
  } else {
    lines.push('（无实体）', '')
  }

  const dependencies = crossModuleDependencies(bundle)
  lines.push('## 4. 跨模块引用', '')
  if (!dependencies.relations.length && !dependencies.pages.length) {
    lines.push('（没有跨模块引用）', '')
  } else {
    lines.push('允许跨模块引用其它模块的实体（全局 ID/编号）；实现时保证模块间数据一致，不生成真实外键。', '')
    for (const item of dependencies.relations) lines.push(`- ${item}`)
    for (const item of dependencies.pages) lines.push(`- ${item}`)
    lines.push('')
  }

  lines.push('## 5. 数据约束', '')
  const requiredRules: string[] = []
  const uniqueRules: string[] = []
  const enumRules: string[] = []
  const refRules: string[] = []
  for (const module of bundle.modules) {
    for (const entity of module.entities) {
      for (const field of entity.fields) {
        if (field.required) requiredRules.push(`${module.key} ${entity.name}.${field.label} 必填`)
        if (field.unique) uniqueRules.push(`${module.key} ${entity.name}.${field.label} 唯一`)
        if (field.type === 'enum' && field.options?.length) {
          enumRules.push(`${module.key} ${entity.name}.${field.label} 取值：${field.options.join(' / ')}`)
        }
        if (field.ref) refRules.push(`${module.key} ${entity.name}.${field.label} 引用 ${field.ref}（存目标主键，不生成真实外键）`)
      }
    }
  }
  lines.push('### 5.1 必填', '', list(requiredRules), '')
  lines.push('### 5.2 唯一', '', list(uniqueRules), '')
  lines.push('### 5.3 枚举取值', '', list(enumRules), '')
  lines.push('### 5.4 引用字段', '', list(refRules), '')
  lines.push('> 跨字段/业务规则（金额精度、状态流转、权限等）以 `01-REQUIREMENTS.md` 与 `03-PAGES.md` 为准。', '')

  lines.push('## 6. 表命名与类型映射', '')
  lines.push('- 表名优先使用设计中的 `tableName`；未填写时使用 `t_entity_<全局序号>`（多模块连续编号，避免意外重名）。')
  lines.push('- 主键：优先字段 `id`；否则第一个唯一字段；都没有时补 `id VARCHAR(64)` 代理主键。')
  lines.push('- 类型映射：`string → VARCHAR(length||255)`；`text → TEXT`；`number → BIGINT`（有 precision 时 `DECIMAL(18,p)`）；`decimal → DECIMAL(18,p||2)`；`date/datetime/time` 对应同名类型；`boolean → TINYINT(1)`；`enum → VARCHAR(64)`（选项写在注释）；`ref → VARCHAR(64)`。')
  lines.push('- `schema.sql` 只是参考 DDL：可按 EOS/MySQL 实际环境调整；不生成真实外键，删除/迁移需人工确认。')
  lines.push('')
  return lines.join('\n')
}

// ---- schema.sql ----

function renderSchema(bundle: DesignHandoffBundle): string {
  const lines: string[] = []
  lines.push(`-- ${bundle.app.name}（${bundle.app.id}）参考 DDL`)
  lines.push(
    `-- 生成时间：${formatIso(bundle.generatedAt)}；来源：模块 ${bundle.modules
      .map(module => `${module.key} 设计 v${module.design.version}`)
      .join('、')} / 交接包 v${bundle.version}`
  )
  lines.push('-- 注意：')
  lines.push('--   1. 仅作参考，可按 EOS/MySQL 实际环境调整；')
  lines.push('--   2. 不生成真实外键；引用关系见列注释与 02-DATA-MODEL.md；')
  lines.push('--   3. 不包含真实凭据；请勿把生产库连接信息写进代码库。')
  lines.push('')
  if (!bundle.entities.length) {
    lines.push('-- （没有已确认实体）')
    return lines.join('\n')
  }
  for (const module of bundle.modules) {
    if (!module.entities.length) continue
    lines.push(`-- ---- 模块 ${module.key} ${module.title}（设计 v${module.design.version}）----`)
    lines.push('')
    for (const entity of module.entities) {
      const primary = primaryFieldOf(entity)
      lines.push(`-- ${entity.code} ${entity.name}${entity.description ? `：${entity.description}` : ''}`)
      lines.push(`CREATE TABLE IF NOT EXISTS \`${entity.tableName}\` (`)
      const columns: string[] = []
      if (!primary) {
        columns.push("  `id` VARCHAR(64) NOT NULL COMMENT '主键'")
      }
      for (const field of entity.fields) {
        const parts: string[] = [`  \`${field.name}\` ${sqlType(field)}`]
        const isPrimary = primary?.name === field.name
        if (field.required || isPrimary) parts.push('NOT NULL')
        const defaultValue = sqlDefault(field)
        if (defaultValue !== null) parts.push(`DEFAULT ${defaultValue}`)
        else if (!field.required && !isPrimary) parts.push('DEFAULT NULL')
        if (field.unique && !isPrimary) parts.push('UNIQUE')
        const comments: string[] = []
        if (field.label) comments.push(field.label)
        if (field.type === 'enum' && field.options?.length) comments.push(`选项：${field.options.join('/')}`)
        if (field.ref) comments.push(`引用：${field.ref}`)
        if (field.note) comments.push(field.note)
        if (isPrimary) comments.push('主键')
        if (comments.length) parts.push(`COMMENT '${escapeSql(comments.join('；'))}'`)
        columns.push(parts.join(' '))
      }
      columns.push(`  PRIMARY KEY (\`${primary?.name ?? 'id'}\`)`)
      lines.push(columns.join(',\n'))
      if (entity.description) lines.push(`) COMMENT='${escapeSql(entity.description)}';`)
      else lines.push(');')
      for (const relation of entity.relations) {
        if (!relation.targetTable) continue
        lines.push(
          `-- 关系：${entity.tableName} → ${relation.targetTable}（${relation.type}${relation.sourceField ? `，${relation.sourceField}` : ''}${relation.description ? `；${relation.description}` : ''}）`
        )
      }
      lines.push('')
    }
  }
  lines.push('-- 说明：字段长度/精度/默认值来自设计；索引、字符集、EOS 表空间等按实际项目补齐。')
  return lines.join('\n')
}

// ---- 03-PAGES ----

function renderTemplateSummary(bundle: DesignHandoffBundle): string {
  const template = bundle.template
  const lines: string[] = []
  lines.push('## 1. 原型模板摘要', '')
  lines.push(`- 模板：${template.name}（\`${template.id}\`，hash \`${shortHash(bundle.templateHash)}\`）`)
  lines.push(
    `- 分类：${template.category}；密度：${template.tokens.density}；App Shell：${template.shell.type === 'sidebar' ? '左侧栏' : '顶栏'}`
  )
  lines.push('- 应用级共享：全部模块使用同一套 Token/Shell/页面模式；模块差异仅作提示。')
  lines.push('')
  lines.push(
    table(
      ['Token', '值'],
      [
        ['主色 primary', template.tokens.primary],
        ['辅助色 accent', template.tokens.accent],
        ['中性色 neutral', template.tokens.neutral],
        ['背景 background', template.tokens.background],
        ['字体 font', template.tokens.font],
        ['圆角 radius', `${template.tokens.radius}px`],
        ['间距 spacing', `${template.tokens.spacing}px`],
        ['侧栏深色 sidebarDark', template.shell.sidebarDark ? '是' : '否'],
        ['内容宽度 contentWidth', template.shell.contentWidth ? `${template.shell.contentWidth}px` : '自适应']
      ]
    ),
    ''
  )
  lines.push(
    table(
      ['页面模式', '约束'],
      [
        ['列表', `查询 ${template.patterns.list.filters ? '有' : '无'} / 行操作 ${template.patterns.list.rowActions ? '有' : '无'} / 分页 ${template.patterns.list.pagination ? '有' : '无'}`],
        ['表单', `呈现 ${template.patterns.form.presentation === 'dialog' ? '弹窗' : '页面'} / 标签 ${template.patterns.form.labelPosition === 'top' ? '顶部' : '左侧'} / 分组 ${template.patterns.form.groups ? '有' : '无'}`],
        ['详情', `分区 ${template.patterns.detail.sections ? '有' : '无'} / 关联列表 ${template.patterns.detail.relatedLists ? '有' : '无'}`],
        ['页面集规则', `默认页面 ${template.pageSetRules.defaultPages.join('/')}；创建=${template.pageSetRules.createAs}，编辑=${template.pageSetRules.editAs}；默认分页 ${template.pageSetRules.defaultPageSize}`]
      ]
    ),
    ''
  )
  lines.push('> 上述 Token/Shell/页面模式是强约束；具体组件库、目录结构、CSS 方案自由。', '')
  return lines.join('\n')
}

function renderPageDetail(bundle: DesignHandoffBundle, set: DesignHandoffPageSet, page: DesignHandoffPage): string {
  const lines: string[] = []
  lines.push(`##### ${page.code} ${page.title}`, '')
  lines.push(`- 类型：${pageTypeLabel(page)}（\`${page.type}\`${page.mode ? `，mode=${page.mode}` : ''}）`)
  lines.push(`- 所属页面集：${set.code} ${set.title}`)
  lines.push(
    `- 绑定实体：${page.entityCode ? `${page.entityCode} ${page.entityName}（\`${page.entityTable}\`）` : '（无）'}`
  )
  lines.push(`- 路由建议（不强制）：\`${routeOf(page)}\``)
  if (page.requirementRefs.length) lines.push(`- 需求依据：${page.requirementRefs.join('、')}`)
  if (page.prototypePath) lines.push(`- 原型图片：\`${page.prototypePath}\`（视觉参考）`)
  if (page.prototypeHtmlPath) lines.push(`- HTML 快照：\`${page.prototypeHtmlPath}\`（仅参考，不是可独立运行页面）`)

  const fields = pageFields(page)
  if (fields.length) lines.push(`- 字段：${fields.join('、')}`)
  const columns = page.spec.columns ?? page.layout.table?.columns ?? []
  if (columns.length) lines.push(`- 列表列：${columns.join('、')}`)
  const searchFields = page.spec.searchFields ?? page.layout.table?.searchFields ?? []
  if (searchFields.length) lines.push(`- 查询字段：${searchFields.join('、')}`)
  if (page.type === 'list') {
    lines.push(`- 分页：每页 ${page.layout.table?.pageSize ?? bundle.template.pageSetRules.defaultPageSize} 条`)
  }
  const actions = page.spec.actions ?? page.layout.toolbar?.actions ?? []
  if (actions.length) lines.push(`- 动作：${actions.join('、')}`)
  if (page.spec.groups?.length) {
    lines.push(`- 表单分组：${page.spec.groups.map(group => `${group.title}（${group.fields.join('、')}）`).join('；')}`)
  }
  if (page.spec.states?.length) lines.push(`- 状态：${page.spec.states.join('、')}`)
  if (page.spec.description) lines.push(`- 说明：${page.spec.description}`)
  if (page.spec.notes) lines.push(`- 批注：${page.spec.notes}`)
  if (page.spec.acceptance?.length) {
    lines.push('- 验收标准：')
    for (const item of page.spec.acceptance) lines.push(`  - ${item}`)
  }
  lines.push('')
  return lines.join('\n')
}

function renderPages(bundle: DesignHandoffBundle): string {
  const lines: string[] = []
  lines.push('# 页面契约', '')
  lines.push(
    `- 来源：${bundle.modules.map(module => `${module.key} 设计 v${module.design.version}`).join('、')}；原型模板 ${bundle.template.name}`
  )
  lines.push('> **页面规格是契约，PNG 是视觉参考。** 两者冲突时以本文件的字段/动作/状态/验收为准。')
  lines.push('')

  lines.push(renderTemplateSummary(bundle))

  lines.push('## 2. 页面集总览', '')
  const allSets = bundle.modules.flatMap(module => module.pageSets.map(set => ({ module, set })))
  if (!allSets.length) {
    lines.push('（没有页面集）', '')
  } else {
    lines.push(
      table(
        ['模块', '页面集', '名称', 'Epic', '覆盖 Story', '涉及实体', '页面数'],
        allSets.map(({ module, set }) => [
          moduleLabel(module),
          set.code,
          set.title,
          set.epicId ? `${set.epicId}${set.epicTitle ? ` ${set.epicTitle}` : ''}` : '（无）',
          set.storyIds.length ? set.storyIds.join('、') : '（无）',
          set.entityCodes.length ? set.entityCodes.join('、') : '（无）',
          String(set.pages.length)
        ])
      ),
      ''
    )
  }

  lines.push('## 3. 模块页面详情', '')
  for (const module of bundle.modules) {
    lines.push(`### 模块：${module.title}（${module.key} · 设计 v${module.design.version}）`, '')
    if (!module.pageSets.length) {
      lines.push('（该模块没有页面集）', '')
      continue
    }
    for (const set of module.pageSets) {
      lines.push(`#### ${set.code} ${set.title}`, '')
      if (set.description) lines.push(`${set.description}`, '')
      if (set.epicId) lines.push(`- Epic：${set.epicId}${set.epicTitle ? ` ${set.epicTitle}` : ''}`)
      if (set.storyIds.length) {
        lines.push(
          `- 覆盖 Story：${set.storyIds
            .map((id, index) => `${id}${set.storyTitles[index] ? ` ${set.storyTitles[index]}` : ''}`)
            .join('；')}`
        )
      }
      if (set.entityCodes.length) lines.push(`- 涉及实体：${set.entityCodes.join('、')}`)
      lines.push('')
      lines.push(
        table(
          ['页面', '标题', '类型', 'mode', '实体', '原型'],
          set.pages.map(page => [
            page.code,
            page.title,
            page.type,
            page.mode ?? '',
            page.entityCode ?? '',
            page.prototypePath ? `\`${page.prototypePath}\`` : '（缺图）'
          ])
        ),
        ''
      )
      for (const page of set.pages) lines.push(renderPageDetail(bundle, set, page))
    }
  }

  lines.push('## 4. 页面导航', '')
  for (const module of bundle.modules) {
    if (!module.pageSets.length) continue
    lines.push(`### ${moduleLabel(module)}`, '')
    for (const set of module.pageSets) {
      const listPage = set.pages.find(page => page.type === 'list')
      const target = listPage ? `${listPage.code} ${listPage.title}` : `${set.code} 入口`
      lines.push(
        `- ${target} → ${
          set.pages
            .filter(page => page.type !== 'list')
            .map(page => `${page.code} ${page.title}`)
            .join(' / ') || '（无其他页面）'
        }`
      )
      lines.push('  - 创建/编辑保存后回到列表；详情/编辑页提供返回列表。')
    }
    lines.push('')
  }

  lines.push('## 5. 契约优先级', '')
  lines.push('1. 本文件的字段/动作/状态/验收标准（可执行契约）')
  lines.push('2. `02-DATA-MODEL.md` 的实体/字段/关系')
  lines.push('3. `prototypes/` 下的 PNG/HTML（视觉参考，可因组件库差异有细节偏差）')
  lines.push('')
  return lines.join('\n')
}

// ---- 04-PLAN ----

function phaseDoneCriteria(kind: DesignHandoffPhaseDraft['kind']): string {
  switch (kind) {
    case 'base':
      return '参考 DDL 可在目标库执行（或已确认不需要），后端可构建，应用壳/导航可运行。'
    case 'module':
      return '模块阶段只作分组/里程碑：模块内 Epic/页面阶段完成即可，不单独开会话、不单独调模型摘要。'
    case 'epic':
      return '该 Epic 的 Story 全部可验收，相关页面可操作，自测通过。'
    case 'other':
      return '相关页面集可操作，导航/权限/状态收尾完成。'
    case 'pageSets':
      return '该组页面集的主流程可操作，页面验收通过。'
    default:
      return '`01-REQUIREMENTS.md` 与 `03-PAGES.md` 全部可验收。'
  }
}

function renderPlanPhaseSection(
  bundle: DesignHandoffBundle,
  scale: DesignHandoffScale,
  phases: DesignHandoffPhaseDraft[]
): string {
  const storyTitles = new Map(bundle.requirements.input.stories.map(story => [story.id, story.title]))
  const pageSetByCode = new Map(bundle.pageSets.map(set => [set.code, set]))
  const pageTitles = new Map<string, string>()
  for (const set of bundle.pageSets) {
    for (const page of set.pages) pageTitles.set(page.code, page.title)
  }

  const lines: string[] = []
  lines.push('## 0. 建议分阶段开发（可选）', '')
  lines.push(`规模：${handoffScaleSummary(scale)}（${handoffScaleTriggerText(scale)}）。`, '')
  if (bundle.changeSet.seq > 1) {
    lines.push(
      `> 本次为变更 #${bundle.changeSet.seq}：以下阶段按全量交接包生成；实际开发范围以 \`05-CHANGES.md\` 的增量与影响为准，不要按阶段重写未变更部分。`,
      ''
    )
  }
  lines.push(
    '> 只是建议，不强制、不做门禁；可以继续单会话完成开发。如单个阶段仍然过大，可人工拆分为多个会话。',
    ''
  )

  let executableIndex = 0
  phases.forEach(phase => {
    const isModule = phase.kind === 'module'
    if (isModule) {
      lines.push(`### 模块阶段 · ${phase.title}`, '')
      lines.push(`- 目标：${phase.goal}`)
      if (phase.moduleKey) lines.push(`- 模块：\`${phase.moduleKey}\`（分组/里程碑，不单独开会话）`)
    } else {
      executableIndex += 1
      lines.push(`### 阶段 ${executableIndex} · ${phase.title}`, '')
      lines.push(`- 目标：${phase.goal}`)
      if (phase.moduleKey) lines.push(`- 模块：\`${phase.moduleKey}\``)
    }
    if (phase.storyIds.length) {
      lines.push(
        `- Story：${phase.storyIds
          .map(id => `${id}${storyTitles.get(id) ? ` ${storyTitles.get(id)}` : ''}`)
          .join('、')}`
      )
    }
    if (phase.pageSetCodes.length) {
      lines.push(
        `- 页面集：${phase.pageSetCodes
          .map(code => `${code}${pageSetByCode.get(code)?.title ? ` ${pageSetByCode.get(code)?.title}` : ''}`)
          .join('、')}`
      )
    }
    if (phase.pageCodes.length) {
      lines.push(
        `- 页面：${phase.pageCodes
          .map(code => `${code}${pageTitles.get(code) ? ` ${pageTitles.get(code)}` : ''}`)
          .join('、')}`
      )
    }
    if (phase.kind === 'epic') lines.push(`- 建议会话标题：\`${phase.title}\``)
    lines.push(`- 完成标准：${phaseDoneCriteria(phase.kind)}`)
    if (phase.note) lines.push(`- 说明：${phase.note}`)
    lines.push('')
  })

  lines.push('### 使用方式', '')
  lines.push('- 每个阶段可以新建或继续开发会话；同一时间仍只有一个进行中的会话。')
  lines.push('- 进入下一阶段时，把上一阶段的总结（已实现/未完成/关键文件）带到首条提示。')
  lines.push('- 全部阶段完成后再点“确认完成开发”；阶段只是建议，不改变完成语义。')
  lines.push('')
  return lines.join('\n')
}

function renderModulePlan(module: DesignHandoffModule): string[] {
  const lines: string[] = []
  lines.push(`### 模块：${module.title}（${module.key} · 设计 v${module.design.version}）`, '')
  const goals = module.requirements.input.epics.map(epic => `${epic.id} ${epic.title}：${epic.goal || epic.title}`)
  lines.push('- 模块目标：')
  if (goals.length) {
    for (const goal of goals) lines.push(`  - ${goal}`)
  } else {
    lines.push('  - 以该模块 `01-REQUIREMENTS.md` 正文为准')
  }
  lines.push(
    `- 完成标准：该模块 ${module.pageSets.reduce((sum, set) => sum + set.pages.length, 0)} 个页面可操作，Story 验收通过；跨模块依赖与其它模块联调。`
  )
  lines.push(`- 模块阶段：\`module:${module.key}\`（分组/里程碑，不单独开会话、不单独调模型摘要）`)
  lines.push('')
  if (module.requirements.input.epics.length) {
    for (const epic of module.requirements.input.epics) {
      const sets = module.pageSets.filter(set => set.epicId === epic.id)
      lines.push(`#### ${epic.id} ${epic.title}`, '')
      lines.push(`- 目标：${epic.goal || epic.title}`)
      lines.push(`- Epic 阶段：\`epic:${epic.id}\`（可执行，单独会话）`)
      if (epic.stories.length) {
        lines.push(
          `- Story：${epic.stories.map(story => `${story.id} ${story.title}`).join('、')}`
        )
      }
      if (sets.length) {
        lines.push(`- 页面集：${sets.map(set => `${set.code} ${set.title}`).join('、')}`)
      } else {
        lines.push('- 页面集：（无；按 Story 实现接口/后端能力）')
      }
      lines.push('')
    }
  }
  if (module.pageSets.length) {
    lines.push('页面集实施清单：', '')
    for (const set of module.pageSets) {
      lines.push(`- [ ] ${set.code} ${set.title}：后端实体/查询/保存接口，前端列表 → 创建/编辑 → 详情`)
      for (const page of set.pages) {
        lines.push(`  - [ ] ${page.code} ${page.title}（${pageTypeLabel(page)}${page.mode ? `/${page.mode}` : ''}）`)
      }
      lines.push('  - [ ] 导航与状态（加载/空/错误/无权限）')
    }
    lines.push('')
  }
  return lines
}

function renderPlan(
  bundle: DesignHandoffBundle,
  scale?: DesignHandoffScale | null,
  phases?: DesignHandoffPhaseDraft[]
): string {
  const acceptance = allStoryAcceptance(bundle)
  const lines: string[] = []
  lines.push('# 实施计划', '')
  lines.push('> 建议顺序，不强制。目标是先落数据模型，再按模块/页面集实现，最后自测/验收。', '')

  if (scale?.suggested && phases?.length) {
    lines.push(renderPlanPhaseSection(bundle, scale, phases))
  }

  lines.push('## 1. 建议顺序', '')
  lines.push('1. 数据模型：按 `02-DATA-MODEL.md` / `schema.sql` 建表或调整实体，完成后端基础 CRUD/查询服务。')
  lines.push('2. 模块：按模块顺序逐个实现；每个模块先打通主流程，再进入下一个模块。')
  lines.push('3. 页面集：按 `03-PAGES.md` 逐个实现列表 → 创建/编辑 → 详情。')
  lines.push('4. 状态与权限：加载/空/错误/无权限状态、必填校验、状态流转。')
  lines.push('5. 视觉：按 `prototype-template.json` 的 Token/Shell 对齐整体风格。')
  lines.push('6. 自测：按本文件测试/验收清单逐条验证，修复问题。')
  lines.push('')

  lines.push('## 2. 按模块实施清单', '')
  for (const module of bundle.modules) {
    lines.push(...renderModulePlan(module))
  }

  lines.push('## 3. 测试清单', '')
  lines.push('> 未提供独立测试用例；以 Story 验收标准与页面验收为准。')
  lines.push('')
  if (bundle.requirements.input.stories.length) {
    lines.push('### 3.1 Story 验收', '')
    for (const module of bundle.modules) {
      for (const story of module.requirements.input.stories) {
        const items = acceptance.get(story.id) ?? []
        lines.push(
          `- [ ] ${story.id} ${story.title}（${module.key}）${
            items.length ? `：${items.join('；')}` : '（无验收标准，需人工补充）'
          }`
        )
      }
    }
    lines.push('')
  }
  lines.push('### 3.2 页面验收', '')
  for (const module of bundle.modules) {
    for (const set of module.pageSets) {
      for (const page of set.pages) {
        const items = page.spec.acceptance ?? []
        lines.push(`- [ ] ${page.code} ${page.title}（${module.key}）${items.length ? `：${items.join('；')}` : '（无验收标准）'}`)
      }
    }
  }
  lines.push('')

  lines.push('## 4. 验收清单', '')
  lines.push('### 4.1 需求', '')
  for (const module of bundle.modules) {
    lines.push(`- [ ] ${module.key} ${module.title}（需求 v${module.requirements.version}）`)
    for (const story of module.requirements.input.stories) {
      lines.push(`  - [ ] ${story.id} ${story.title}`)
    }
  }
  if (!bundle.requirements.input.stories.length) lines.push('- [ ] 以 01-REQUIREMENTS.md 正文为准逐条确认')
  lines.push('')
  lines.push('### 4.2 页面', '')
  for (const module of bundle.modules) {
    for (const set of module.pageSets) {
      for (const page of set.pages) lines.push(`- [ ] ${page.code} ${page.title}（${module.key}）`)
    }
  }
  lines.push('')

  lines.push('## 5. 风险与开放问题', '')
  const risks: string[] = []
  for (const warning of bundle.warnings) risks.push(warning)
  for (const module of bundle.modules) {
    for (const question of module.requirements.input.openQuestions) {
      risks.push(`${module.key} 需求开放问题 ${question.id}：${question.question}`)
    }
    for (const story of module.coverage.stories) {
      if (!story.covered) {
        risks.push(`${module.key} Story ${story.id} ${story.title} 尚未被实体/页面覆盖，开发前确认是否本期实现`)
      }
    }
    for (const item of module.coverage.unlinkedEntities) risks.push(`${module.key} 实体 ${item.name} 没有需求依据，确认是否需要保留`)
    for (const item of module.coverage.unlinkedPages) risks.push(`${module.key} 页面 ${item.title} 没有需求依据，确认是否需要保留`)
  }
  lines.push(list(Array.from(new Set(risks))), '')

  lines.push('## 6. 交付格式', '')
  lines.push('完成后请输出：')
  lines.push('- 已实现需求（Story/页面编号）与关键页面路径；')
  lines.push('- 关键文件清单（后端/前端/数据库）；')
  lines.push('- 如何运行（命令、端口、依赖的外部服务）；')
  lines.push('- 自测结果（构建/接口/页面/数据库）；')
  lines.push('- 未解决事项、风险或与规格的偏差。')
  lines.push('')
  lines.push(
    `> 备注：Story 覆盖（${bundle.coverage.stats.coveredStoryCount}/${bundle.coverage.stats.storyCount}）仅为提示，不阻塞开发；未覆盖项是否本期实现需与用户确认。`
  )
  lines.push('')
  return lines.join('\n')
}

// ---- 05-CHANGES ----

function renderModuleChanges(module: DesignHandoffModule, seq: number): string[] {
  const lines: string[] = []
  const state = module.changeState
  if (state === 'unchanged') {
    lines.push(`## 模块：${module.title}（${module.key}）— 未变更`, '')
    lines.push('- 本次变更未包含该模块；需求/设计版本与实现保持现状，不要改动该模块代码。', '')
    return lines
  }
  if (state === 'added') {
    lines.push(`## 模块：${module.title}（${module.key}）— 新增模块`, '')
    lines.push('- 该模块不在上一版交接包基线中：视为全新增，按下文与 `01-REQUIREMENTS.md` / `03-PAGES.md` 实现。', '')
  } else {
    lines.push(`## 模块：${module.title}（${module.key}）— 变更`, '')
  }
  if (module.changeReport) {
    lines.push(module.changeReport.markdown.trim(), '')
  } else {
    lines.push('### 变更概览', '')
    lines.push(
      `> 模块「${module.title}」的基线需求/设计快照缺失（或为同变更单重新生成），无法逐条比对；请以全量交接文档为准，并在现有代码上增量修改。`,
      ''
    )
    lines.push('### 需求变更', '', '（无法比对基线）', '')
    lines.push('### 设计变更', '', '（无法比对基线）', '')
    lines.push('### 删除与迁移', '', '（无法比对基线；如确有删除，请先做影响分析并等待用户确认迁移 SQL）', '')
    if (seq > 1) lines.push('')
  }
  return lines
}

function renderChanges(bundle: DesignHandoffBundle): string {
  const change = bundle.changeSet
  const lines: string[] = []
  lines.push('# 变更集', '')
  lines.push(`- 变更单：#${change.seq} ${change.title}`)
  lines.push(`- 范围：${change.scope}`)
  lines.push(`- 状态：${change.status}`)
  lines.push(
    `- 基线交接包：${
      bundle.baselineHandoffVersion
        ? `v${bundle.baselineHandoffVersion}`
        : change.seq === 1 && bundle.version === 1
          ? '无（首次开发）'
          : '无（首次开发基线；本次为同变更单重新生成）'
    }`
  )
  lines.push(`- 当前交接包：v${bundle.version}`)
  lines.push(`- 创建时间：${formatIso(change.createdAt)}`)
  if (change.description) lines.push(`- 说明：${change.description}`)
  lines.push('')
  lines.push('## 本次变更', '')
  if (change.seq === 1 && bundle.version === 1) {
    lines.push('**初始开发（无基线差异）**', '')
    lines.push('- 这是应用的首次开发，从现有代码起点实现完整交接包内容（全部模块）。')
    lines.push('- 本次没有“删除/废弃”项，也没有数据库迁移。')
  } else if (change.seq === 1) {
    lines.push(`**同一变更单 #1 内重新生成（v${bundle.version}）**`, '')
    lines.push('- 本次不是首次开发：交接包在同一变更单内重新生成，应用目录可能已有代码。')
    lines.push('- 请在现有代码上增量修改，保留未变更的功能/接口/页面/测试；**不要重写整个项目**。')
    lines.push('- 先对照上一版交接包与现有实现，确认差异后再修改；数据库迁移需用户确认。')
  } else {
    lines.push(`**增量变更（变更单 #${change.seq}）**`, '')
    lines.push(`- 基线交接包 v${bundle.baselineHandoffVersion ?? '—'}，当前 v${bundle.version}；请在现有代码上增量实现。`)
    lines.push('- 本次变更按模块组织：选中模块给出差异，未选模块标“未变更”。')
    lines.push('- **开发第一步：先读 `05-CHANGES.md`（本文件），再读 `00-README.md` 和相关章节。**')
  }
  lines.push('')

  if (change.seq > 1) {
    for (const module of bundle.modules) {
      lines.push(...renderModuleChanges(module, change.seq))
    }
    lines.push('## 实现要求', '')
    lines.push('- 在现有代码上增量修改，保留未变更模块/功能/接口/页面与测试；**不要重写整个项目**。')
    lines.push('- 未选模块（“未变更”）不要改动；如发现跨模块依赖需要调整，先说明影响并询问用户。')
    lines.push('- 删除项先说明影响再改；数据库迁移需用户确认。')
    lines.push('- 完成后总结：变更点、影响文件、自测结果、未解决事项（含已删除文件/表/字段）。')
    lines.push('')
  } else {
    lines.push('## 模块范围', '')
    lines.push(moduleIndexTable(bundle), '')
    lines.push('## 本次范围（全量交接）', '')
    lines.push(
      `- 模块：${bundle.modules.length} 个（${bundle.modules.map(module => `${module.key} ${module.title}`).join('、')}）`
    )
    lines.push(
      `- 需求：${bundle.requirements.input.scenes.length} 场景 / ${bundle.requirements.input.epics.length} Epic / ${bundle.requirements.input.stories.length} Story`
    )
    lines.push(
      `- 设计：${bundle.entities.length} 实体 / ${bundle.pageSets.length} 页面集 / ${bundle.pageSets.reduce(
        (sum, set) => sum + set.pages.length,
        0
      )} 页面`
    )
    lines.push(`- 原型模板：${bundle.template.name}`)
    lines.push('')
    lines.push('## 实现要求', '')
    lines.push('- 在现有应用目录中实现/修改代码，不要重写整个项目（首次开发除外）。')
    lines.push('- 保留未变更的功能、接口、页面与测试；不要顺手重构无关代码。')
    lines.push('- 删除项谨慎处理：先说明影响范围，再删除对应代码/测试；数据库迁移需用户确认。')
    lines.push('- 完成后总结变更点、影响文件、自测结果、未解决事项。')
    lines.push('')
  }
  return lines.join('\n')
}

// ---- 模板 / manifest ----

function renderPrototypeTemplate(bundle: DesignHandoffBundle): string {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      id: bundle.template.id,
      name: bundle.template.name,
      category: bundle.template.category,
      description: bundle.template.description,
      tokens: bundle.template.tokens,
      shell: bundle.template.shell,
      patterns: bundle.template.patterns,
      pageSetRules: bundle.template.pageSetRules,
      prompt: bundle.template.prompt,
      hash: bundle.templateHash,
      updatedAt: bundle.template.updatedAt,
      modules: bundle.modules.map(module => ({
        key: module.key,
        title: module.title,
        templateId: module.design.templateId,
        templateHash: module.design.templateHash
      })),
      note: 'Token/Shell/页面模式是强约束；应用级共享（全部模块一致）；前端框架、组件库、目录结构自由。'
    },
    null,
    2
  )}\n`
}

export function renderManifest(
  bundle: DesignHandoffBundle,
  files: DesignHandoffFileMeta[],
  scale?: DesignHandoffScale | null,
  phases?: DesignHandoffPhaseDraft[]
): string {
  const summaries = moduleSummariesOf(bundle)
  const counts = totalCounts(bundle)
  const manifest = {
    app: { id: bundle.app.id, name: bundle.app.name },
    appId: bundle.app.id,
    appName: bundle.app.name,
    version: bundle.version,
    generatedAt: bundle.generatedAt,
    requirementsBundle: bundle.requirementsBundle,
    requirements: {
      version: bundle.requirements.version,
      hash: bundle.requirements.docHash,
      inputId: bundle.requirements.input.id,
      inputHash: bundle.requirements.input.docHash,
      templateId: bundle.requirements.templateId,
      templateName: bundle.requirements.templateName
    },
    design: {
      version: bundle.design.version,
      status: bundle.design.status,
      confirmedAt: bundle.design.confirmedAt
    },
    designModules: summaries.map(summary => ({
      id: summary.id,
      key: summary.key,
      title: summary.title,
      version: summary.design.version,
      hash: summary.design.hash,
      status: summary.design.status,
      confirmedAt: summary.design.confirmedAt,
      entityCount: summary.counts.entities,
      pageSetCount: summary.counts.pageSets,
      pageCount: summary.counts.pages,
      coverageRate: summary.coverageRate
    })),
    modules: summaries,
    totals: {
      moduleCount: summaries.length,
      ...counts,
      missingImages: summaries.reduce((sum, summary) => sum + summary.missingImages, 0)
    },
    prototypeTemplate: {
      id: bundle.template.id,
      name: bundle.template.name,
      hash: bundle.templateHash,
      updatedAt: bundle.template.updatedAt
    },
    changeSet: {
      id: bundle.changeSet.id,
      seq: bundle.changeSet.seq,
      title: bundle.changeSet.title,
      scope: bundle.changeSet.scope,
      status: bundle.changeSet.status,
      baselineHandoffVersion: bundle.baselineHandoffVersion,
      currentHandoffVersion: bundle.version,
      // C1/M6：增量变更计数（seq=1 时为 0；多模块为聚合）
      changes: bundle.changeReport
        ? { ...bundle.changeReport.counts }
        : { added: 0, modified: 0, removed: 0, total: 0 }
    },
    counts: { ...counts },
    scale: scale ?? null,
    // U7-1：仅在建议分阶段时写入阶段草案；旧交接包没有该字段（phases/generate 返回 409）
    ...(scale?.suggested && phases?.length
      ? {
          phases: phases.map(phase => ({
            key: phase.key,
            kind: phase.kind,
            title: phase.title,
            goal: phase.goal,
            storyIds: phase.storyIds,
            pageSetCodes: phase.pageSetCodes,
            pageCodes: phase.pageCodes,
            ...(phase.moduleId ? { moduleId: phase.moduleId } : {}),
            ...(phase.moduleKey ? { moduleKey: phase.moduleKey } : {}),
            ...(phase.parentKey ? { parentKey: phase.parentKey } : {}),
            ...(phase.note ? { note: phase.note } : {})
          }))
        }
      : {}),
    files: files.map(file => ({
      name: file.name,
      size: file.size,
      hash: file.hash,
      kind: file.kind
    })),
    warnings: bundle.warnings
  }
  return `${JSON.stringify(manifest, null, 2)}\n`
}

export function renderDesignHandoffText(
  bundle: DesignHandoffBundle,
  scale?: DesignHandoffScale | null,
  phases?: DesignHandoffPhaseDraft[]
): DesignHandoffTextFile[] {
  const renderers: Array<[string, string]> = [
    [FILE_README, renderReadme(bundle, scale)],
    [FILE_REQUIREMENTS, renderRequirements(bundle)],
    [FILE_DATA_MODEL, renderDataModel(bundle)],
    [FILE_PAGES, renderPages(bundle)],
    [FILE_PLAN, renderPlan(bundle, scale, phases)],
    [FILE_CHANGES, renderChanges(bundle)],
    [FILE_SCHEMA, renderSchema(bundle)],
    [FILE_TEMPLATE, renderPrototypeTemplate(bundle)]
  ]
  return renderers.map(([name, content]) => ({ name, content }))
}

export { MARKDOWN_FILES }
