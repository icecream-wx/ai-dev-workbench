import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPrototypePayload,
  designHashOf,
  isPrototypeStale,
  needsPrototypeExport,
  normalizeExportPages,
  parsePrototypeArtifact,
  prototypeSummary,
  safePageId
} from './design-export.js'

const PNG = 'data:image/png;base64,iVBORw0KGgo='

test('页面 id 安全化 + 保序去重 + 空 id 回退', () => {
  assert.equal(safePageId(' product-list '), 'product-list')
  assert.equal(safePageId('商品 列表'), '')
  assert.equal(safePageId('a/b'), 'a-b')
  const pages = normalizeExportPages([
    { id: 'product-list', dataUrl: PNG },
    { id: 'product list', dataUrl: PNG },
    { id: 'product-list', dataUrl: PNG },
    { id: '', dataUrl: PNG },
    { id: 'bad', dataUrl: 'data:image/jpeg;base64,AAAA' }
  ])
  assert.deepEqual(
    pages.map(page => page.id),
    ['product-list', 'product-list-2', 'product-list-3', 'page-4']
  )
})

test('payload：缺 hash/styleId 或无页面 → null；否则字段完整', () => {
  assert.equal(buildPrototypePayload({ styleId: 's', pages: [{ id: 'a', dataUrl: PNG }] }), null)
  assert.equal(buildPrototypePayload({ designHash: 'h', pages: [{ id: 'a', dataUrl: PNG }] }), null)
  assert.equal(buildPrototypePayload({ designHash: 'h', styleId: 's', pages: [] }), null)
  const payload = buildPrototypePayload({
    designHash: ' h ',
    styleId: ' platform-blue ',
    pages: [
      { id: 'product-list', dataUrl: PNG },
      { id: 'product-form', dataUrl: PNG }
    ]
  })
  assert.deepEqual(payload, {
    designHash: 'h',
    styleId: 'platform-blue',
    pages: [
      { id: 'product-list', dataUrl: PNG },
      { id: 'product-form', dataUrl: PNG }
    ]
  })
})

test('designHashOf：从 artifacts.hashes 取当前 design.json hash', () => {
  const hashes = {
    'docs/design/MOD-001/design.json': 'abc',
    'docs/design/MOD-001/design-brief.md': 'def'
  }
  assert.equal(designHashOf(hashes, 'MOD-001'), 'abc')
  assert.equal(designHashOf(hashes, 'MOD-002'), '')
  assert.equal(designHashOf(null, 'MOD-001'), '')
})

test('manifest 解析：对象 pages / 数组 pages 都可；按 id 排序', () => {
  const fromObject = parsePrototypeArtifact({
    designHash: 'h',
    styleId: 's',
    exportedAt: '2026-11-19T00:00:00.000Z',
    pages: {
      'product-form': { file: 'product-form.png', hash: 'b' },
      'product-list': { file: 'product-list.png', hash: 'a' }
    }
  })
  assert.deepEqual(fromObject.pages.map(page => page.id), ['product-form', 'product-list'])
  assert.equal(fromObject.pages[1].file, 'product-list.png')
  assert.equal(parsePrototypeArtifact(null), null)
})

test('stale：无 manifest / hash 不一致 / 后端 stale', () => {
  const design = {
    prototypes: {
      designHash: 'old',
      styleId: 's',
      exportedAt: 'now',
      pages: [{ id: 'a', file: 'a.png', hash: 'x' }]
    }
  }
  assert.equal(isPrototypeStale(design, 'new'), true)
  assert.equal(isPrototypeStale(design, 'old'), false)
  assert.equal(isPrototypeStale({}, 'old'), false)
  assert.equal(needsPrototypeExport(design, 'new'), true)
  assert.equal(needsPrototypeExport(design, 'old'), false)
  assert.equal(needsPrototypeExport({}, 'old'), true)
  assert.match(prototypeSummary(design), /^1 页 · 导出于 now$/)
  assert.equal(prototypeSummary({}), '')
})
