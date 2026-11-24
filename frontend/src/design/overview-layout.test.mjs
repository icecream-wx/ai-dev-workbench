import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clampOverviewZoom,
  downloadDataUrl,
  fitOverviewZoom,
  overviewCanvasLayout,
  overviewFileName,
  overviewLayout,
  overviewZoomAt
} from './overview-layout.js'

test('overviewLayout：2 列、页头/页脚、行数与画布尺寸', () => {
  const layout = overviewLayout(3)
  assert.equal(layout.columns, 2)
  assert.equal(layout.rows, 2)
  assert.equal(layout.cells.length, 3)
  assert.equal(layout.width, 1440)
  assert.equal(layout.cells[0].x, 32)
  assert.ok(layout.cells[1].x > layout.cells[0].x)
  assert.equal(layout.cells[2].y, layout.cells[0].y + layout.cellHeight + layout.gap)
  assert.ok(layout.height > layout.header + layout.cellHeight)
  assert.ok(layout.cells[0].imageHeight > 40)
})

test('overviewLayout：空集合仍返回 1 行布局（避免 0 尺寸）', () => {
  const layout = overviewLayout(0)
  assert.equal(layout.rows, 0)
  assert.equal(layout.cells.length, 0)
  assert.ok(layout.width > 0 && layout.height > 0)
})

test('overviewLayout：单列/自定义宽度', () => {
  const layout = overviewLayout(2, { columns: 1, width: 720, padding: 20, gap: 10 })
  assert.equal(layout.columns, 1)
  assert.equal(layout.cells.length, 2)
  assert.equal(layout.cells[0].x, 20)
  assert.equal(layout.cells[1].x, 20)
  assert.ok(layout.cells[0].width <= 720)
})

test('overviewFileName：安全化与空值兜底', () => {
  assert.equal(overviewFileName('product'), 'product-overview.png')
  assert.equal(overviewFileName('my set/../x'), 'my-set-..-x-overview.png')
  assert.equal(overviewFileName(''), 'page-set-overview.png')
})

test('downloadDataUrl：非浏览器/非法 dataUrl 安全返回 false', () => {
  assert.equal(downloadDataUrl('data:image/png;base64,AAAA', 'x.png'), false)
  assert.equal(downloadDataUrl('http://example.com/x.png', 'x.png'), false)
})

test('overviewCanvasLayout：2 列世界坐标 artboard 与总尺寸', () => {
  const layout = overviewCanvasLayout(3)
  assert.equal(layout.columns, 2)
  assert.equal(layout.rows, 2)
  assert.equal(layout.artboards.length, 3)
  assert.equal(layout.width, 160 * 2 + 2 * 1440 + 160)
  assert.equal(layout.height, 160 * 2 + 2 * (900 + 56) + 140)
  assert.deepEqual(layout.artboards[0], { x: 160, y: 160, width: 1440, height: 900, labelHeight: 56 })
  assert.equal(layout.artboards[1].x, 160 + 1440 + 160)
  assert.equal(layout.artboards[1].y, 160)
  assert.equal(layout.artboards[2].x, 160)
  assert.equal(layout.artboards[2].y, 160 + 900 + 56 + 140)
})

test('overviewCanvasLayout：空集合返回空 artboards 且尺寸非 0', () => {
  const layout = overviewCanvasLayout(0)
  assert.equal(layout.rows, 0)
  assert.equal(layout.artboards.length, 0)
  assert.ok(layout.width > 0)
  assert.equal(layout.height, 320)
})

test('clampOverviewZoom / fitOverviewZoom：10—100 整数与适应窗口', () => {
  assert.equal(clampOverviewZoom(5), 10)
  assert.equal(clampOverviewZoom(150), 100)
  assert.equal(clampOverviewZoom(33.4), 33)
  assert.equal(clampOverviewZoom(Number.NaN), 100)
  const fit = fitOverviewZoom({ viewportWidth: 1000, viewportHeight: 600, worldWidth: 3360, worldHeight: 2372, padding: 48 })
  assert.equal(fit, 21)
  assert.equal(
    fitOverviewZoom({ viewportWidth: 100, viewportHeight: 100, worldWidth: 3360, worldHeight: 2372 }),
    10
  )
})

test('overviewZoomAt：以光标为锚点缩放，缩放不变时 pan 不变', () => {
  const zoomIn = overviewZoomAt({ zoom: 50, nextZoom: 100, pointX: 500, pointY: 400, panX: 0, panY: 0 })
  assert.equal(zoomIn.panX, -500)
  assert.equal(zoomIn.panY, -400)
  const zoomOut = overviewZoomAt({ zoom: 100, nextZoom: 50, pointX: 500, pointY: 400, panX: 0, panY: 0 })
  assert.equal(zoomOut.panX, 250)
  assert.equal(zoomOut.panY, 200)
  const withPan = overviewZoomAt({ zoom: 50, nextZoom: 100, pointX: 300, pointY: 200, panX: -200, panY: -100 })
  assert.equal(withPan.panX, -700)
  assert.equal(withPan.panY, -400)
  const stable = overviewZoomAt({ zoom: 40, nextZoom: 40, pointX: 10, pointY: 20, panX: 7, panY: 9 })
  assert.deepEqual(stable, { panX: 7, panY: 9 })
})
