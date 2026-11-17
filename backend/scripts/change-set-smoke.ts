/**
 * C1 完整变更循环 API 冒烟
 *
 * 真实 Express + 临时 SQLite/projects 目录：
 * 创建应用 → 需求/设计确认 → 交接包 v1（CS #1）→ 完成
 * → 发起变更 #2（需求+设计）→ 改需求/设计 → 确认 → 预览/生成 v2（基线 v1，绑定 CS #2）
 * → 05-CHANGES 增量 diff → 完成 #2
 * → 发起变更 #3（仅设计）→ 取消（恢复基线）→ 校验应用/版本/变更单
 * → 删除应用清理。
 *
 * 运行：npm run smoke:change-set --prefix backend
 * 可选：CHANGE_SET_SMOKE_DEV=1（额外创建真实 opencode 开发会话，需 opencode 可用）
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-changeset-smoke-'))
const port = Number(process.env.CHANGE_SET_SMOKE_PORT ?? 3413)
process.env.PORT = String(port)
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_PORT = String(port + 1000)
process.env.OPENCODE_AUTO_START = process.env.CHANGE_SET_SMOKE_DEV === '1' ? 'true' : 'false'

const base = `http://127.0.0.1:${port}`
const appId = 'changeset-smoke'
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03])

interface ApiResult {
  status: number
  data: unknown
}

async function request(method: string, apiPath: string, body?: unknown): Promise<ApiResult> {
  const res = await fetch(`${base}/api${apiPath}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const buffer = Buffer.from(await res.arrayBuffer())
  const text = buffer.toString('utf8')
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, data }
}

function assertOk(result: ApiResult, label: string): Record<string, unknown> {
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`${label} 失败（HTTP ${result.status}）：${JSON.stringify(result.data)}`)
  }
  return (result.data ?? {}) as Record<string, unknown>
}

function assertStatus(result: ApiResult, status: number, label: string): void {
  if (result.status !== status) throw new Error(`${label} 应返回 ${status}，实际 ${result.status}：${JSON.stringify(result.data)}`)
}

function expect(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

async function waitForHealth(): Promise<void> {
  for (let index = 0; index < 80; index += 1) {
    try {
      const res = await fetch(`${base}/api/health`)
      if (res.ok) return
    } catch {
      // 尚未监听
    }
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  throw new Error('后端健康检查超时')
}

interface AppPayload {
  status: string
  completedAt: string | null
  requirementDoc: { status: string; version: number } | null
  designProject: { status: string; version: number } | null
  handoff: { version: number; changeSet?: { id: string; seq: number; title: string; status: string } | null } | null
  changeSet: { id: string; seq: number; title: string; status: string } | null
  activeChangeSet: {
    id: string
    seq: number
    title: string
    status: string
    scope: string
    canCancel: boolean
    cancelBlockedReason: string | null
  } | null
}

async function app(): Promise<AppPayload> {
  const result = assertOk(await request('GET', `/apps/${appId}`), '读取应用')
  return result.app as AppPayload
}

async function fillRequirement(): Promise<void> {
  const markdown: Record<string, string> = {
    meta: '- 产品：C1 变更冒烟\n- 作者：测试\n- 日期：2026-11-11\n- 版本：v1\n- 状态：已确认',
    problem: '销售靠 Excel 维护客户，容易漏记。',
    goals: '客户查询从 10 分钟降到 1 分钟。',
    users: '- 销售：维护客户',
    scope: '- 本期做：客户列表、创建/编辑/详情\n- 不做：财务对账',
    rules: '- 客户编号唯一\n- 客户名称必填',
    pages: '- 客户列表、创建客户、编辑客户、客户详情',
    acceptance: '- 能创建客户并在列表看到\n- 能按名称查询'
  }
  const initial = assertOk(await request('GET', `/apps/${appId}/requirements-doc`), '初始化需求文档')
  for (const section of initial.sections as Array<{ sectionKey: string; required: boolean }>) {
    if (section.sectionKey === 'scenes') {
      assertOk(
        await request('PUT', `/apps/${appId}/requirements-doc/sections/scenes`, {
          data: { scenes: [{ title: '客户管理', description: '销售维护客户信息' }], epics: [], stories: [] }
        }),
        '保存场景'
      )
      continue
    }
    if (section.sectionKey === 'epics') {
      await saveEpics('客户管理', '创建客户', ['客户编号唯一', '客户名称必填'], '查询客户', ['能按名称筛选'])
      continue
    }
    if (!section.required) continue
    assertOk(
      await request('PUT', `/apps/${appId}/requirements-doc/sections/${section.sectionKey}`, {
        markdown: markdown[section.sectionKey] ?? '冒烟内容'
      }),
      `保存需求章节 ${section.sectionKey}`
    )
  }
  assertOk(await request('POST', `/apps/${appId}/requirements-doc/confirm`), '确认需求文档')
}

async function saveEpics(
  epicTitle: string,
  story1Title: string,
  story1Acceptance: string[],
  story2Title: string,
  story2Acceptance: string[],
  extra?: { story3Title: string; story3Acceptance: string[] }
): Promise<void> {
  const stories = [
    { id: 'STORY-001', epicId: 'EPIC-001', title: story1Title, description: `作为销售，我希望${story1Title}`, acceptance: story1Acceptance, priority: 'P0' },
    { id: 'STORY-002', epicId: 'EPIC-001', title: story2Title, description: `作为销售，我希望${story2Title}`, acceptance: story2Acceptance, priority: 'P1' }
  ]
  if (extra) {
    stories.push({
      id: 'STORY-003',
      epicId: 'EPIC-001',
      title: extra.story3Title,
      description: `作为销售，我希望${extra.story3Title}`,
      acceptance: extra.story3Acceptance,
      priority: 'P1'
    })
  }
  assertOk(
    await request('PUT', `/apps/${appId}/requirements-doc/sections/epics`, {
      data: {
        scenes: [],
        epics: [{ id: 'EPIC-001', title: epicTitle, goal: '支持销售维护客户信息', priority: 'P0' }],
        stories
      }
    }),
    '保存 Epic/Story'
  )
}

interface DesignPayload {
  status: string
  version: number
  template: { id: string; name: string }
  entities: Array<Record<string, unknown>>
  pageSets: Array<{ id: string; title: string; pages: Array<{ id: string; title: string; type: string }> }>
}

async function design(): Promise<DesignPayload> {
  return assertOk(await request('GET', `/apps/${appId}/design`), '读取设计') as unknown as DesignPayload
}

async function prepareConfirmedDesign(): Promise<void> {
  assertOk(
    await request('PUT', `/apps/${appId}/design/entities`, {
      entities: [
        {
          name: '客户',
          tableName: 'biz_customer',
          description: '客户主表',
          requirementRefs: ['STORY-001', 'STORY-002'],
          fields: [
            { name: 'customerNo', label: '客户编号', type: 'string', length: 32, required: true, unique: true },
            { name: 'customerName', label: '客户名称', type: 'string', required: true },
            { name: 'level', label: '客户等级', type: 'enum', options: ['普通', 'VIP'] }
          ]
        }
      ]
    }),
    '保存实体'
  )
  assertOk(await request('POST', `/apps/${appId}/design/page-sets/generate`, { mode: 'default' }), '生成页面集')
  await snapshotAllPages()
  await confirmEntitiesAndPageSets()
  const confirmed = assertOk(await request('POST', `/apps/${appId}/design/confirm`), '确认设计')
  expect((confirmed.project as { status: string }).status === 'confirmed', '设计未进入 confirmed')
}

async function snapshotAllPages(): Promise<void> {
  const current = await design()
  for (const set of current.pageSets) {
    for (const page of set.pages) {
      assertOk(
        await request('POST', `/apps/${appId}/design/pages/${page.id}/snapshot`, {
          imageBase64: `data:image/png;base64,${PNG.toString('base64')}`,
          html: `<div class="prototype">${page.title}</div>`
        }),
        `上传页面 PNG：${page.title}`
      )
    }
  }
}

async function confirmEntitiesAndPageSets(): Promise<void> {
  const current = await design()
  assertOk(
    await request('PUT', `/apps/${appId}/design/entities`, {
      entities: current.entities.map(entity => ({ ...entity, status: 'confirmed' }))
    }),
    '确认实体'
  )
  for (const set of current.pageSets) {
    assertOk(await request('PUT', `/apps/${appId}/design/page-sets/${set.id}`, { status: 'confirmed' }), '确认页面集')
  }
}

async function main(): Promise<void> {
  await import('../src/index')
  await waitForHealth()

  assertOk(await request('POST', '/apps', { id: appId, name: 'C1 变更冒烟应用', description: 'C1', backendPort: 8098 }), '创建应用')
  await fillRequirement()
  await prepareConfirmedDesign()
  console.log('准备：需求/设计已确认（1 实体 / 1 页面集 / 每页 PNG）')

  const first = assertOk(await request('POST', `/apps/${appId}/design/handoff/generate`), '生成交接包 v1')
  const firstHandoff = first.handoff as { version: number }
  expect(firstHandoff.version === 1, '首次交接包应为 v1')
  assertOk(await request('POST', `/apps/${appId}/complete`), '确认完成 #1')
  const completedV1 = await app()
  expect(completedV1.status === 'completed', `应用应 completed，实际 ${completedV1.status}`)
  expect(completedV1.changeSet?.seq === 1 && completedV1.changeSet.status === 'completed', 'Change Set #1 应已关闭')
  console.log(`初始开发：交接包 v1 · CS #1 · 应用 completed（${completedV1.completedAt}）`)

  // 发起变更 #2（需求+设计）
  const started = assertOk(
    await request('POST', `/apps/${appId}/change-sets`, { title: '变更 #2：客户等级', description: '新增等级维度', scope: 'requirements' }),
    '发起变更 #2'
  )
  const cs2 = started.changeSet as {
    id: string
    seq: number
    status: string
    baseRequirementsVersion: number
    baseDesignVersion: number
    baseHandoffVersion: number
    baseAppStatus: string
  }
  expect(cs2.seq === 2 && cs2.status === 'requirements', `#2 状态不正确：${JSON.stringify(cs2)}`)
  expect(cs2.baseHandoffVersion === 1, '#2 基线交接包应为 v1')
  expect(cs2.baseAppStatus === 'completed', '#2 应记录变更前应用状态')
  const afterStart = await app()
  expect(afterStart.status === 'requirements', `发起变更后应用应为 requirements，实际 ${afterStart.status}`)
  expect(afterStart.requirementDoc?.status === 'draft', '需求文档应回到 draft')
  expect(afterStart.designProject?.status === 'draft', '设计应回到 draft')
  expect(afterStart.completedAt === completedV1.completedAt, '应保留上一版完成时间')
  const secondStart = await request('POST', `/apps/${appId}/change-sets`, { title: '第二个', scope: 'requirements' })
  assertStatus(secondStart, 409, '第二次发起变更')
  const listed = assertOk(await request('GET', `/apps/${appId}/change-sets`), '读取变更历史')
  expect((listed.changeSets as unknown[]).length === 2, '变更历史应为 2 条')
  expect((listed.active as { seq: number }).seq === 2, 'active 应为 #2')
  console.log(
    `发起变更 #2：基线 需求 v${cs2.baseRequirementsVersion} / 设计 v${cs2.baseDesignVersion} / 交接包 v1 · 应用 requirements`
  )

  // 改需求 + 确认
  await saveEpics(
    '客户管理（改）',
    '创建客户',
    ['客户编号唯一', '客户名称必填', '等级必填'],
    '查询客户',
    ['能按名称筛选'],
    { story3Title: '维护客户等级', story3Acceptance: ['能新增等级'] }
  )
  assertOk(await request('POST', `/apps/${appId}/requirements-doc/confirm`), '确认需求 #2')
  const afterReqConfirm = await app()
  expect(afterReqConfirm.activeChangeSet?.status === 'design', `需求确认后变更单应为 design，实际 ${afterReqConfirm.activeChangeSet?.status}`)

  // 改设计（新增字段/页面规格）→ 同步输入 → 确认
  const designBefore = await design()
  const entity = designBefore.entities[0]
  const fields = entity.fields as Array<Record<string, unknown>>
  assertOk(
    await request('PUT', `/apps/${appId}/design/entities`, {
      entities: [
        {
          ...entity,
          status: 'confirmed',
          fields: fields.concat({ name: 'levelNote', label: '等级说明', type: 'string' })
        }
      ]
    }),
    '修改实体（新增字段）'
  )
  assertOk(await request('POST', `/apps/${appId}/design/input/sync`, { mode: 'additions' }), '同步设计输入')
  assertOk(await request('POST', `/apps/${appId}/design/confirm`), '确认设计 #2')
  console.log('变更 #2：需求已改并确认（STORY-003 新增）、设计新增字段、设计输入已同步并确认')

  const preview = assertOk(await request('POST', `/apps/${appId}/design/handoff/preview`), '预览变更交接包')
  const previewChangeSet = preview.changeSet as { seq: number; baselineHandoffVersion: number; status: string }
  expect(preview.canGenerate === true, '有 active 变更单时应允许生成')
  expect(previewChangeSet.seq === 2, `预览应绑定 CS #2，实际 #${previewChangeSet.seq}`)
  expect(previewChangeSet.baselineHandoffVersion === 1, '预览基线应为 v1')
  expect(previewChangeSet.status === 'development', '预览应反映生成后的 development 状态')
  const previewChanges = ((preview.files as Array<{ name: string; content?: string }>).find(file => file.name === '05-CHANGES.md')?.content ?? '')
  expect(previewChanges.includes('增量变更（变更单 #2）'), '预览 05-CHANGES 应是增量变更')
  expect(previewChanges.includes('STORY-003'), '预览 05-CHANGES 应列出新增 Story')
  console.log('预览：绑定 CS #2 · 基线 v1 · 05-CHANGES 含 STORY-003 增量')

  const generated = assertOk(await request('POST', `/apps/${appId}/design/handoff/generate`), '生成变更交接包 v2')
  const handoff2 = generated.handoff as { version: number }
  expect(handoff2.version === 2, `变更交接包应为 v2，实际 ${handoff2.version}`)
  expect(generated.baselineHandoffVersion === 1, '生成结果基线应为 v1')
  expect((generated.changeSet as { seq: number }).seq === 2, '生成应绑定 CS #2')
  const afterGenerate = await app()
  expect(afterGenerate.status === 'development', `生成后应用应为 development，实际 ${afterGenerate.status}`)
  expect(afterGenerate.activeChangeSet?.status === 'development', 'CS #2 应进入 development')

  const read = assertOk(await request('GET', `/apps/${appId}/design/handoff`), '读取交接包 v2')
  const files = read.files as Array<{ name: string; kind: string; content?: string }>
  const changesMd = files.find(file => file.name === '05-CHANGES.md')?.content ?? ''
  const readme = files.find(file => file.name === '00-README.md')?.content ?? ''
  const manifest = (read.handoff as { manifest: { changeSet: { seq: number; baselineHandoffVersion: number; currentHandoffVersion: number; changes: { total: number } } } }).manifest
  expect(changesMd.includes('增量变更（变更单 #2）'), '05-CHANGES 未标记增量变更')
  expect(changesMd.includes('STORY-003'), '05-CHANGES 未列出新增 Story')
  expect(changesMd.includes('levelNote'), '05-CHANGES 未列出新增字段')
  expect(!changesMd.includes('这是应用的首次开发'), '05-CHANGES 不应自称首次开发')
  expect(!changesMd.includes('ent-') && !changesMd.includes('ps-') && !changesMd.includes('pg-'), '05-CHANGES 不应泄露内部 ID')
  expect(readme.includes('变更 #2'), '00-README 应显示变更 #2')
  expect(manifest.changeSet.seq === 2 && manifest.changeSet.baselineHandoffVersion === 1, 'manifest 变更单基线/序号不正确')
  expect(manifest.changeSet.currentHandoffVersion === 2, 'manifest 当前版本应为 v2')
  expect(manifest.changeSet.changes.total > 0, 'manifest 应记录变更计数')
  const cs2Row = await request('GET', `/apps/${appId}/change-sets`)
  const cs2Saved = (assertOk(cs2Row, '读取变更单').changeSets as Array<{ id: string; seq: number; status: string; changesMd: string | null; summary: unknown }>).find(item => item.seq === 2)
  expect(cs2Saved?.status === 'development', '变更单应记录为 development')
  expect(!!cs2Saved?.changesMd && !!cs2Saved?.summary, '变更单应保存 changes_md/summary')
  console.log(`生成 v2：基线 v1 · 绑定 CS #2 · 05-CHANGES 增量（${manifest.changeSet.changes.total} 项）· manifest 计数`)

  if (process.env.CHANGE_SET_SMOKE_DEV === '1') {
    const session = await request('POST', `/apps/${appId}/development/session`)
    if (session.status >= 200 && session.status < 300) {
      const info = session.data as {
        session: { handoffVersion: number | null; changeSetId: string | null }
        defaultPrompt: string
      }
      expect(info.session.handoffVersion === 2, '开发会话未记录 handoff v2')
      expect(info.session.changeSetId === cs2.id, '开发会话未记录 CS #2')
      expect(info.defaultPrompt.includes('第 2 次变更'), '首条提示应为变更版')
      console.log('开发会话：handoff v2 / CS #2 / 首条提示“第 2 次变更”')
    } else {
      console.log(`开发会话创建跳过（HTTP ${session.status}）：${JSON.stringify(session.data)}`)
    }
  } else {
    console.log('开发会话创建未验证（CHANGE_SET_SMOKE_DEV=1 可开启）')
  }

  assertOk(await request('POST', `/apps/${appId}/complete`), '确认完成 #2')
  const completedV2 = await app()
  expect(completedV2.status === 'completed', '应用应 completed')
  expect(completedV2.activeChangeSet === null, '完成后不应有 active 变更单')
  expect(completedV2.changeSet?.seq === 2 && completedV2.changeSet.status === 'completed', 'CS #2 应关闭')
  console.log('完成 #2：应用 completed，CS #2 关闭（只关当前单）')

  // 发起变更 #3（仅设计）：切换模板后取消，验证模板恢复
  const baseTemplateId = (await design()).template.id
  const started3 = assertOk(
    await request('POST', `/apps/${appId}/change-sets`, { title: '变更 #3：仅调整设计', scope: 'design' }),
    '发起变更 #3'
  )
  const cs3 = started3.changeSet as {
    id: string
    seq: number
    status: string
    scope: string
    baseDesignVersion: number
    baseHandoffVersion: number
    canCancel: boolean
    cancelBlockedReason: string | null
  }
  expect(cs3.seq === 3 && cs3.status === 'design', `#3 状态不正确：${JSON.stringify(cs3)}`)
  expect(cs3.canCancel === false, '刚发起时不应允许取消（没有已确认差异）')
  expect(!!cs3.cancelBlockedReason, '不可取消时应给出原因')
  const afterStart3 = await app()
  expect(afterStart3.status === 'design', '仅设计变更应进入 design 阶段')
  expect(afterStart3.requirementDoc?.status === 'confirmed', '仅设计变更不应改动需求文档')

  // 改一半（未确认设计）不能取消
  const cancelEarly = await request('POST', `/apps/${appId}/change-sets/${cs3.id}/cancel`)
  assertStatus(cancelEarly, 409, '未确认差异时取消')

  // 切换原型模板 + 修改实体 → 确认设计 → 允许取消，并恢复模板/实体
  assertOk(await request('PUT', `/apps/${appId}/design/template`, { templateId: 'builtin-prototype-minimal' }), '切换原型模板')
  const design3 = await design()
  const entity3 = design3.entities[0]
  assertOk(
    await request('PUT', `/apps/${appId}/design/entities`, {
      entities: [
        {
          ...entity3,
          status: 'confirmed',
          fields: (entity3.fields as Array<Record<string, unknown>>).concat({ name: 'vipNote', label: 'VIP 备注', type: 'string' })
        }
      ]
    }),
    '修改设计（#3）'
  )
  assertOk(await request('POST', `/apps/${appId}/design/confirm`), '确认设计 #3')
  const beforeCancel = await app()
  const docVersionBeforeCancel = beforeCancel.requirementDoc?.version ?? 0
  expect(beforeCancel.activeChangeSet?.status === 'design', '确认设计后 CS #3 应保持 design')
  expect(beforeCancel.activeChangeSet?.canCancel === true, '已确认设计差异后应允许取消')

  const cancelled = assertOk(await request('POST', `/apps/${appId}/change-sets/${cs3.id}/cancel`), '取消变更 #3')
  const cancelledCs = cancelled.changeSet as { status: string }
  const restored = cancelled.restored as { templateId: string | null }
  expect(cancelledCs.status === 'cancelled', '变更单应为 cancelled')
  expect(restored.templateId === baseTemplateId, `取消应恢复基线模板（${baseTemplateId}），实际 ${restored.templateId}`)
  const afterCancel = await app()
  expect(afterCancel.status === 'completed', `取消后应用应恢复到 completed，实际 ${afterCancel.status}`)
  expect(afterCancel.activeChangeSet === null, '取消后不应有 active 变更单')
  expect(afterCancel.completedAt === completedV2.completedAt, '取消后应恢复上一版完成时间')
  const designAfterCancel = await design()
  expect(designAfterCancel.status === 'confirmed', '取消后设计应恢复为 confirmed')
  expect(designAfterCancel.template.id === baseTemplateId, '取消后原型模板应回到基线')
  expect(designAfterCancel.version > cs3.baseDesignVersion, '取消应追加恢复版本')
  const cancelledFields = designAfterCancel.entities[0].fields as Array<{ name: string }>
  expect(!cancelledFields.some(field => field.name === 'vipNote'), '取消应移除变更中新增字段')
  const docAfterCancel = assertOk(await request('GET', `/apps/${appId}/requirements-doc`), '读取需求文档（取消后）') as { doc: { version: number; status: string } }
  expect(docAfterCancel.doc.version >= docVersionBeforeCancel, '取消不应删除版本历史')
  expect(docAfterCancel.doc.status === 'confirmed', '取消后需求文档应保持 confirmed')
  console.log(`取消 #3：模板/设计/应用恢复基线（模板 ${baseTemplateId} · 设计 v${cs3.baseDesignVersion} → v${designAfterCancel.version}），CS #3 cancelled`)

  // 发起变更 #4（仅设计）→ 升级为需求+设计 → 确认需求 → 取消
  const started4 = assertOk(
    await request('POST', `/apps/${appId}/change-sets`, { title: '变更 #4：先设计后升级', scope: 'design' }),
    '发起变更 #4'
  )
  const cs4 = started4.changeSet as { id: string; seq: number; status: string; scope: string; canCancel: boolean }
  expect(cs4.seq === 4 && cs4.scope === 'design', '#4 应为仅设计')
  const upgradeReject = await request('POST', `/apps/${appId}/change-sets/${cs4.id}/scope`, { scope: 'design' })
  assertStatus(upgradeReject, 400, '非法升级目标')
  const upgraded = assertOk(
    await request('POST', `/apps/${appId}/change-sets/${cs4.id}/scope`, { scope: 'requirements' }),
    '升级为需求+设计'
  )
  const cs4After = upgraded.changeSet as { scope: string; status: string }
  expect(cs4After.scope === 'requirements' && cs4After.status === 'requirements', '升级后 scope/status 不正确')
  const appUpgraded = upgraded.app as { status: string; requirementDoc: { status: string } | null }
  expect(appUpgraded.status === 'requirements', '升级后应用应回到 requirements')
  expect(appUpgraded.requirementDoc?.status === 'draft', '升级后需求文档应回到 draft')
  const upgradeAgain = await request('POST', `/apps/${appId}/change-sets/${cs4.id}/scope`, { scope: 'requirements' })
  assertStatus(upgradeAgain, 409, '重复升级')
  const docBeforeUpgradeEdit = assertOk(await request('GET', `/apps/${appId}/requirements-doc`), '读取需求文档（升级后）') as {
    doc: { version: number }
  }
  await saveEpics('客户管理（#4 升级）', '创建客户', ['客户编号唯一', '客户名称必填'], '查询客户（#4）', ['能按名称筛选'])
  assertOk(await request('POST', `/apps/${appId}/requirements-doc/confirm`), '升级后确认需求')
  const docAfterUpgradeEdit = assertOk(await request('GET', `/apps/${appId}/requirements-doc`), '读取需求文档（确认后）') as {
    doc: { version: number }
  }
  expect(docAfterUpgradeEdit.doc.version > docBeforeUpgradeEdit.doc.version, '升级后修改需求应产生新版本')
  const cancel4 = assertOk(await request('POST', `/apps/${appId}/change-sets/${cs4.id}/cancel`), '取消变更 #4')
  expect((cancel4.changeSet as { status: string }).status === 'cancelled', '#4 应取消')
  const appAfter4 = await app()
  expect(appAfter4.status === 'completed', '取消 #4 后应恢复 completed')
  const docAfter4 = assertOk(await request('GET', `/apps/${appId}/requirements-doc`), '读取需求文档（取消 #4 后）') as {
    doc: { version: number; status: string }
  }
  expect(docAfter4.doc.status === 'confirmed', '取消 #4 后需求文档应恢复 confirmed')
  expect(docAfter4.doc.version > docAfterUpgradeEdit.doc.version, '取消 #4 应追加恢复版本')
  console.log('scope 升级：仅设计 → 需求+设计（应用/文档回 draft，重复升级拒绝），确认需求后取消恢复')

  const history = assertOk(await request('GET', `/apps/${appId}/change-sets`), '读取变更历史（取消后）') as {
    changeSets: Array<{ seq: number; status: string }>
    active: unknown
  }
  expect(history.changeSets.length === 4, '变更历史应为 4 条')
  expect(history.changeSets.find(item => item.seq === 3)?.status === 'cancelled', '#3 应记录 cancelled')
  expect(history.changeSets.find(item => item.seq === 4)?.status === 'cancelled', '#4 应记录 cancelled')
  expect(history.active === null, '取消后不应有 active')

  // 取消后没有 active 变更单：生成被拒绝，预览仍允许（提示先发起变更）
  const blocked = await request('POST', `/apps/${appId}/design/handoff/generate`)
  assertStatus(blocked, 409, '无 active 变更单时生成')
  const previewAfterCancel = assertOk(await request('POST', `/apps/${appId}/design/handoff/preview`), '取消后预览')
  expect(previewAfterCancel.canGenerate === false, '无 active 变更单时预览应提示不可生成')
  console.log('取消后：生成被拒绝、预览允许（canGenerate=false）')

  assertOk(await request('DELETE', `/apps/${appId}?confirm=true`), '删除应用')
  assertStatus(await request('GET', `/apps/${appId}`), 404, '删除后应用')
  console.log('删除应用：登记/目录/需求/设计/交接包/变更单清理')
}

main()
  .then(() => {
    console.log('\nC1 变更循环冒烟通过')
    process.exit(0)
  })
  .catch(error => {
    console.error('\nC1 变更循环冒烟失败：', error)
    process.exit(1)
  })
