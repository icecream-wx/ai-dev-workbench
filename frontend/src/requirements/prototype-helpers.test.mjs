import assert from 'node:assert/strict'
import test from 'node:test'
import { fitScale, templateSourceLabel, typeLabel, warningText } from './prototype-helpers.js'

test('类型/来源标签', () => {
  assert.equal(typeLabel('form'), '表单')
  assert.equal(typeLabel('detail'), '详情')
  assert.equal(typeLabel('unknown'), '列表')
  assert.equal(templateSourceLabel('design-project'), '设计项目模板')
  assert.equal(templateSourceLabel('app-default'), '应用默认')
  assert.equal(templateSourceLabel('global-default'), '全局默认')
  assert.equal(templateSourceLabel('x'), '')
})

test('fitScale：等比缩小 + 上下限 + 0/负值边界', () => {
  assert.equal(fitScale(1440, 1180), 1)
  assert.equal(fitScale(1180, 1180), 1)
  assert.ok(Math.abs(fitScale(900, 1180) - 900 / 1180) < 1e-9)
  assert.equal(fitScale(300, 1180), 0.5)
  assert.equal(fitScale(0, 1180), 0.5)
  assert.equal(fitScale(-10, 1180), 0.5)
  assert.equal(fitScale(900, 0), 1)
  assert.equal(fitScale(900, -5), 1)
  assert.equal(fitScale(900, Number.NaN), 1)
  assert.equal(fitScale(Number.NaN, 1180), 0.5)
  assert.equal(fitScale(2000, 1180, { min: 0.4, max: 0.9 }), 0.9)
})

test('warningText：优先后端 message，缺失按 code 兜底', () => {
  assert.equal(warningText({ code: 'epic-without-story', message: 'EPIC-002「商品明细」还没有 Story' }), 'EPIC-002「商品明细」还没有 Story')
  assert.equal(warningText({ code: 'no-module' }), '应用还没有未归档的需求模块')
  assert.equal(warningText({ code: 'no-epics' }), '该模块还没有 Epic / Story')
  assert.equal(warningText({ code: 'unassigned-stories' }), '有 Story 未归属到 Epic')
  assert.equal(warningText({ code: 'story-without-title' }), '有 Story 标题为空')
  assert.equal(warningText({ code: 'unknown' }), '预览提示')
})
