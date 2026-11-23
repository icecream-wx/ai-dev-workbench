/**
 * 模板渲染（纯函数，读 DB 模板对象，不访问数据库/文件）
 *
 * - 需求模板 → `docs/requirements/MOD-xxx-<标题>.md` 骨架（frontmatter + `##` 章节）
 */
import type { RequirementTemplate, TemplateSectionDef } from '../requirements/types'

export interface ModuleSkeletonInput {
  module: string
  title: string
  order: number
  templateId: string
}

function yamlString(value: string): string {
  return JSON.stringify(value)
}

/** frontmatter + H1 + 按模板章节展开的骨架 */
export function renderModuleMarkdown(template: Pick<RequirementTemplate, 'id' | 'sections'>, input: ModuleSkeletonInput): string {
  const lines: string[] = [
    '---',
    `module: ${input.module}`,
    `title: ${yamlString(input.title)}`,
    `order: ${input.order}`,
    `template: ${input.templateId}`,
    '---',
    '',
    `# ${input.title}`,
    ''
  ]
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
  }
  return `${lines.join('\n').replace(/\n+$/, '\n')}`
}
