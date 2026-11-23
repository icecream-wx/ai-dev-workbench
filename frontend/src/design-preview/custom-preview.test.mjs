/**
 * P7-7c：自定义模板 design-preview 映射（纯函数）
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveCustomPreview, shortTypeClassOf } from './custom-preview.js'

const CUSTOM_SYSTEM = {
  appId: 'supplier-app',
  pack: { id: 'supplier-hub', name: '供应商管理模板', version: '1.0.2', source: 'custom' },
  origin: { kind: 'custom', draftId: 'supplier-hub', baseApplicationType: 'enterprise-application-platform' },
  applicationType: { id: 'supplier-hub', name: '供应商管理模板' },
  style: { id: 'data-cyan', name: '数据蓝青', className: 'visual-style-data-cyan' },
  preview: {
    kind: 'custom',
    baseApplicationType: 'enterprise-application-platform',
    structure: 'docs/design/template/supplier-hub/structure.css',
    structureUrl: '/api/apps/supplier-app/design-system/asset?path=supplier-hub%2Fstructure.css',
    styleClassName: 'visual-style-data-cyan',
    packVersion: '1.0.2'
  },
  pages: []
}

test('resolveCustomPreview：内置/缺失 preview 返回 null（走 registry）', () => {
  assert.equal(resolveCustomPreview(null), null)
  assert.equal(resolveCustomPreview({ applicationType: { id: 'x', name: 'X' } }), null)
  assert.equal(resolveCustomPreview({ preview: { kind: 'builtin' } }), null)
})

test('resolveCustomPreview：自定义映射 base 短类/结构 URL/风格类/类型名', () => {
  const resolved = resolveCustomPreview(CUSTOM_SYSTEM)
  assert.ok(resolved)
  assert.equal(resolved.kind, 'custom')
  assert.equal(resolved.typeId, 'supplier-hub')
  assert.equal(resolved.baseApplicationType, 'enterprise-application-platform')
  assert.equal(resolved.shortTypeClass, 'application-type-enterprise-platform')
  assert.match(String(resolved.structureUrl), /^\/api\/apps\/supplier-app\/design-system\/asset\?path=/)
  assert.equal(resolved.styleClassName, 'visual-style-data-cyan')
  assert.equal(resolved.typeName, '供应商管理模板')
})

test('resolveCustomPreview：显式 typeId 优先；未知 base 用 application-type-<base> 兜底', () => {
  const resolved = resolveCustomPreview(
    {
      ...CUSTOM_SYSTEM,
      preview: { ...CUSTOM_SYSTEM.preview, baseApplicationType: 'tenant-console' }
    },
    { typeId: 'custom-pack' }
  )
  assert.ok(resolved)
  assert.equal(resolved.typeId, 'custom-pack')
  assert.equal(resolved.shortTypeClass, 'application-type-tenant-console')
})

test('shortTypeClassOf：内置 4 类型短类 + 空值', () => {
  assert.equal(shortTypeClassOf('operations-management'), 'application-type-operations')
  assert.equal(shortTypeClassOf('data-governance-workbench'), 'application-type-data-governance')
  assert.equal(shortTypeClassOf('incident-response-console'), 'application-type-incident-response')
  assert.equal(shortTypeClassOf(''), '')
})
