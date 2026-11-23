import assert from 'node:assert/strict'
import test from 'node:test'
import {
  APP_VIEWS,
  appRoute,
  artifactErrorLine,
  artifactSummary,
  isAppView,
  statusLabel,
  viewFromStatus,
  viewLabel
} from './view-helpers.js'

test('视图常量与状态映射：没有门禁语义', () => {
  assert.deepEqual(APP_VIEWS, ['requirements', 'design', 'development'])
  assert.equal(isAppView('design'), true)
  assert.equal(isAppView('completed'), false)
  assert.equal(viewFromStatus('requirements'), 'requirements')
  assert.equal(viewFromStatus('design'), 'design')
  assert.equal(viewFromStatus('development'), 'development')
  assert.equal(viewFromStatus('completed'), 'development')
  assert.equal(viewFromStatus('unknown'), 'requirements')
})

test('视图/状态标签与路由', () => {
  assert.equal(viewLabel('requirements'), '需求')
  assert.equal(viewLabel('design'), '设计')
  assert.equal(viewLabel('development'), '开发')
  // 状态文案与外壳 STATUS_CHIP 一致：需求中/设计中/开发中/已完成
  assert.equal(statusLabel('requirements'), '需求中')
  assert.equal(statusLabel('design'), '设计中')
  assert.equal(statusLabel('development'), '开发中')
  assert.equal(statusLabel('completed'), '已完成')
  assert.equal(statusLabel('unknown'), '需求中')
  assert.equal(appRoute({ id: 'demo-app', status: 'design' }), '#/apps/demo-app/design')
  assert.equal(appRoute({ id: 'demo-app', status: 'completed' }), '#/apps/demo-app/development')
})

test('产物错误行：文件 · 字段 · 说明（期望）', () => {
  const line = artifactErrorLine({
    file: 'docs/design/MOD-001/design.json',
    path: 'entities[0].fields[0].type',
    message: '取值应为 string | text',
    expected: 'enum'
  })
  assert.match(line, /design\.json · entities\[0\]\.fields\[0\]\.type · 取值应为/)
  assert.match(line, /期望：enum/)
  assert.equal(artifactErrorLine({}), '（未知文件） · $ · ')
})

test('产物概览与错误行', () => {
  assert.equal(artifactSummary({ modules: [{}, {}], designs: [{}], errors: [] }), '2 个模块 · 1 个设计')
  assert.equal(artifactSummary({ modules: [], designs: [], errors: [{}, {}] }), '0 个模块 · 0 个设计')
  assert.equal(artifactSummary(null), '0 个模块 · 0 个设计')
  assert.match(artifactErrorLine({ file: 'a.json', path: 'x', message: 'bad', expected: 'array' }), /a\.json · x · bad（期望：array）/)
})
