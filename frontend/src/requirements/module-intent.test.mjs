/**
 * G1 前端预检/指引卡纯函数单测（node --test）
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { MODULE_GUIDANCE_ACTIONS, detectModuleIntent, guidanceButtonState } from './module-intent.js'

test('G1 前端预检：与后端一致的正例（新增/删除/改名/拆分/合并 + 模块）', () => {
  assert.equal(detectModuleIntent('帮我增加一个模块：订单客户管理'), 'create')
  assert.equal(detectModuleIntent('请创建业务域：售后'), 'create')
  assert.equal(detectModuleIntent('添加模块：支付'), 'create')
  assert.equal(detectModuleIntent('删除模块 MOD-003'), 'delete')
  assert.equal(detectModuleIntent('模块改名：商品中心'), 'rename')
  assert.equal(detectModuleIntent('把模块拆分成两个'), 'split')
  assert.equal(detectModuleIntent('合并模块：商品与订单'), 'merge')
})

test('G1 前端预检：反例不命中（模块里字段 / Epics Story / 模块页面）', () => {
  assert.equal(detectModuleIntent('在模块里新增一个字段：客户等级'), null)
  assert.equal(detectModuleIntent('在 Epics 章节新增一个 Story'), null)
  assert.equal(detectModuleIntent('模块内的页面需要支持筛选'), null)
  assert.equal(detectModuleIntent('新增一个模块的字段说明'), null)
  assert.equal(detectModuleIntent('模块新增字段：备注'), null)
  assert.equal(detectModuleIntent(''), null)
  assert.equal(detectModuleIntent(undefined), null)
})

test('G1 前端预检：与后端一致的评审 17 条（数量词 / 误伤 / 为成动词）', () => {
  const cases = [
    ['我要新增两个模块', 'create'],
    ['增加 2 个模块', 'create'],
    ['合并两个模块', 'merge'],
    ['订单模块增加客户绑定', null],
    ['这个模块增加客户维度', null],
    ['帮我增加一个模块：订单客户管理，包含客户、联系人', 'create'],
    ['创建业务域', 'create'],
    ['帮我加个模块', 'create'],
    ['删除模块 订单管理', 'delete'],
    ['模块改名', 'rename'],
    ['把订单模块改名为客户管理', 'rename'],
    ['拆分模块', 'split'],
    ['在模块里新增一个字段', null],
    ['在 Epics 章节新增一个 Story', null],
    ['商品模块新增字段', null],
    ['模块内的页面需要调整', null],
    ['在商品模块里增加一个客户字段', null],
    ['拆成两个模块', 'split'],
    ['合并为订单模块', 'merge'],
    ['把模块移除掉', 'delete']
  ]
  for (const [text, expected] of cases) {
    assert.equal(detectModuleIntent(text), expected, `话术「${text}」期望 ${String(expected)}`)
  }
})

test('G1 指引卡：按钮固定四个，只有服务端建议的可用，其余禁用并带 title', () => {
  const state = guidanceButtonState([{ action: 'create-module' }, { action: 'open-replan' }])
  assert.equal(state.length, MODULE_GUIDANCE_ACTIONS.length)
  assert.deepEqual(
    state.filter(item => item.enabled).map(item => item.action),
    ['create-module', 'open-replan']
  )
  const reopen = state.find(item => item.action === 'reopen-requirements')
  assert.equal(reopen.enabled, false)
  assert.match(reopen.title, /仅设计/)
  const change = state.find(item => item.action === 'open-change-set')
  assert.equal(change.enabled, false)
  assert.match(change.title, /开发\/完成阶段/)
  // 可用按钮的 title 就是自身文案
  assert.equal(state.find(item => item.action === 'create-module').title, '＋ 新增模块')
})

test('G1 指引卡：空/异常 suggestions 全部禁用（不抛错）', () => {
  for (const value of [null, undefined, [], [{ action: 'unknown' }]]) {
    const state = guidanceButtonState(value)
    assert.equal(state.every(item => item.enabled === false), true)
    assert.equal(state.every(item => item.title.length > 0), true)
  }
})
