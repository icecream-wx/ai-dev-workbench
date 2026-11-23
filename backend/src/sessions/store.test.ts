/**
 * 会话视图扩展（P7-7b-1）：AppView 保持三值，SessionView 增加 template。
 * 临时数据目录；不启动 opencode、不调模型。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, before } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-session-store-'))
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_AUTO_START = 'false'

let store: typeof import('./store')
let db: typeof import('../db').db

before(async () => {
  db = (await import('../db')).db
  store = await import('./store')
})

after(() => {
  db?.close()
  fs.rmSync(root, { recursive: true, force: true })
})

function rowOf(overrides: Partial<import('./store').AppSessionRow> = {}): import('./store').AppSessionRow {
  return {
    id: 'row-1',
    app_id: 'app-1',
    stage: 'template',
    view: 'template',
    opencode_session_id: 'oc-1',
    provider_id: null,
    model_id: null,
    status: 'active',
    title: null,
    note: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_active_at: null,
    ...overrides
  }
}

test('isAppView 仍只接受三值；isSessionView 额外接受 template', () => {
  for (const view of ['requirements', 'design', 'development'] as const) {
    assert.equal(store.isAppView(view), true)
    assert.equal(store.isSessionView(view), true)
  }
  assert.equal(store.isAppView('template'), false)
  assert.equal(store.isSessionView('template'), true)
  assert.equal(store.isSessionView('other'), false)
  assert.equal(store.isSessionView(null), false)
  assert.deepEqual(store.SESSION_VIEWS, ['requirements', 'design', 'development', 'template'])
  assert.deepEqual(store.APP_VIEWS, ['requirements', 'design', 'development'])
})

test('viewOf：template 返回自身；旧行 view=NULL → development；其它非法值也回退 development', () => {
  assert.equal(store.viewOf(rowOf({ view: 'template' })), 'template')
  assert.equal(store.viewOf(rowOf({ view: 'design' })), 'design')
  assert.equal(store.viewOf(rowOf({ view: null })), 'development')
  assert.equal(store.viewOf(rowOf({ view: 'legacy' })), 'development')
})

test('template 会话：create/list/active/archive 均按 view=template 隔离', () => {
  const created = store.createSessionRow({
    appId: '__template__:supplier-hub',
    view: 'template',
    opencodeSessionId: 'oc-tpl-1',
    title: '供应商管理模板 · 模板工作室',
    providerId: 'p',
    modelId: 'm'
  })
  assert.equal(created.view, 'template')
  assert.equal(created.stage, 'template')

  // 同 app_id 的应用视图会话不影响 template 查询
  store.createSessionRow({
    appId: '__template__:supplier-hub',
    view: 'development',
    opencodeSessionId: 'oc-dev-1',
    title: '开发',
    providerId: null,
    modelId: null
  })

  assert.equal(store.activeSessionRow('__template__:supplier-hub', 'template')?.id, created.id)
  assert.equal(store.listSessionRows('__template__:supplier-hub', 'template').length, 1)
  assert.equal(store.listSessionRows('__template__:supplier-hub', 'development').length, 1)
  assert.equal(store.listSessionRows('__template__:supplier-hub').length, 2)

  const second = store.createSessionRow({
    appId: '__template__:supplier-hub',
    view: 'template',
    opencodeSessionId: 'oc-tpl-2',
    title: '第二会话',
    providerId: null,
    modelId: null
  })
  store.archiveActiveSessions('__template__:supplier-hub', 'template', second.id)
  const rows = store.listSessionRows('__template__:supplier-hub', 'template')
  const first = rows.find(row => row.id === created.id)
  const kept = rows.find(row => row.id === second.id)
  assert.equal(first?.status, 'archived')
  assert.equal(kept?.status, 'active')
  assert.equal(store.listSessionRows('__template__:supplier-hub', 'development').length, 1, '归档不跨视图')
})
