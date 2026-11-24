import assert from 'node:assert/strict'
import test from 'node:test'
import { ER_ZOOM_MAX, ER_ZOOM_MIN, anchorScroll, applyErWheel, clampErZoom } from './er-zoom.js'

test('clampErZoom：20—200 整数，非法值回落 100', () => {
  assert.equal(ER_ZOOM_MIN, 20)
  assert.equal(ER_ZOOM_MAX, 200)
  assert.equal(clampErZoom(5), 20)
  assert.equal(clampErZoom(500), 200)
  assert.equal(clampErZoom(97.6), 98)
  assert.equal(clampErZoom('120'), 120)
  assert.equal(clampErZoom(Number.NaN), 100)
  assert.equal(clampErZoom(undefined), 100)
})

test('applyErWheel：仅 Ctrl/⌘ 缩放；普通滚轮返回 null', () => {
  assert.equal(applyErWheel({ current: 100, ctrl: false, meta: false, deltaY: -300 }), null)
  const up = applyErWheel({ current: 100, ctrl: true, meta: false, deltaY: -300 })
  const down = applyErWheel({ current: 100, ctrl: false, meta: true, deltaY: 300 })
  assert.ok(up > 100, `滚轮向上应放大（实际 ${up}）`)
  assert.ok(down < 100, `滚轮向下应缩小（实际 ${down}）`)
  assert.equal(applyErWheel({ current: 20, ctrl: true, meta: false, deltaY: 300 }), 20)
  assert.equal(applyErWheel({ current: 200, ctrl: true, meta: false, deltaY: -300 }), 200)
  assert.equal(applyErWheel({ current: 100, ctrl: true, meta: false, deltaY: 0 }), 100)
})

test('anchorScroll：以光标为锚点修正滚动；边界不小于 0', () => {
  const zoomIn = anchorScroll({ scrollLeft: 200, scrollTop: 100, offsetX: 50, offsetY: 30, from: 100, to: 200 })
  assert.ok(zoomIn.scrollLeft > 200, '放大后滚动量增大')
  assert.ok(zoomIn.scrollTop > 100, '放大后滚动量增大')
  const zoomOut = anchorScroll({ scrollLeft: 200, scrollTop: 100, offsetX: 50, offsetY: 30, from: 200, to: 100 })
  assert.ok(zoomOut.scrollLeft < 200, '缩小后滚动量减小')
  const zero = anchorScroll({ scrollLeft: 0, scrollTop: 0, offsetX: 0, offsetY: 0, from: 200, to: 100 })
  assert.deepEqual(zero, { scrollLeft: 0, scrollTop: 0 })
})
