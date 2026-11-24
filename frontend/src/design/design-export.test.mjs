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

test('normalizeExportPages 保留 pageSet（manifest 页面集）', () => {
  const pages = normalizeExportPages([
    { id: 'product-list', pageSet: 'goods', dataUrl: PNG },
    { id: 'product-form', dataUrl: PNG }
  ])
  assert.deepEqual(pages, [
    { id: 'product-list', pageSet: 'goods', dataUrl: PNG },
    { id: 'product-form', dataUrl: PNG }
  ])
})

test('designHashOf：直接取 artifacts.designHash（应用级）', () => {
  assert.equal(designHashOf({ designHash: 'abc' }), 'abc')
  assert.equal(designHashOf('abc'), 'abc')
  assert.equal(designHashOf({}), '')
  assert.equal(designHashOf(null), '')
})

test('manifest 解析：对象 pages / 数组 pages 都可；按 id 排序；pageSet 透传', () => {
  const fromObject = parsePrototypeArtifact({
    designHash: 'h',
    styleId: 's',
    exportedAt: '2026-11-19T00:00:00.000Z',
    pages: {
      'product-form': { file: 'product-form.png', hash: 'b', pageSet: 'goods' },
      'product-list': { file: 'product-list.png', hash: 'a', pageSet: 'goods' }
    }
  })
  assert.deepEqual(fromObject.pages.map(page => page.id), ['product-form', 'product-list'])
  assert.equal(fromObject.pages[1].file, 'product-list.png')
  assert.equal(fromObject.pages[1].pageSet, 'goods')
  assert.equal(parsePrototypeArtifact(null), null)
})

test('stale：无 manifest / hash 不一致；直接传 prototypes 产物', () => {
  const prototypes = {
    designHash: 'old',
    styleId: 's',
    exportedAt: 'now',
    pages: [{ id: 'a', file: 'a.png', hash: 'x', pageSet: 'goods' }]
  }
  assert.equal(isPrototypeStale(prototypes, 'new'), true)
  assert.equal(isPrototypeStale(prototypes, 'old'), false)
  assert.equal(isPrototypeStale(null, 'old'), false)
  assert.equal(needsPrototypeExport(prototypes, 'new'), true)
  assert.equal(needsPrototypeExport(prototypes, 'old'), false)
  assert.equal(needsPrototypeExport(null, 'old'), true)
  assert.match(prototypeSummary(prototypes), /^1 页 · 导出于 now$/)
  assert.equal(prototypeSummary(null), '')
})
