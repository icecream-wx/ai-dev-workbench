import assert from 'node:assert/strict'
import test from 'node:test'
import {
  executablePhases,
  groupPhasesByModule,
  moduleLabel,
  moduleName,
  moduleStatusOf,
  phaseActionState,
  phaseChipLabel,
  phaseCompletionHint,
  phaseGenerateConfirmText,
  phaseOrderLabel,
  phaseProgress,
  phaseRefLabel,
  phaseScopeDetail,
  phaseScopeLabel,
  phaseStartConfirmText,
  phaseStatusClass,
  phaseStatusLabel,
  phaseSummarySourceLabel
} from './phase-labels.js'

const phase = (overrides = {}) => ({
  id: 'ph-1',
  key: 'base',
  title: '数据模型与基础框架',
  order: 1,
  status: 'not_started',
  handoffVersion: 1,
  ...overrides
})

test('状态标签/class 全映射 + 未知值', () => {
  assert.deepEqual(
    ['not_started', 'in_progress', 'completed', 'skipped'].map(phaseStatusLabel),
    ['未开始', '进行中', '已完成', '已跳过']
  )
  assert.deepEqual(
    ['not_started', 'in_progress', 'completed', 'skipped'].map(phaseStatusClass),
    ['not-started', 'in-progress', 'completed', 'skipped']
  )
  assert.equal(phaseStatusLabel('archived'), '未知状态')
  assert.equal(phaseStatusClass(undefined), 'unknown')
  assert.equal(phaseStatusClass('archived'), 'unknown')
})

test('phaseOrderLabel：合法/非法', () => {
  assert.equal(phaseOrderLabel(2, 6), '阶段 2/6')
  assert.equal(phaseOrderLabel(1, 1), '阶段 1/1')
  assert.equal(phaseOrderLabel(2, undefined), '阶段 2')
  assert.equal(phaseOrderLabel(0, 6), '阶段 —')
  assert.equal(phaseOrderLabel(-1, 6), '阶段 —')
  assert.equal(phaseOrderLabel(Number.NaN, 6), '阶段 —')
  assert.equal(phaseOrderLabel(null, 6), '阶段 —')
  assert.equal(phaseOrderLabel(undefined, 6), '阶段 —')
  assert.equal(phaseOrderLabel(1.5, 6), '阶段 —')
})

test('phaseRefLabel / phaseChipLabel：有/无阶段、short、模块前缀', () => {
  assert.equal(phaseRefLabel(phase()), '阶段 1 · 数据模型与基础框架')
  assert.equal(phaseRefLabel(phase(), { short: true }), '阶段 1')
  assert.equal(phaseRefLabel(phase({ moduleKey: 'MOD-001' })), 'MOD-001 · 阶段 1 · 数据模型与基础框架')
  assert.equal(phaseRefLabel(phase({ moduleKey: 'MOD-001' }), { short: true }), 'MOD-001 · 阶段 1')
  assert.equal(phaseRefLabel(null), '')
  assert.equal(phaseRefLabel(undefined), '')
  assert.equal(phaseRefLabel({ order: 0, title: 'x' }), '')

  const session = { phaseOrder: 3, phaseTitle: 'EPIC-002 订单管理' }
  assert.equal(phaseChipLabel(session), '阶段 3 · EPIC-002 订单管理')
  assert.equal(phaseChipLabel(session, { short: true }), '阶段 3')
  assert.equal(phaseChipLabel({ ...session, phaseModuleKey: 'MOD-002' }), 'MOD-002 · 阶段 3 · EPIC-002 订单管理')
  assert.equal(phaseChipLabel({ phaseOrder: null, phaseTitle: null }), '')
  assert.equal(phaseChipLabel({}), '')
  assert.equal(phaseChipLabel({ phaseOrder: 2 }), '阶段 2')
})

test('phaseScopeLabel / phaseScopeDetail：全空、仅 Story、三类齐全、note 不丢', () => {
  const empty = { kind: 'base', storyIds: [], pageSetCodes: [], pageCodes: [] }
  assert.equal(phaseScopeLabel(empty), '按 04-PLAN.md 阶段章节')
  assert.equal(phaseScopeDetail(empty), '按 04-PLAN.md 阶段章节')
  assert.equal(phaseScopeLabel(null), '按 04-PLAN.md 阶段章节')

  const storyOnly = { kind: 'epic', storyIds: ['STORY-001'], pageSetCodes: [], pageCodes: [] }
  assert.equal(phaseScopeLabel(storyOnly), 'Story 1')

  const full = {
    kind: 'epic',
    storyIds: ['STORY-001', 'STORY-002', 'STORY-003'],
    pageSetCodes: ['PS-001', 'PS-002'],
    pageCodes: ['PAGE-001', 'PAGE-002', 'PAGE-003', 'PAGE-004', 'PAGE-005']
  }
  assert.equal(phaseScopeLabel(full), 'Story 3 · 页面集 2 · 页面 5')
  assert.equal(
    phaseScopeDetail(full),
    'Story STORY-001、STORY-002、STORY-003；页面集 PS-001、PS-002；页面 PAGE-001、PAGE-002、PAGE-003、PAGE-004、PAGE-005'
  )
  const withNote = { ...storyOnly, note: '依赖基础阶段的数据模型' }
  assert.match(phaseScopeDetail(withNote), /说明：依赖基础阶段的数据模型$/)
})

test('phaseProgress / phaseCompletionHint：空、部分、全完成、含跳过', () => {
  assert.deepEqual(phaseProgress([]), { total: 0, completed: 0, skipped: 0, done: 0 })
  assert.deepEqual(phaseProgress(null), { total: 0, completed: 0, skipped: 0, done: 0 })
  assert.deepEqual(phaseProgress([null, 'x']), { total: 0, completed: 0, skipped: 0, done: 0 })

  const partial = [phase({ status: 'completed' }), phase({ id: 'ph-2', status: 'in_progress' }), phase({ id: 'ph-3' })]
  assert.deepEqual(phaseProgress(partial), { total: 3, completed: 1, skipped: 0, done: 1 })
  assert.equal(phaseCompletionHint(partial), '')

  const allCompleted = [phase({ status: 'completed' }), phase({ id: 'ph-2', status: 'completed' })]
  assert.equal(phaseCompletionHint(allCompleted), '全部阶段已完成，可确认完成开发（不会自动完成）。')

  const withSkipped = [phase({ status: 'completed' }), phase({ id: 'ph-2', status: 'skipped' })]
  assert.deepEqual(phaseProgress(withSkipped), { total: 2, completed: 1, skipped: 1, done: 2 })
  assert.equal(phaseCompletionHint(withSkipped), '阶段均已处理（含跳过），可确认完成开发。')
  assert.equal(phaseCompletionHint([]), '')
})

test('phaseGenerateConfirmText：阶段数、模块里程碑、不门禁、单会话、不自动发送', () => {
  const label = phaseGenerateConfirmText(4)
  assert.match(label, /4 个可执行开发阶段/)
  assert.match(label, /不设门禁/)
  assert.match(label, /单会话/)
  assert.match(label, /不会自动发送/)
  assert.match(label, /不会被自动完成/)
  assert.doesNotMatch(label, /\d+ 个模块里程碑/)
  assert.match(phaseGenerateConfirmText(4, 2), /2 个模块里程碑/)
  assert.match(phaseGenerateConfirmText(0), /0 个可执行开发阶段/)
  assert.match(phaseGenerateConfirmText(null), /0 个可执行开发阶段/)
})

test('phaseActionState：只读/历史/四种状态矩阵', () => {
  assert.deepEqual(phaseActionState(null, 1, false), {
    canStart: false,
    canComplete: false,
    canSkip: false,
    canReopen: false,
    reason: '会话只读'
  })
  assert.equal(phaseActionState(phase(), 1, true).reason, '会话只读')
  assert.equal(phaseActionState(phase(), 1, true).canStart, false)

  const historical = phaseActionState(phase({ handoffVersion: 1 }), 2, false)
  assert.deepEqual(historical, {
    canStart: false,
    canComplete: false,
    canSkip: false,
    canReopen: false,
    reason: '历史交接包阶段只读'
  })

  const notStarted = phaseActionState(phase(), 1, false)
  assert.deepEqual(notStarted, { canStart: true, canComplete: true, canSkip: true, canReopen: false, reason: '' })

  const inProgress = phaseActionState(phase({ status: 'in_progress' }), 1, false)
  assert.deepEqual(inProgress, { canStart: true, canComplete: true, canSkip: true, canReopen: false, reason: '' })

  const completed = phaseActionState(phase({ status: 'completed' }), 1, false)
  assert.deepEqual(completed, { canStart: false, canComplete: false, canSkip: false, canReopen: true, reason: '' })

  const skipped = phaseActionState(phase({ status: 'skipped' }), 1, false)
  assert.deepEqual(skipped, { canStart: true, canComplete: false, canSkip: false, canReopen: true, reason: '' })
})

test('phaseStartConfirmText：无会话/有 active/运行中', () => {
  const idle = phaseStartConfirmText(phase({ order: 2, title: 'EPIC-001 客户管理' }), 4, { hasActiveSession: false })
  assert.match(idle, /阶段 2\/4「EPIC-001 客户管理」/)
  assert.doesNotMatch(idle, /当前会话会归档/)
  assert.doesNotMatch(idle, /会先请求停止/)
  assert.match(idle, /不会自动发送/)

  const active = phaseStartConfirmText(phase({ order: 2 }), 4, { hasActiveSession: true })
  assert.match(active, /当前会话会归档/)
  assert.doesNotMatch(active, /会先请求停止/)

  const running = phaseStartConfirmText(phase({ order: 2 }), 4, { hasActiveSession: true, running: true })
  assert.match(running, /^Agent 正在执行，会先请求停止当前会话。/)
  assert.match(running, /当前会话会归档/)
})

test('M6b 模块阶段：不可操作、进度不计入、分组/状态汇总/折叠顺序', () => {
  const moduleA = phase({
    id: 'm-a',
    key: 'module:MOD-001',
    kind: 'module',
    moduleKey: 'MOD-001',
    title: 'MOD-001 商品管理',
    order: 1,
    status: 'not_started'
  })
  const childA1 = phase({
    id: 'a-1',
    key: 'epic:EPIC-001',
    kind: 'epic',
    moduleKey: 'MOD-001',
    parentKey: 'MOD-001',
    title: 'EPIC-001 商品',
    order: 2,
    status: 'completed'
  })
  const childA2 = phase({
    id: 'a-2',
    key: 'epic:EPIC-002',
    kind: 'epic',
    moduleKey: 'MOD-001',
    parentKey: 'MOD-001',
    title: 'EPIC-002 库存',
    order: 3,
    status: 'in_progress'
  })
  const base = phase({ id: 'base-ph', order: 1, status: 'completed' })
  const moduleB = phase({
    id: 'm-b',
    key: 'module:MOD-002',
    kind: 'module',
    moduleKey: 'MOD-002',
    title: 'MOD-002 订单管理',
    order: 2
  })
  const childB1 = phase({
    id: 'b-1',
    key: 'epic:EPIC-003',
    kind: 'epic',
    moduleKey: 'MOD-002',
    parentKey: 'MOD-002',
    title: 'EPIC-003 订单',
    order: 4,
    status: 'skipped'
  })
  const all = [base, moduleA, childA1, childA2, moduleB, childB1]

  const action = phaseActionState(moduleA, 1, false)
  assert.equal(action.canStart, false)
  assert.equal(action.canComplete, false)
  assert.match(action.reason, /模块阶段只作分组/)
  assert.equal(phaseActionState(childA1, 1, false).canReopen, true)

  assert.deepEqual(phaseProgress(all), { total: 4, completed: 2, skipped: 1, done: 3 })
  assert.equal(executablePhases(all).length, 4)
  assert.equal(phaseCompletionHint(all), '')

  const grouped = groupPhasesByModule(all)
  assert.equal(grouped.modules.length, 2)
  assert.deepEqual(grouped.groups.map(group => group.kind), ['phase', 'module', 'module'])
  assert.deepEqual(grouped.groups[1].phases.map(item => item.id), ['a-1', 'a-2'])
  assert.deepEqual(grouped.groups[2].phases.map(item => item.id), ['b-1'])

  assert.equal(moduleStatusOf(grouped.groups[1].phases), 'in_progress')
  assert.equal(moduleStatusOf(grouped.groups[2].phases), 'skipped')
  assert.equal(moduleStatusOf([]), 'not_started')
  assert.equal(moduleStatusOf([{ status: 'completed' }, { status: 'not_started' }, { status: 'not_started' }]), 'in_progress')
  assert.equal(moduleStatusOf([{ status: 'skipped' }, { status: 'not_started' }]), 'in_progress')
  assert.equal(moduleStatusOf([{ status: 'completed' }, { status: 'skipped' }]), 'completed')
  assert.equal(moduleStatusOf([{ status: 'skipped' }, { status: 'skipped' }]), 'skipped')
  assert.equal(moduleStatusOf([{ status: 'not_started' }, { status: 'not_started' }]), 'not_started')
  assert.equal(moduleLabel(moduleA), 'MOD-001 商品管理')
  assert.equal(moduleLabel({ key: 'module:MOD-001', moduleKey: 'MOD-001', title: '商品管理' }), 'MOD-001 商品管理')
  assert.equal(moduleName(moduleA), '商品管理')
  assert.equal(moduleName({ moduleKey: 'MOD-001', title: '商品管理' }), '商品管理')

  // 单模块旧数据（无 module kind）保持平铺
  const flat = groupPhasesByModule([base, childA1, childA2])
  assert.equal(flat.modules.length, 0)
  assert.ok(flat.groups.every(group => group.kind === 'phase'))
})

test('phaseSummarySourceLabel：模型/回退/无摘要', () => {
  assert.equal(phaseSummarySourceLabel('model'), '模型生成')
  assert.equal(phaseSummarySourceLabel('fallback'), '回退（最后一条回复）')
  assert.equal(phaseSummarySourceLabel('none'), '无摘要')
  assert.equal(phaseSummarySourceLabel(null), '无摘要')
  assert.equal(phaseSummarySourceLabel('other'), '无摘要')
})
