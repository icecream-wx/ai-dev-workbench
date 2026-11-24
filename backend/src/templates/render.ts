/**
 * 模板渲染（纯函数，读 DB 模板对象，不访问数据库/文件）
 *
 * - 需求模板 → `docs/requirements/requirements.md` 单文档骨架（frontmatter + `##` 章节）
 * - 无 `module` / `order`；Epic/Story 使用 `EP-001` / `US-001` 约定
 */
import type { RequirementTemplate, TemplateSectionDef } from '../requirements/types'

export interface RequirementSkeletonInput {
  title: string
  templateId: string
}

function yamlString(value: string): string {
  return JSON.stringify(value)
}

/** 章节内的最小说明（不给业务内容，只给写法占位） */
const SECTION_HINTS: Record<string, string[]> = {
  meta: ['<!-- 填写文档信息：版本、更新时间、范围、依据。 -->'],
  metrics: ['<!-- 填写成功指标（可量化）；没有则写「无」。 -->'],
  roles: ['<!-- 按角色列出职责与权限；示例：- 运营：维护商品。 -->'],
  scenes: ['<!-- 按场景列出核心流程；示例：- 商品建档 → 上下架。 -->'],
  rules: ['<!-- 按规则列出业务约束；示例：- 商品编码唯一。 -->'],
  pages: ['<!-- 页面清单由设计阶段维护 pages.json；这里只写页面用途。 -->'],
  nfr: ['<!-- 非功能需求：性能、可用性、安全、合规。 -->'],
  issues: ['<!-- 记录待确认问题与风险。 -->'],
  glossary: ['<!-- 术语表：术语 → 说明。 -->'],
  acceptance: ['<!-- 验收标准：可执行、可验证的条目。 -->']
}

/** Epic/Story 骨架：稳定 ID 约定，供 pages.json 的 pageSets[].epic 引用 */
const EPICS_SKELETON = [
  '### EP-001 <Epic 标题>',
  '',
  '**目标**：<!-- 该 Epic 要达成的业务目标 -->',
  '',
  '#### US-001 <用户故事标题>',
  '',
  '- 作为<!-- 角色 -->，我希望<!-- 能力 -->，以便<!-- 价值 -->。',
  '- 验收标准：<!-- 可验证的条目 -->',
  ''
]

function sectionHint(section: TemplateSectionDef): string[] {
  if (section.kind === 'epics') return EPICS_SKELETON
  const hint = SECTION_HINTS[section.kind]
  return hint ? [...hint, ''] : []
}

/** frontmatter + H1 + 按模板章节展开的骨架（不调模型、不生成业务内容） */
export function renderRequirementsMarkdown(
  template: Pick<RequirementTemplate, 'id' | 'sections'>,
  input: RequirementSkeletonInput
): string {
  const title = input.title.trim() || '需求文档'
  const lines: string[] = ['---', `title: ${yamlString(title)}`, `template: ${input.templateId}`, '---', '', `# ${title}`, '']
  let level2 = 0
  let level3 = 0
  for (const section of template.sections as TemplateSectionDef[]) {
    if (section.level === 3) {
      level3 += 1
      lines.push(`### ${level2}.${level3} ${section.title}`, '')
    } else {
      level2 += 1
      level3 = 0
      lines.push(`## ${level2}. ${section.title}`, '')
    }
    lines.push(...sectionHint(section))
  }
  return `${lines.join('\n').replace(/\n+$/, '\n')}`
}
