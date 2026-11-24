/**
 * UI 截图脚本共享 fixture（D3 去模块后）
 *
 * - 只写应用工作区的需求单文档 / entities.json / pages.json；
 * - 不调用模型、不启停真实实例；
 * - 仅供 backend/scripts/ui*-shots.ts 使用。
 */
import fs from 'node:fs'
import path from 'node:path'

export interface EpicFixture {
  id: string
  title: string
  stories?: Array<{ id: string; title: string }>
}

/** 写 `docs/requirements/requirements.md`（单文档；frontmatter 只有 title/template） */
export function writeRequirementsDoc(
  appDir: string,
  options: { title?: string; epics?: EpicFixture[] } = {}
): void {
  const title = options.title || '商品管理'
  const epics = options.epics || [
    { id: 'EP-001', title, stories: [{ id: 'US-001', title: '商品台账' }] }
  ]
  const lines = [
    '---',
    `title: ${title}`,
    'template: builtin-prd-lite',
    '---',
    '',
    `# ${title}`,
    '',
    '## 1. 文档信息',
    '',
    '| 项 | 值 |',
    '| --- | --- |',
    '| 应用 | ' + title + ' |',
    '| 范围 | 单文档；页面集 = Epic |',
    '',
    '## 2. 目标',
    '',
    '完成商品台账的查询、维护与导出。',
    ''
  ]
  for (const epic of epics) {
    lines.push(`### ${epic.id} ${epic.title}`, '', '#### 目标', '', `${epic.title}业务闭环。`, '')
    for (const story of epic.stories || []) {
      lines.push(`##### ${story.id} ${story.title}`, '', `- ${story.title}可查询、可维护。`, '')
    }
  }
  lines.push('## 3. 验收', '', '- 关键页面可访问；字段与页面契约一致。', '')
  const dir = path.join(appDir, 'docs', 'requirements')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'requirements.md'), lines.join('\n'), 'utf8')
}

/** 写 `docs/design/entities.json` 与 `pages.json`（应用级；字段用 code） */
export function writeDesignArtifacts(
  appDir: string,
  entities: unknown[],
  pageSets: unknown[],
  relations: unknown[] = []
): void {
  const dir = path.join(appDir, 'docs', 'design')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'entities.json'),
    `${JSON.stringify({ schemaVersion: 2, entities, relations }, null, 2)}\n`,
    'utf8'
  )
  fs.writeFileSync(
    path.join(dir, 'pages.json'),
    `${JSON.stringify({ schemaVersion: 2, pageSets }, null, 2)}\n`,
    'utf8'
  )
}
