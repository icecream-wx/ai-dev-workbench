import assert from 'node:assert/strict'
import test from 'node:test'
import {
  activeModulesOf,
  activeSectionFromTops,
  canApplyTemplatePreview,
  createModuleGate,
  hasDivergentTemplates,
  moduleOutlineRow,
  moduleOutlineTooltip,
  moduleStatusClass,
  moduleStatusLabel,
  moduleStorageKey,
  moduleVersionLabel,
  moveModuleIds,
  nextModuleAfterArchive,
  outlineCompletion,
  progressOf,
  readStoredModuleId,
  resolveInitialModule,
  resolveSectionTarget,
  scrollAtBottom,
  shortHash,
  writeStoredModuleId
} from './module-helpers.js'

const MODULES = [
  { id: 'm1', moduleKey: 'MOD-001', title: '订单管理', required: true, archived: false, position: 0, docStatus: 'confirmed', docVersion: 3 },
  { id: 'm2', moduleKey: 'MOD-002', title: '库存管理', required: true, archived: false, position: 1, docStatus: 'draft', docVersion: 1 },
  { id: 'm3', moduleKey: 'MOD-003', title: '报表', required: false, archived: false, position: 2, docStatus: 'draft', docVersion: 2 },
  { id: 'm4', moduleKey: 'MOD-004', title: '历史模块', required: true, archived: true, position: 3, docStatus: 'confirmed', docVersion: 9 }
]

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key)
  }
}

test('moduleStorageKey / read / write：按应用隔离，异常存储静默忽略', () => {
  assert.equal(moduleStorageKey('app1'), 'workbench:app:app1:requirementsModuleId')
  const storage = memoryStorage()
  assert.equal(readStoredModuleId(storage, 'app1'), '')
  writeStoredModuleId(storage, 'app1', 'm2')
  assert.equal(readStoredModuleId(storage, 'app1'), 'm2')
  assert.equal(readStoredModuleId(storage, 'app2'), '')
  writeStoredModuleId(storage, 'app1', '')
  assert.equal(readStoredModuleId(storage, 'app1'), '')

  const broken = {
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('blocked')
    },
    removeItem: () => {
      throw new Error('blocked')
    }
  }
  assert.equal(readStoredModuleId(broken, 'app1'), '')
  assert.doesNotThrow(() => writeStoredModuleId(broken, 'app1', 'm1'))
})

test('resolveInitialModule：stored 优先；失效/归档回退默认并给出原因', () => {
  assert.deepEqual(resolveInitialModule(MODULES, { storedId: 'm3', defaultModuleId: 'm1' }), { moduleId: 'm3', reason: '' })
  assert.deepEqual(resolveInitialModule(MODULES, { storedId: 'missing', defaultModuleId: 'm2' }), {
    moduleId: 'm2',
    reason: 'stored-missing'
  })
  assert.deepEqual(resolveInitialModule(MODULES, { storedId: 'm4', defaultModuleId: 'm1' }), {
    moduleId: 'm1',
    reason: 'stored-archived'
  })
  // 默认模块失效时回退第一个未归档
  assert.deepEqual(resolveInitialModule(MODULES, { storedId: '', defaultModuleId: 'missing' }), { moduleId: 'm1', reason: '' })
  assert.deepEqual(resolveInitialModule(MODULES, {}), { moduleId: 'm1', reason: '' })
  assert.deepEqual(resolveInitialModule([], { defaultModuleId: 'm1' }), { moduleId: null, reason: 'none' })
  assert.deepEqual(resolveInitialModule([MODULES[3]], {}), { moduleId: null, reason: 'none' })
})

test('progressOf：只统计未归档；必选未确认 → pending；全确认才 allRequiredConfirmed', () => {
  const progress = progressOf(MODULES)
  assert.equal(progress.total, 3)
  assert.equal(progress.archived, 1)
  assert.equal(progress.confirmed, 1)
  assert.equal(progress.requiredTotal, 2)
  assert.equal(progress.requiredConfirmed, 1)
  assert.equal(progress.allRequiredConfirmed, false)
  assert.deepEqual(
    progress.pending.map(item => item.moduleId),
    ['m2']
  )

  const allConfirmed = MODULES.map(module => (module.archived ? module : { ...module, docStatus: 'confirmed' }))
  assert.equal(progressOf(allConfirmed).allRequiredConfirmed, true)
  assert.deepEqual(progressOf([]).pending, [])
  assert.equal(progressOf([]).allRequiredConfirmed, false, '没有模块时不能“完成需求阶段”')
  // 可选模块未确认不影响完成
  const onlyOptionalPending = MODULES.map(module => (module.id === 'm2' ? { ...module, docStatus: 'confirmed' } : module))
  assert.equal(progressOf(onlyOptionalPending).allRequiredConfirmed, true)
})

test('moveModuleIds：上移/下移换位；越界/id 不存在返回 null', () => {
  assert.deepEqual(moveModuleIds(['a', 'b', 'c'], 'b', -1), ['b', 'a', 'c'])
  assert.deepEqual(moveModuleIds(['a', 'b', 'c'], 'b', 1), ['a', 'c', 'b'])
  assert.equal(moveModuleIds(['a', 'b', 'c'], 'a', -1), null)
  assert.equal(moveModuleIds(['a', 'b', 'c'], 'c', 1), null)
  assert.equal(moveModuleIds(['a', 'b', 'c'], 'missing', 1), null)
  assert.deepEqual(moveModuleIds(['a'], 'a', 1), null)
})

test('nextModuleAfterArchive：归档当前模块后回退到下一个未归档模块', () => {
  assert.equal(nextModuleAfterArchive(MODULES, 'm4', 'm4'), 'm1')
  assert.equal(nextModuleAfterArchive(MODULES, 'm2', 'm1'), 'm1', '归档非当前模块时保持当前选择')
  assert.equal(nextModuleAfterArchive(MODULES, 'm1', 'm1'), 'm2')
  assert.equal(nextModuleAfterArchive([MODULES[0]], 'm1', 'm1'), null)
})

test('createModuleGate：只在需求阶段允许新增，设计与开发给出对应路径', () => {
  assert.deepEqual(createModuleGate('requirements'), { allowed: true, hint: '' })
  assert.match(createModuleGate('design').hint, /重新编辑需求/)
  assert.equal(createModuleGate('design').allowed, false)
  assert.match(createModuleGate('development').hint, /需求\+设计/)
  assert.equal(createModuleGate('development').allowed, false)
  assert.match(createModuleGate('completed').hint, /变更/)
})

test('canApplyTemplatePreview：canApply + 有模块 + 无阻塞模块', () => {
  assert.equal(canApplyTemplatePreview({ canApply: true, modules: [{ moduleId: 'm1' }], blockedModules: [] }), true)
  assert.equal(canApplyTemplatePreview({ canApply: true, modules: [], blockedModules: [] }), false)
  assert.equal(canApplyTemplatePreview({ canApply: false, modules: [{ moduleId: 'm1' }], blockedModules: [] }), false)
  assert.equal(
    canApplyTemplatePreview({ canApply: false, modules: [{ moduleId: 'm1' }], blockedModules: [{ moduleId: 'm2' }] }),
    false
  )
  assert.equal(canApplyTemplatePreview(null), false)
})

test('hasDivergentTemplates：同模板不重复应用；模块 B 单独切模板时可对齐', () => {
  const same = [
    { id: 'a', archived: false, templateId: 'builtin-prd' },
    { id: 'b', archived: false, templateId: 'builtin-prd' }
  ]
  assert.equal(hasDivergentTemplates(same, 'builtin-prd'), false)
  assert.equal(hasDivergentTemplates([], 'builtin-prd'), false)
  // 归档模块/无文档模块不参与
  assert.equal(hasDivergentTemplates([...same, { id: 'c', archived: true, templateId: 'builtin-prd-lite' }], 'builtin-prd'), false)
  assert.equal(hasDivergentTemplates([...same, { id: 'd', archived: false, templateId: null }], 'builtin-prd'), false)
  // 未归档模块模板不一致 → true
  assert.equal(
    hasDivergentTemplates(
      [
        { id: 'a', archived: false, templateId: 'builtin-prd' },
        { id: 'b', archived: false, templateId: 'builtin-prd-lite' }
      ],
      'builtin-prd'
    ),
    true
  )
  // 当前模板缺失（payload 未加载）时，任何有模板的模块都算不一致
  assert.equal(hasDivergentTemplates(same, ''), true)
})

test('shortHash / moduleStatusLabel / moduleVersionLabel / activeModulesOf', () => {
  assert.equal(shortHash('aafe2ee81358bedd'), 'aafe2ee8')
  assert.equal(shortHash('abc'), 'abc')
  assert.equal(shortHash(''), '—')
  assert.equal(shortHash(null), '—')
  assert.equal(moduleStatusLabel(MODULES[0]), '已确认')
  assert.equal(moduleStatusLabel(MODULES[1]), '草稿')
  assert.equal(moduleStatusLabel(MODULES[3]), '已归档')
  assert.equal(moduleStatusLabel(null), '—')
  assert.equal(moduleVersionLabel(MODULES[2]), 'v2')
  assert.equal(moduleVersionLabel({ docVersion: null }), '—')
  assert.equal(activeModulesOf(MODULES).length, 3)
})

test('moduleStatusClass：与状态标签一致（归档优先）', () => {
  assert.equal(moduleStatusClass(MODULES[0]), 'confirmed')
  assert.equal(moduleStatusClass(MODULES[1]), 'draft')
  assert.equal(moduleStatusClass({ docStatus: 'review' }), 'review')
  assert.equal(moduleStatusClass(MODULES[3]), 'archived')
  assert.equal(moduleStatusClass(null), 'draft')
})

test('moduleOutlineRow：必选/本次变更 chips、状态、版本、负责人、当前标记', () => {
  const row = moduleOutlineRow(
    { ...MODULES[0], ownerLabel: '张三' },
    { current: true, inChangeScope: true }
  )
  assert.deepEqual(row, {
    statusLabel: '已确认',
    statusClass: 'confirmed',
    versionLabel: 'v3',
    ownerLabel: '张三',
    chips: ['必选', '本次变更'],
    current: true
  })
  const optional = moduleOutlineRow({ ...MODULES[2], ownerLabel: null })
  assert.deepEqual(optional.chips, [])
  assert.equal(optional.ownerLabel, '')
  assert.equal(optional.current, false)
  assert.deepEqual(moduleOutlineRow(null).chips, [])
})

test('moduleOutlineTooltip：标题 + 可选描述；无描述时不追加分隔符', () => {
  assert.equal(moduleOutlineTooltip({ moduleKey: 'MOD-001', title: '订单管理' }), 'MOD-001 订单管理')
  assert.equal(
    moduleOutlineTooltip({ moduleKey: 'MOD-001', title: '订单管理', description: ' 订单全流程  ' }),
    'MOD-001 订单管理 · 订单全流程'
  )
  assert.equal(moduleOutlineTooltip({ moduleKey: 'MOD-002' }), 'MOD-002')
  assert.equal(moduleOutlineTooltip(null), '')
})

test('outlineCompletion：只统计必填，空白 Markdown 不算完成', () => {
  const sections = [
    { sectionKey: 'a', required: true, markdown: '内容' },
    { sectionKey: 'b', required: true, markdown: '   \n  ' },
    { sectionKey: 'c', required: false, markdown: '可选内容' },
    { sectionKey: 'd', required: true, markdown: '' }
  ]
  assert.deepEqual(outlineCompletion(sections), { required: 3, completed: 1 })
  assert.deepEqual(outlineCompletion([]), { required: 0, completed: 0 })
  assert.deepEqual(outlineCompletion(null), { required: 0, completed: 0 })
})

test('activeSectionFromTops：空/全部在阈值下/之间/末尾/atBottom/对象 key', () => {
  assert.equal(activeSectionFromTops([]), '')
  // 全部在阈值下（还没滚到任何章节）→ 第一节
  assert.equal(activeSectionFromTops([100, 300, 500]), 0)
  // 滚动到第二、三节之间 → 第二节（index 1）
  assert.equal(activeSectionFromTops([-600, -200, 40, 600]), 1)
  // 正好等于阈值也算进入该节
  assert.equal(activeSectionFromTops([-100, 24, 400]), 1)
  // 末尾：最后一节已过阈值
  assert.equal(activeSectionFromTops([-1000, -500, -40]), 2)
  // 滚到底强制最后一节（即使顶部还没到阈值）
  assert.equal(activeSectionFromTops([-1000, -500, 800], { atBottom: true }), 2)
  // 对象形式返回 key；自定义 offset
  const items = [
    { key: 'a', top: -40 },
    { key: 'b', top: 60 },
    { key: 'c', top: 500 }
  ]
  assert.equal(activeSectionFromTops(items), 'a')
  assert.equal(activeSectionFromTops(items, { offset: 80 }), 'b')
  assert.equal(activeSectionFromTops(items, { atBottom: true }), 'c')
  // 非法 top 被忽略
  assert.equal(activeSectionFromTops([{ key: 'a', top: Number.NaN }, { key: 'b', top: 10 }]), 'b')
})

test('resolveSectionTarget：优先目标；缺失回退第一节并标记 fallback；空列表返回空 key', () => {
  assert.deepEqual(resolveSectionTarget(['a', 'b', 'c'], 'b'), { key: 'b', fallback: false })
  assert.deepEqual(resolveSectionTarget(['a', 'b'], 'gone'), { key: 'a', fallback: true })
  assert.deepEqual(resolveSectionTarget(['a', 'b'], ''), { key: 'a', fallback: false })
  assert.deepEqual(resolveSectionTarget([], 'a'), { key: '', fallback: false })
  assert.deepEqual(resolveSectionTarget(null, 'a'), { key: '', fallback: false })
})

test('scrollAtBottom：不可滚动恒 false；到底/接近底部 true；中间 false；阈值边界', () => {
  // 短文档：内容不足一屏（含刚好等于阈值内）→ 不能算到底
  assert.equal(scrollAtBottom({ scrollTop: 0, clientHeight: 800, scrollHeight: 500 }), false)
  assert.equal(scrollAtBottom({ scrollTop: 0, clientHeight: 800, scrollHeight: 800 }), false)
  assert.equal(scrollAtBottom({ scrollTop: 0, clientHeight: 800, scrollHeight: 804 }), false, '不足 4px 可滚动不判断为到底')
  // 可滚动：中间 false
  assert.equal(scrollAtBottom({ scrollTop: 0, clientHeight: 400, scrollHeight: 1000 }), false)
  assert.equal(scrollAtBottom({ scrollTop: 300, clientHeight: 400, scrollHeight: 1000 }), false)
  // 到底 / 距底 <= 4px 为 true
  assert.equal(scrollAtBottom({ scrollTop: 600, clientHeight: 400, scrollHeight: 1000 }), true)
  assert.equal(scrollAtBottom({ scrollTop: 596, clientHeight: 400, scrollHeight: 1000 }), true)
  // 阈值边界：595 差 5px → false；596 差 4px → true
  assert.equal(scrollAtBottom({ scrollTop: 595, clientHeight: 400, scrollHeight: 1000 }), false)
  assert.equal(scrollAtBottom({ scrollTop: 595, clientHeight: 400, scrollHeight: 1000 }, 5), true)
  assert.equal(scrollAtBottom({ scrollTop: 0, clientHeight: 800, scrollHeight: 804 }, 5), false)
  // 非法输入
  assert.equal(scrollAtBottom(null), false)
  assert.equal(scrollAtBottom({}), false)
})
