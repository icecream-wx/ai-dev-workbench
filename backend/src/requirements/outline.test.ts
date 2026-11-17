import assert from 'node:assert/strict'
import test from 'node:test'
import {
  emptyOutline,
  normalizeOutlineSection,
  parseOutlineMarkdown,
  rebuildOutlineSection,
  renderOutlineMarkdown
} from './outline'

test('渲染结构化章节：稳定 ID 小标签 + 场景/目标/验收', () => {
  const data = normalizeOutlineSection(
    {
      scenes: [{ title: '订单管理', description: '销售维护订单' }],
      epics: [{ title: '订单创建', goal: '支持业务员创建订单', priority: 'P0' }],
      stories: [
        {
          title: '创建订单',
          description: '作为业务员，我希望创建订单',
          acceptance: ['必填校验', '保存后列表可见'],
          priority: 'P0'
        }
      ]
    },
    { kind: 'epics', global: emptyOutline() }
  )
  // 场景属于 scenes 章节，这里只验证 epics 章节
  const markdown = renderOutlineMarkdown('epics', data.data)
  assert.match(markdown, /### EPIC-001 订单创建/)
  assert.match(markdown, /目标：支持业务员创建订单/)
  assert.match(markdown, /#### STORY-001 创建订单/)
  assert.match(markdown, /验收标准：/)
  assert.match(markdown, /- 必填校验/)
})

test('标题编辑不改 ID；新增分配下一个编号；删除归档保留 ID', () => {
  const first = normalizeOutlineSection(
    { epics: [{ title: '订单创建' }, { title: '订单查询' }], stories: [{ title: '创建订单' }] },
    { kind: 'epics', global: emptyOutline() }
  )
  const epicIds = first.data.epics.map(item => item.id)
  assert.deepEqual(epicIds, ['EPIC-001', 'EPIC-002'])
  assert.equal(first.data.stories[0].id, 'STORY-001')

  const renamed = normalizeOutlineSection(
    {
      epics: [
        { id: 'EPIC-001', title: '订单创建（改）' },
        { title: '订单查询' }
      ],
      stories: [{ id: 'STORY-001', title: '创建订单（改）' }]
    },
    { kind: 'epics', previous: first.data, global: first.data }
  )
  assert.equal(renamed.data.epics[0].id, 'EPIC-001')
  assert.equal(renamed.data.epics[0].title, '订单创建（改）')
  assert.equal(renamed.data.stories[0].id, 'STORY-001')

  const removed = normalizeOutlineSection(
    { epics: [{ id: 'EPIC-001', title: '订单创建（改）' }], stories: [] },
    { kind: 'epics', previous: renamed.data, global: renamed.data }
  )
  assert.equal(removed.data.epics.find(item => item.id === 'EPIC-002')?.archived, true)
  assert.equal(removed.data.stories.find(item => item.id === 'STORY-001')?.archived, true)
  const rendered = renderOutlineMarkdown('epics', removed.data)
  assert.doesNotMatch(rendered, /EPIC-002/)
  assert.doesNotMatch(rendered, /STORY-001/)

  const added = normalizeOutlineSection(
    {
      epics: [
        { id: 'EPIC-001', title: '订单创建（改）' },
        { id: 'EPIC-002', title: '订单查询' },
        { title: '订单取消' }
      ],
      stories: []
    },
    { kind: 'epics', previous: removed.data, global: removed.data }
  )
  assert.equal(added.data.epics.find(item => item.title === '订单取消')?.id, 'EPIC-003')
})

test('Markdown 重建：解析规范结构并沿用已有 ID', () => {
  const markdown = [
    '### EPIC-001 订单创建',
    '目标：支持业务员创建订单',
    '优先级：P0',
    '',
    '#### STORY-001 创建订单',
    '作为业务员，我希望创建订单',
    '验收标准：',
    '- 必填字段校验',
    '',
    '- 保存后列表可见'
  ].join('\n')
  const parsed = parseOutlineMarkdown('epics', markdown)
  assert.equal(parsed.epics[0].id, 'EPIC-001')
  assert.equal(parsed.epics[0].goal, '支持业务员创建订单')
  assert.equal(parsed.stories[0].acceptance.length, 2)

  const rebuilt = rebuildOutlineSection('epics', markdown, null, emptyOutline())
  assert.equal(rebuilt.data.epics[0].id, 'EPIC-001')
  assert.equal(rebuilt.data.stories[0].epicId, 'EPIC-001')
  assert.equal(rebuilt.data.stories[0].title, '创建订单')
})

test('遗留 Markdown：### / 列表项可解析为场景/Epic + Story', () => {
  const scenes = parseOutlineMarkdown('scenes', '### 订单管理\n销售维护订单，跟踪状态。')
  assert.equal(scenes.scenes.length, 1)
  assert.equal(scenes.scenes[0].title, '订单管理')

  const epics = parseOutlineMarkdown('epics', '### Epic 1：订单管理\n- 作为销售，我希望创建订单，以便记录成交。')
  assert.equal(epics.epics.length, 1)
  assert.equal(epics.epics[0].title, '订单管理')

  const bullets = parseOutlineMarkdown('epics', '- 作为销售，我希望创建订单，以便记录成交。')
  assert.equal(bullets.epics.length, 1)
  assert.equal(bullets.stories.length, 1)
})
