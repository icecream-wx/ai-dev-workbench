import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  draftBasePath,
  errorFromResponse,
  studioBasePath,
  studioEventsUrl,
  toDevList,
  toDevState
} from './api-helpers.js'

test('工作室路径：草稿/工作室/SSE（与 §13.3 对齐，packId 编码）', () => {
  assert.equal(draftBasePath('supplier-hub'), '/design-templates/drafts/supplier-hub')
  assert.equal(studioBasePath('supplier-hub'), '/design-templates/drafts/supplier-hub/studio')
  assert.equal(studioEventsUrl('supplier-hub'), '/api/design-templates/drafts/supplier-hub/studio/events')
  assert.equal(draftBasePath(''), '/design-templates/drafts/')
})

test('状态映射：StudioStateResponse → DevStateResponse（app 合成、view=template）', () => {
  const mapped = toDevState({
    view: 'template',
    draft: {
      schemaVersion: 1,
      id: 'supplier-hub',
      name: '供应商管理模板',
      status: 'draft',
      createdAt: '2026-11-21T00:00:00.000Z',
      updatedAt: '2026-11-21T00:00:00.000Z',
      style: 'data-cyan',
      baseApplicationType: 'enterprise-application-platform',
      publishedVersion: null,
      lastSpecHash: null
    },
    session: { id: 's1', view: 'template', opencodeSessionId: 'oc-1' },
    sessions: [],
    activeSessionId: 's1',
    state: { status: 'idle', messages: [], steps: [] },
    defaultPrompt: '当前模板/草稿：supplier-hub。',
    spec: null,
    specError: null,
    validation: { ok: true, errors: [], warnings: [] },
    readOnly: false,
    staleSession: true
  })
  assert.deepEqual(mapped.app, {
    id: 'supplier-hub',
    name: '供应商管理模板',
    status: 'draft',
    createdAt: '2026-11-21T00:00:00.000Z'
  })
  assert.equal(mapped.view, 'template')
  assert.equal(mapped.session?.view, 'template')
  assert.equal(mapped.session?.id, 's1')
  assert.equal(mapped.state?.status, 'idle')
  assert.equal(mapped.defaultPrompt, '当前模板/草稿：supplier-hub。')
  assert.equal(mapped.readOnly, false)
  assert.equal(mapped.staleSession, true)
})

test('状态映射：无会话/缺字段时安全兜底', () => {
  const mapped = toDevState({})
  assert.deepEqual(mapped.app, { id: '', name: '', status: 'draft', createdAt: '' })
  assert.equal(mapped.session, null)
  assert.equal(mapped.state, null)
  assert.equal(mapped.defaultPrompt, '')
  assert.equal(mapped.readOnly, false)
  assert.equal('staleSession' in mapped, false)
})

test('会话列表映射：统一 view=template，保留 activeSessionId', () => {
  const mapped = toDevList({
    sessions: [{ id: 's1', displayTitle: '模板工作室', view: 'requirements', active: true }, null],
    activeSessionId: 's1',
    view: 'requirements'
  })
  assert.equal(mapped.view, 'template')
  assert.equal(mapped.activeSessionId, 's1')
  assert.equal(mapped.sessions.length, 2)
  assert.equal(mapped.sessions[0].view, 'template')
  assert.equal(mapped.sessions[0].displayTitle, '模板工作室')
  assert.equal(mapped.sessions[1].view, 'template')
  assert.deepEqual(toDevList(null), { sessions: [], activeSessionId: null, view: 'template' })
})

test('错误透传：保留后端 {error} 与 errors/warnings payload；缺省中文 HTTP 文案', () => {
  const payload = {
    error: 'spec 有 2 处错误',
    errors: [{ code: 'page-count', path: 'pages', message: '页面数必须在 1-30 之间' }],
    warnings: []
  }
  const failure = errorFromResponse(400, payload)
  assert.equal(failure.status, 400)
  assert.equal(failure.message, 'spec 有 2 处错误')
  assert.equal(failure.payload, payload)

  const fallback = errorFromResponse(502, null)
  assert.equal(fallback.message, '请求失败（HTTP 502）')
  assert.equal(fallback.payload, null)

  const specChanged = errorFromResponse(409, { error: 'spec 已变化，请先重新生成', code: 'spec-changed' })
  assert.equal(specChanged.message, 'spec 已变化，请先重新生成')
  assert.equal(specChanged.payload.code, 'spec-changed')
})
