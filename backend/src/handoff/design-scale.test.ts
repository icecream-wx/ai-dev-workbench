/**
 * I-09b-1（U6）交接包规模识别 + 建议分阶段：纯函数单测
 *
 * 不读数据库、不启动 opencode、不调用模型。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assessHandoffScale,
  HANDOFF_SCALE_THRESHOLDS,
  handoffScaleKb,
  handoffScaleSummary,
  handoffScaleTriggerText
} from './design-scale'
import type {
  DesignHandoffBundle,
  DesignHandoffEntity,
  DesignHandoffPage,
  DesignHandoffPageSet
} from './design-types'

interface EpicSpec {
  id: string
  title: string
  goal?: string
  stories: Array<{ id: string; title: string }>
}

interface PageSpec {
  code: string
  title: string
  prototype?: boolean
}

interface PageSetSpec {
  code: string
  title: string
  description?: string
  epicId?: string | null
  storyIds?: string[]
  pages: PageSpec[]
}

interface BundleSpec {
  epics?: EpicSpec[]
  storyCount?: number
  pageSets?: PageSetSpec[]
  entities?: Array<{ fields: number; relations: number }>
}

function pageOf(spec: PageSpec, setCode: string): DesignHandoffPage {
  return {
    code: spec.code,
    id: `page-internal-${spec.code}`,
    title: spec.title,
    type: 'list',
    mode: null,
    entityCode: null,
    entityName: null,
    entityTable: null,
    requirementRefs: [],
    spec: {},
    layout: {},
    imagePath: null,
    htmlPath: null,
    imageHash: null,
    prototypePath: spec.prototype === false ? null : `prototypes/${setCode.toLowerCase()}/${spec.code.toLowerCase()}.png`,
    prototypeHtmlPath: null
  } as unknown as DesignHandoffPage
}

function pageSetOf(spec: PageSetSpec): DesignHandoffPageSet {
  return {
    code: spec.code,
    id: `ps-internal-${spec.code}`,
    title: spec.title,
    description: spec.description ?? '',
    epicId: spec.epicId ?? null,
    epicTitle: null,
    storyIds: [...(spec.storyIds ?? [])],
    storyTitles: [...(spec.storyIds ?? [])],
    entityCodes: [],
    pages: spec.pages.map(page => pageOf(page, spec.code))
  } as unknown as DesignHandoffPageSet
}

function makeBundle(spec: BundleSpec): DesignHandoffBundle {
  const epics = (spec.epics ?? []).map((epic, epicIndex) => ({
    id: epic.id,
    title: epic.title,
    goal: epic.goal ?? '',
    priority: 'P0',
    sceneId: null,
    position: epicIndex,
    stories: epic.stories.map((story, storyIndex) => ({
      id: story.id,
      epicId: epic.id,
      title: story.title,
      description: '',
      acceptance: [],
      priority: 'P0',
      position: storyIndex
    }))
  }))
  const stories = epics.length
    ? epics.flatMap(epic => epic.stories)
    : Array.from({ length: spec.storyCount ?? 0 }, (_value, index) => ({
        id: `STORY-${String(index + 1).padStart(3, '0')}`,
        epicId: null,
        title: `独立故事 ${index + 1}`,
        description: '',
        acceptance: [],
        priority: 'P0',
        position: index
      }))
  const pageSets = (spec.pageSets ?? []).map(pageSetOf)
  const entities = (spec.entities ?? []).map(
    (entity, index) =>
      ({
        code: `ENT-${String(index + 1).padStart(3, '0')}`,
        id: `entity-internal-${index + 1}`,
        name: `实体 ${index + 1}`,
        tableName: `t_entity_${index + 1}`,
        description: '',
        fields: Array.from({ length: entity.fields }, () => ({})),
        relations: Array.from({ length: entity.relations }, () => ({})),
        requirementRefs: []
      }) as unknown as DesignHandoffEntity
  )
  return {
    app: { id: 'scale-app', name: '规模测试应用', description: '', backendPort: 8081 },
    generatedAt: '2026-11-12T00:00:00.000Z',
    requirements: {
      version: 1,
      docHash: 'doc-hash',
      title: '需求文档',
      templateId: 'template',
      templateName: '标准 PRD',
      confirmedAt: '2026-11-12T00:00:00.000Z',
      contentMd: '# 需求',
      input: {
        id: 'input-1',
        appId: 'scale-app',
        docVersion: 1,
        docHash: 'doc-hash',
        templateId: 'template',
        templateName: '标准 PRD',
        confirmedAt: '2026-11-12T00:00:00.000Z',
        structure: 'prd',
        scenes: [],
        epics,
        stories,
        roles: [],
        dataRules: { sectionKey: 'rules', markdown: '' },
        pageRequirements: { sectionKey: 'pages', markdown: '' },
        nonFunctionals: { sectionKey: 'nfr', markdown: '' },
        openQuestions: [],
        glossary: [],
        warnings: [],
        createdAt: '2026-11-12T00:00:00.000Z'
      }
    },
    design: { version: 1, status: 'confirmed', confirmedAt: '2026-11-12T00:00:00.000Z' },
    entities,
    pageSets,
    template: {} as DesignHandoffBundle['template'],
    templateHash: 'template-hash',
    changeSet: {
      id: 'cs-1',
      seq: 1,
      title: '初始开发',
      description: '',
      scope: 'requirements',
      status: 'development',
      baselineHandoffVersion: null,
      currentHandoffVersion: 1,
      createdAt: '2026-11-12T00:00:00.000Z',
      updatedAt: '2026-11-12T00:00:00.000Z',
      completedAt: null
    },
    baselineHandoffVersion: null,
    version: 1,
    changeReport: null,
    warnings: [],
    coverage: {} as DesignHandoffBundle['coverage']
  }
}

const KB = 1024

test('阈值常量与边界：9/10 Story、11/12 页面、99KB/100KB', () => {
  assert.deepEqual(HANDOFF_SCALE_THRESHOLDS, { stories: 10, pages: 12, textBytes: 102400 })

  const small = makeBundle({
    storyCount: 9,
    pageSets: [{ code: 'PS-001', title: '客户', pages: Array.from({ length: 11 }, (_v, i) => ({ code: `PAGE-${i + 1}`, title: `页面 ${i + 1}` })) }]
  })
  const smallScale = assessHandoffScale(small, 99 * KB)
  assert.equal(smallScale.scale.level, 'normal')
  assert.equal(smallScale.scale.suggested, false)
  assert.deepEqual(smallScale.scale.triggers, [])
  assert.equal(smallScale.scale.phaseCount, 0)
  assert.equal(smallScale.scale.derivedFrom, 'none')
  assert.deepEqual(smallScale.phases, [])

  const stories10 = makeBundle({ storyCount: 10 })
  const storiesScale = assessHandoffScale(stories10, 1)
  assert.equal(storiesScale.scale.level, 'large')
  assert.deepEqual(storiesScale.scale.triggers, [{ metric: 'stories', value: 10, threshold: 10 }])

  const pages12 = makeBundle({
    pageSets: [{ code: 'PS-001', title: '客户', pages: Array.from({ length: 12 }, (_v, i) => ({ code: `PAGE-${i + 1}`, title: `页面 ${i + 1}` })) }]
  })
  const pagesScale = assessHandoffScale(pages12, 1)
  assert.equal(pagesScale.scale.level, 'large')
  assert.deepEqual(pagesScale.scale.triggers, [{ metric: 'pages', value: 12, threshold: 12 }])

  const bytes100 = assessHandoffScale(makeBundle({}), 102400)
  assert.equal(bytes100.scale.level, 'large')
  assert.deepEqual(bytes100.scale.triggers, [{ metric: 'textBytes', value: 102400, threshold: 102400 }])

  const bytes99 = assessHandoffScale(makeBundle({}), 102399)
  assert.equal(bytes99.scale.level, 'normal')
})

test('counts：实体字段/关系、页面/原型汇总正确', () => {
  const bundle = makeBundle({
    entities: [
      { fields: 5, relations: 1 },
      { fields: 3, relations: 2 }
    ],
    pageSets: [
      {
        code: 'PS-001',
        title: '客户',
        pages: [
          { code: 'PAGE-001', title: '列表', prototype: true },
          { code: 'PAGE-002', title: '表单', prototype: true }
        ]
      },
      { code: 'PS-002', title: '订单', pages: [{ code: 'PAGE-003', title: '列表', prototype: false }] }
    ]
  })
  const { scale } = assessHandoffScale(bundle, 4096)
  assert.deepEqual(scale.counts, {
    scenes: 0,
    epics: 0,
    stories: 0,
    entities: 2,
    fields: 8,
    relations: 3,
    pageSets: 2,
    pages: 3,
    prototypes: 2
  })
  assert.equal(scale.textBytes, 4096)
  assert.equal(handoffScaleKb(4096), 4)
})

test('派生：base + 每个 Epic 一阶段 + 未归属页面集“其他页面与收尾”', () => {
  const bundle = makeBundle({
    epics: [
      {
        id: 'EPIC-001',
        title: '客户管理',
        goal: '维护客户信息',
        stories: [
          { id: 'STORY-001', title: '创建客户' },
          { id: 'STORY-002', title: '查询客户' }
        ]
      },
      {
        id: 'EPIC-002',
        title: '订单管理',
        stories: [{ id: 'STORY-003', title: '创建订单' }]
      }
    ],
    pageSets: [
      {
        code: 'PS-001',
        title: '客户',
        epicId: 'EPIC-001',
        storyIds: ['STORY-001', 'STORY-002'],
        pages: [{ code: 'PAGE-001', title: '客户列表' }]
      },
      {
        code: 'PS-002',
        title: '报表',
        epicId: null,
        storyIds: ['STORY-002'],
        pages: [{ code: 'PAGE-002', title: '报表页' }]
      }
    ]
  })
  const { scale, phases } = assessHandoffScale(bundle, 200 * KB)
  assert.equal(scale.level, 'large')
  assert.equal(scale.derivedFrom, 'epics')
  assert.equal(scale.phaseCount, 4)
  assert.deepEqual(
    phases.map(phase => phase.kind),
    ['base', 'epic', 'epic', 'other']
  )
  // U7-1：稳定 key（manifest.phases / 阶段按需生成使用；04-PLAN 不渲染 key）
  assert.deepEqual(
    phases.map(phase => phase.key),
    ['base', 'epic:EPIC-001', 'epic:EPIC-002', 'other']
  )
  assert.equal(phases[0].title, '数据模型与基础框架')
  assert.deepEqual(phases[0].storyIds, [])
  assert.equal(phases[1].title, 'EPIC-001 客户管理')
  assert.equal(phases[1].goal, '维护客户信息')
  assert.deepEqual(phases[1].storyIds, ['STORY-001', 'STORY-002'])
  assert.deepEqual(phases[1].pageSetCodes, ['PS-001'])
  assert.deepEqual(phases[1].pageCodes, ['PAGE-001'])
  assert.equal(phases[1].note, undefined)
  assert.equal(phases[2].title, 'EPIC-002 订单管理')
  assert.equal(phases[2].note, '无页面集；按 Story 实现接口/后端能力')
  assert.deepEqual(phases[2].pageSetCodes, [])
  assert.equal(phases[3].title, '其他页面与收尾')
  assert.deepEqual(phases[3].pageSetCodes, ['PS-002'])
  assert.deepEqual(phases[3].storyIds, ['STORY-002'])
})

test('派生：无 Epic 时按页面集顺序每 3 个一组；单个不加“等 N 个”', () => {
  const bundle = makeBundle({
    pageSets: [
      { code: 'PS-001', title: '客户', storyIds: ['STORY-001'], pages: [{ code: 'PAGE-001', title: '客户列表' }] },
      { code: 'PS-002', title: '订单', storyIds: ['STORY-001', 'STORY-002'], pages: [{ code: 'PAGE-002', title: '订单列表' }] },
      { code: 'PS-003', title: '商品', pages: [{ code: 'PAGE-003', title: '商品列表' }] },
      { code: 'PS-004', title: '报表', pages: [{ code: 'PAGE-004', title: '报表页' }] }
    ]
  })
  const { scale, phases } = assessHandoffScale(bundle, 200 * KB)
  assert.equal(scale.derivedFrom, 'pageSets')
  assert.equal(scale.phaseCount, 3)
  assert.deepEqual(
    phases.map(phase => phase.kind),
    ['base', 'pageSets', 'pageSets']
  )
  assert.deepEqual(
    phases.map(phase => phase.key),
    ['base', 'pageSets:PS-001', 'pageSets:PS-004']
  )
  assert.equal(phases[1].title, 'PS-001 客户等 3 个页面集')
  assert.deepEqual(phases[1].pageSetCodes, ['PS-001', 'PS-002', 'PS-003'])
  assert.deepEqual(phases[1].pageCodes, ['PAGE-001', 'PAGE-002', 'PAGE-003'])
  assert.deepEqual(phases[1].storyIds, ['STORY-001', 'STORY-002'])
  assert.equal(phases[2].title, 'PS-004 报表')
  assert.deepEqual(phases[2].pageSetCodes, ['PS-004'])
})

test('派生：无 Epic 且无页面集时只给“全量实现”', () => {
  const bundle = makeBundle({
    storyCount: 12
  })
  const { scale, phases } = assessHandoffScale(bundle, 1)
  assert.equal(scale.derivedFrom, 'none')
  assert.equal(scale.phaseCount, 2)
  assert.deepEqual(
    phases.map(phase => phase.kind),
    ['base', 'all']
  )
  assert.deepEqual(
    phases.map(phase => phase.key),
    ['base', 'all']
  )
  assert.equal(phases[1].title, '全量实现')
  assert.equal(phases[1].storyIds.length, 12)
  assert.deepEqual(phases[1].pageSetCodes, [])
})

test('确定性：同一 bundle 两次结果 deepEqual，且不泄露内部 ID', () => {
  const bundle = makeBundle({
    epics: [
      {
        id: 'EPIC-001',
        title: '客户管理',
        stories: [{ id: 'STORY-001', title: '创建客户' }]
      }
    ],
    pageSets: [
      {
        code: 'PS-001',
        title: '客户',
        epicId: 'EPIC-001',
        storyIds: ['STORY-001'],
        pages: [
          { code: 'PAGE-001', title: '列表' },
          { code: 'PAGE-002', title: '详情' }
        ]
      }
    ],
    entities: [{ fields: 2, relations: 0 }]
  })
  assert.deepEqual(assessHandoffScale(bundle, 120 * KB), assessHandoffScale(bundle, 120 * KB))

  const { phases } = assessHandoffScale(bundle, 120 * KB)
  const serialized = JSON.stringify(phases)
  for (const internal of ['ps-internal-', 'page-internal-', 'entity-internal-']) {
    assert.ok(!serialized.includes(internal), `阶段草案泄露内部 ID：${internal}`)
  }
  // 阶段标题只用稳定编号
  assert.equal(phases[1].title, 'EPIC-001 客户管理')
  assert.match(phases[1].pageCodes.join(','), /^PAGE-00\d/)
})

test('标签辅助：规模摘要 / 命中项 / KB 向上取整', () => {
  const bundle = makeBundle({
    epics: [
      {
        id: 'EPIC-001',
        title: '客户管理',
        stories: Array.from({ length: 10 }, (_v, i) => ({ id: `STORY-${String(i + 1).padStart(3, '0')}`, title: `故事 ${i + 1}` }))
      }
    ],
    pageSets: [
      {
        code: 'PS-001',
        title: '客户',
        epicId: 'EPIC-001',
        pages: Array.from({ length: 12 }, (_v, i) => ({ code: `PAGE-${String(i + 1).padStart(3, '0')}`, title: `页面 ${i + 1}` }))
      }
    ]
  })
  const { scale } = assessHandoffScale(bundle, 123 * KB + 1)
  assert.equal(handoffScaleKb(123 * KB + 1), 124)
  assert.equal(handoffScaleSummary(scale), '10 Story / 12 页面 / 124 KB')
  assert.equal(handoffScaleTriggerText(scale), 'Story ≥ 10、页面 ≥ 12、文本 ≥ 100 KB')
})
