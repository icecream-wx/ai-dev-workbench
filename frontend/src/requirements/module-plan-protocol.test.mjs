import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_PLAN_MODULES,
  MODULE_PLAN_DELIMITER,
  normalizeModulePlan,
  splitModulePlanOutput,
  validateModulePlan
} from './module-plan-protocol.js'

const PLAN = {
  kind: 'initial',
  modules: [
    {
      key: 'product',
      title: '商品管理',
      description: '商品与明细',
      scope: ['商品档案', '商品明细'],
      suggestedEpics: [{ title: '商品档案', stories: ['商品列表', '新增商品'] }],
      existingModuleId: null,
      action: 'create'
    },
    {
      key: 'order',
      title: '订单管理',
      description: '选商品生成订单',
      scope: ['订单创建', '不涉及：支付'],
      suggestedEpics: [{ title: '订单创建', stories: ['选择商品生成订单'] }],
      action: 'create'
    }
  ],
  dependencies: [{ from: 'order', to: 'product', description: '订单引用商品 N:1' }],
  coverage: [
    { requirement: '商品 CRUD', moduleKey: 'product' },
    { requirement: '订单', moduleKey: 'order' }
  ],
  unassigned: [{ requirement: '订单状态', reason: '待确认' }],
  openIssues: ['需要库存扣减吗？'],
  warnings: ['未生成支付模块']
}

test('splitModulePlanOutput：分隔符 + 代码块/尾逗号容错', () => {
  const raw = [
    '建议拆成两个业务域。',
    MODULE_PLAN_DELIMITER,
    '```json',
    JSON.stringify(PLAN).replace('}]', '},]'),
    '```'
  ].join('\n')
  const parsed = splitModulePlanOutput(raw)
  assert.equal(parsed.error, '')
  assert.match(parsed.reply, /两个业务域/)
  assert.equal(parsed.plan?.modules.length, 2)
  assert.equal(parsed.plan?.modules[1].title, '订单管理')
  assert.deepEqual(parsed.plan?.dependencies, [{ from: 'order', to: 'product', description: '订单引用商品 N:1' }])
})

test('splitModulePlanOutput：没有分隔符时也能从整段提取 JSON', () => {
  const parsed = splitModulePlanOutput(`拆分如下：\n${JSON.stringify(PLAN)}\n请确认`)
  assert.equal(parsed.plan?.modules.length, 2)
})

test('splitModulePlanOutput：无法解析/空 modules 返回错误且没有计划', () => {
  const broken = splitModulePlanOutput('这次只说了想法')
  assert.equal(broken.plan, null)
  assert.match(broken.error, /MODULE_PLAN_JSON/)
  const empty = splitModulePlanOutput(`${MODULE_PLAN_DELIMITER}\n{"modules":[]}`)
  assert.equal(empty.plan, null)
  assert.match(empty.error, /modules/)
})

test('normalizeModulePlan：字段降级、key 去重、非法依赖过滤', () => {
  const plan = normalizeModulePlan({
    modules: [
      { key: 'a', title: ' 商品管理 ', scope: [' 范围 ', ''], suggestedEpics: [{ title: 'Epic', stories: ['s1', ''] }] },
      { key: 'a', title: '订单管理' },
      { title: '' }
    ],
    dependencies: [
      { from: 'a', to: 'a', description: 'ok' },
      { from: 'x', to: 'a', description: '非法' }
    ]
  })
  assert.equal(plan.modules[0].title, '商品管理')
  assert.deepEqual(plan.modules[0].scope, ['范围'])
  assert.deepEqual(plan.modules[0].suggestedEpics, [{ title: 'Epic', stories: ['s1'] }])
  assert.notEqual(plan.modules[0].key, plan.modules[1].key)
  assert.equal(plan.dependencies.length, 1)
})

test('validateModulePlan：空/重复/动作/数量上限错误，CRUD 与过多 warning', () => {
  assert.ok(validateModulePlan(normalizeModulePlan({ modules: [] })).errors.some(item => item.includes('至少')))
  assert.ok(
    validateModulePlan(normalizeModulePlan({ modules: [{ title: 'A' }, { title: 'A' }] })).errors.some(item =>
      item.includes('重复')
    )
  )
  assert.ok(
    validateModulePlan(normalizeModulePlan({ modules: [{ title: '商品管理', action: 'rename' }] })).errors.some(item =>
      item.includes('只能新建')
    )
  )
  assert.ok(
    validateModulePlan(normalizeModulePlan({ modules: [{ title: '商品管理', existingModuleId: 'm1' }] })).errors.some(item =>
      item.includes('已有模块')
    )
  )
  const tooMany = normalizeModulePlan({
    modules: Array.from({ length: MAX_PLAN_MODULES + 1 }, (_, index) => ({ title: `模块${index}` }))
  })
  assert.ok(validateModulePlan(tooMany).errors.some(item => item.includes('不能超过')))

  const crud = validateModulePlan(normalizeModulePlan({ modules: [{ title: '新增商品' }] }))
  assert.ok(crud.warnings.some(item => item.includes('CRUD')))
  assert.ok(crud.warnings.some(item => item.includes('覆盖')))

  const many = validateModulePlan(
    normalizeModulePlan({ modules: Array.from({ length: 9 }, (_, index) => ({ title: `业务域${index}` })) })
  )
  assert.ok(many.warnings.some(item => item.includes('耗时')))
})
