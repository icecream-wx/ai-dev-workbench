/**
 * skinFromStyle：设计系统风格 → 原型皮肤（纯函数）
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { skinFromStyle } from './skin.js'

test('skinFromStyle：透传主色/强调色/中性色/背景 + 圆角，字体与外壳用默认', () => {
  const skin = skinFromStyle({
    id: 'platform-blue',
    name: '平台蓝',
    tokens: { primary: '#1d4ed8', accent: '#0f766e', neutral: '#334155', background: '#ffffff', radius: 8, density: 'compact' }
  })
  assert.equal(skin.id, 'platform-blue')
  assert.equal(skin.name, '平台蓝')
  assert.equal(skin.category, 'custom')
  assert.equal(skin.tokens.primary, '#1d4ed8')
  assert.equal(skin.tokens.accent, '#0f766e')
  assert.equal(skin.tokens.neutral, '#334155')
  assert.equal(skin.tokens.background, '#ffffff')
  assert.equal(skin.tokens.radius, 8)
  assert.equal(skin.tokens.density, 'compact')
  assert.equal(skin.tokens.spacing, 10)
  assert.match(skin.tokens.font, /Microsoft YaHei/)
  assert.deepEqual(skin.shell, { type: 'topbar', sidebarDark: false, contentWidth: 1180 })
})

test('skinFromStyle：舒适密度 spacing=12；圆角越界收敛', () => {
  const skin = skinFromStyle({ id: 'classic-warm', name: '经典暖色', tokens: { radius: 99, density: 'comfortable' } })
  assert.equal(skin.tokens.spacing, 12)
  assert.equal(skin.tokens.density, 'comfortable')
  assert.equal(skin.tokens.radius, 24)
  const negative = skinFromStyle({ tokens: { radius: -5 } })
  assert.equal(negative.tokens.radius, 0)
})

test('skinFromStyle：缺失风格/tokens 时给默认皮肤，不抛错', () => {
  for (const input of [null, undefined, {}, { tokens: null }]) {
    const skin = skinFromStyle(input)
    assert.equal(skin.id, 'default')
    assert.equal(skin.name, '')
    assert.equal(skin.tokens.primary, '#2563eb')
    assert.equal(skin.tokens.spacing, 10)
    assert.equal(skin.shell.type, 'topbar')
  }
})
