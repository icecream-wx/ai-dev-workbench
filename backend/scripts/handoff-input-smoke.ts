/**
 * 需求 → 设计交接（H1—H4）冒烟
 *
 * 真实 Express + 临时 SQLite/projects：
 * 创建应用 → 结构化 Scenes/Epics/Stories → 确认需求
 * → DesignInputBundle（版本/hash/计数）→ 实体/页面 requirementRefs
 * → 覆盖度 → 重新编辑需求 → diff/stale → 仅同步新增 / 重生成受影响
 * → 删除应用清理。
 *
 * 运行：npm run smoke:handoff-input --prefix backend
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-handoff-input-smoke-'))
const port = Number(process.env.HANDOFF_INPUT_SMOKE_PORT ?? 3409)
process.env.PORT = String(port)
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_PORT = String(port + 1000)
process.env.OPENCODE_AUTO_START = 'false'

const base = `http://127.0.0.1:${port}`
const appId = 'handoff-input-smoke'

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
  const text = Buffer.from(await res.arrayBuffer()).toString('utf8')
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

const outline = {
  scenes: [{ id: 'SCENE-001', title: '订单管理', description: '销售维护订单并跟踪状态' }],
  epics: [
    { id: 'EPIC-001', title: '订单创建', goal: '支持业务员创建订单', priority: 'P0', sceneId: 'SCENE-001' },
    { id: 'EPIC-002', title: '订单查询', goal: '支持按条件查询订单', priority: 'P1', sceneId: 'SCENE-001' }
  ],
  stories: [
    {
      id: 'STORY-001',
      epicId: 'EPIC-001',
      title: '创建订单',
      description: '作为业务员，我希望创建订单',
      acceptance: ['必填字段校验'],
      priority: 'P0'
    },
    {
      id: 'STORY-002',
      epicId: 'EPIC-001',
      title: '编辑订单',
      description: '作为业务员，我希望修改订单',
      acceptance: ['保存后列表可见'],
      priority: 'P1'
    },
    {
      id: 'STORY-003',
      epicId: 'EPIC-002',
      title: '查询订单',
      description: '作为主管，我希望按客户查询订单',
      acceptance: ['能按客户筛选'],
      priority: 'P1'
    }
  ]
}

async function fillAndConfirm(): Promise<void> {
  const initial = assertOk(await request('GET', `/apps/${appId}/requirements-doc`), '初始化需求文档')
  const sections = initial.sections as Array<{ sectionKey: string; required: boolean; kind: string }>
  for (const section of sections) {
    if (section.kind === 'scenes' || section.kind === 'epics') continue
    if (!section.required) continue
    const markdown =
      section.kind === 'roles'
        ? '- 业务员：创建和维护订单\n- 主管：查询全部订单'
        : `冒烟内容：${section.sectionKey}`
    assertOk(
      await request('PUT', `/apps/${appId}/requirements-doc/sections/${section.sectionKey}`, { markdown }),
      `保存章节 ${section.sectionKey}`
    )
  }
  assertOk(await request('PUT', `/apps/${appId}/requirements-doc/sections/scenes`, { data: { scenes: outline.scenes, epics: [], stories: [] } }), '保存结构化场景')
  const saved = assertOk(
    await request('PUT', `/apps/${appId}/requirements-doc/sections/epics`, { data: { scenes: [], epics: outline.epics, stories: outline.stories } }),
    '保存结构化 Epics/Stories'
  )
  const section = (saved.sections as Array<{ sectionKey: string; markdown: string; data?: { epics: Array<{ id: string }> } }>).find(
    item => item.sectionKey === 'epics'
  )
  if (section?.data?.epics[0]?.id !== 'EPIC-001') throw new Error('结构化 Epic 稳定 ID 未保留')
  if (!/### EPIC-001 订单创建/.test(section?.markdown ?? '')) throw new Error('结构化章节未渲染稳定 ID')
  assertOk(await request('POST', `/apps/${appId}/requirements-doc/confirm`), '确认需求文档')
}

async function createDesign(): Promise<Record<string, unknown>> {
  const design = assertOk(await request('GET', `/apps/${appId}/design`), '读取设计项目')
  const input = design.input as { id: string; docVersion: number; docHash: string; structure: string; scenes: unknown[]; epics: unknown[]; stories: unknown[] } | null
  if (!input) throw new Error('设计项目缺少设计输入')
  if (input.structure !== 'prd') throw new Error(`设计输入结构应为 prd，实际 ${input.structure}`)
  if (input.scenes.length !== 1 || input.epics.length !== 2 || input.stories.length !== 3) {
    throw new Error(`设计输入计数不正确：${input.scenes.length}/${input.epics.length}/${input.stories.length}`)
  }
  if (!/^[a-f0-9]{64}$/.test(input.docHash)) throw new Error('设计输入 hash 不正确')
  if (design.sourceInputId !== input.id) throw new Error('设计项目未绑定设计输入')
  const stale = design.stale as { stale: boolean }
  if (stale.stale) throw new Error('刚生成的设计输入不应过期')
  console.log(`设计输入：${input.id}（v${input.docVersion}，1 场景 / 2 Epics / 3 Stories，hash ${input.docHash.slice(0, 8)}…）`)
  return design
}

async function main(): Promise<void> {
  await import('../src/index')
  await waitForHealth()

  assertOk(await request('POST', '/apps', { id: appId, name: '交接输入冒烟应用', description: 'H1—H4', backendPort: 8098 }), '创建应用')
  await fillAndConfirm()
  console.log('需求结构化：SCENE-001 / EPIC-001·002 / STORY-001·002·003，已确认')

  await createDesign()

  let design = assertOk(
    await request('PUT', `/apps/${appId}/design/entities`, {
      entities: [
        {
          name: '订单',
          tableName: 'biz_order',
          description: '订单主表',
          requirementRefs: ['STORY-001', 'STORY-002'],
          sourceSections: ['epics', 'rules'],
          fields: [
            { name: 'orderNo', label: '订单号', type: 'string', required: true, unique: true },
            { name: 'amount', label: '金额', type: 'decimal', precision: 2 },
            { name: 'status', label: '状态', type: 'enum', options: ['草稿', '已提交'] }
          ],
          relations: []
        },
        {
          name: '客户',
          tableName: 'biz_customer',
          description: '客户主表',
          requirementRefs: [],
          fields: [
            { name: 'id', label: '主键', type: 'string', required: true, unique: true },
            { name: 'name', label: '名称', type: 'string' }
          ],
          relations: []
        }
      ]
    }),
    '保存实体'
  )
  const order = (design.entities as Array<{ id: string; name: string; requirementRefs: string[] }>).find(entity => entity.name === '订单')
  if (order?.requirementRefs.join(',') !== 'STORY-001,STORY-002') throw new Error('实体 requirementRefs 未保存')
  console.log('实体：requirementRefs/sourceSections 落库')

  const generated = assertOk(await request('POST', `/apps/${appId}/design/page-sets/generate`, { mode: 'default' }), '生成页面集')
  design = generated.project as Record<string, unknown>
  const sets = design.pageSets as Array<{ id: string; title: string; epicId: string; storyIds: string[]; pages: Array<{ requirementRefs: string[] }> }>
  if (sets.length !== 2) throw new Error(`页面集数量不正确：${sets.length}`)
  if (sets.map(set => set.epicId).join(',') !== 'EPIC-001,EPIC-002') throw new Error('页面集未按 Epic 组织')
  if (sets[0].storyIds.join(',') !== 'STORY-001,STORY-002') throw new Error('页面集 storyIds 不正确')
  if (!sets[0].pages.every(page => page.requirementRefs.length)) throw new Error('页面 requirementRefs 为空')
  console.log('页面集：按 EPIC 组织，页面带 requirementRefs')

  const coverage = assertOk(await request('GET', `/apps/${appId}/design/coverage`), '读取覆盖度')
  const stats = (coverage.coverage as { stats: { storyCount: number; coveredStoryCount: number }; unlinkedEntities: unknown[] }).stats
  if (stats.storyCount !== 3 || stats.coveredStoryCount !== 3) throw new Error('Story 覆盖度不正确')
  if (!(coverage.coverage as { unlinkedEntities: unknown[] }).unlinkedEntities.length) throw new Error('应提示无需求依据的实体')
  console.log('覆盖度：3/3 Stories 已覆盖；客户实体提示无需求依据')

  // 先完成设计确认：用于验证“已确认设计 + 需求 reopen”不会留下 stale confirmed 状态
  let currentDesign = assertOk(await request('GET', `/apps/${appId}/design`), '读取设计项目')
  assertOk(
    await request('PUT', `/apps/${appId}/design/entities`, {
      entities: (currentDesign.entities as Array<Record<string, unknown>>).map(entity => ({ ...entity, status: 'confirmed' }))
    }),
    '确认实体'
  )
  currentDesign = assertOk(await request('GET', `/apps/${appId}/design`), '读取页面集')
  for (const set of currentDesign.pageSets as Array<Record<string, unknown>>) {
    assertOk(await request('PUT', `/apps/${appId}/design/page-sets/${set.id}`, { status: 'confirmed' }), '确认页面集')
  }
  const designConfirmed = assertOk(await request('POST', `/apps/${appId}/design/confirm`), '确认设计')
  if ((designConfirmed.project as { status: string }).status !== 'confirmed') throw new Error('设计应已确认')

  // 需求变更：改名 + 新增 Story（reopen 必须把已确认设计退回 draft）
  assertOk(await request('POST', `/apps/${appId}/requirements-doc/reopen`), '重新编辑需求')
  const reopenedDesign = assertOk(await request('GET', `/apps/${appId}/design`), '读取 reopen 后设计')
  if ((reopenedDesign as { status: string }).status !== 'draft') throw new Error('需求 reopen 后已确认设计应退回 draft')
  if ((reopenedDesign as { confirmedAt: string | null }).confirmedAt) throw new Error('需求 reopen 后设计 confirmedAt 应清空')
  console.log('需求 reopen：已确认设计退回 draft（stale 漏洞防护）')
  const changed = JSON.parse(JSON.stringify(outline)) as typeof outline
  changed.stories[0].title = '创建订单（改）'
  changed.stories = changed.stories.filter(story => story.id !== 'STORY-003')
  changed.stories.push({
    id: 'STORY-004',
    epicId: 'EPIC-002',
    title: '取消订单',
    description: '作为主管，我希望取消订单',
    acceptance: ['取消后状态变更'],
    priority: 'P1'
  })
  assertOk(
    await request('PUT', `/apps/${appId}/requirements-doc/sections/epics`, { data: { scenes: [], epics: changed.epics, stories: changed.stories } }),
    '修改结构化 Stories'
  )
  assertOk(await request('POST', `/apps/${appId}/requirements-doc/confirm`), '重新确认需求')

  design = assertOk(await request('GET', `/apps/${appId}/design`), '读取设计项目')
  if (!(design.stale as { stale: boolean }).stale) throw new Error('需求变更后设计输入应标记过期')
  const blockedConfirm = await request('POST', `/apps/${appId}/design/confirm`)
  if (blockedConfirm.status !== 409) throw new Error(`stale 时确认设计应返回 409，实际 ${blockedConfirm.status}`)
  console.log('需求变更：设计输入 stale；确认设计被拒绝（409）')

  const preview = assertOk(await request('POST', `/apps/${appId}/design/input/sync`, { mode: 'preview' }), '预览需求 diff')
  const diff = preview.diff as { totals: { added: number; removed: number; changed: number }; stories: { changed: unknown[]; removed: unknown[]; added: unknown[] } }
  if (diff.totals.changed + diff.totals.added + diff.totals.removed === 0) throw new Error('diff 为空')
  if (!diff.stories.changed.length) throw new Error('应检出 Story 修改')
  if (!diff.stories.removed.length) throw new Error('应检出 Story 删除')
  if (!diff.stories.added.length) throw new Error('应检出 Story 新增')
  const affected = preview.affected as { entities: Array<{ name: string }> }
  if (!affected.entities.some(entity => entity.name === '订单')) throw new Error('应检出受影响实体')
  if (!(preview.stale as { stale: boolean }).stale) throw new Error('preview 不应静默同步')
  console.log(`diff：+${diff.totals.added} -${diff.totals.removed} ~${diff.totals.changed}；受影响实体 ${affected.entities.length}`)

  const additions = assertOk(await request('POST', `/apps/${appId}/design/input/sync`, { mode: 'additions' }), '仅同步新增项')
  if ((additions.stale as { stale: boolean }).stale) throw new Error('同步后不应过期')
  const afterAdditions = additions.project as { entities: Array<{ name: string; requirementRefs: string[] }> }
  if (afterAdditions.entities.find(entity => entity.name === '订单')?.requirementRefs.join(',') !== 'STORY-001,STORY-002') {
    throw new Error('仅同步新增项不应改动实体引用')
  }
  console.log('同步：additions 绑定新输入，设计内容未覆盖')
  const reconfirmed = assertOk(await request('POST', `/apps/${appId}/design/confirm`), '同步后再次确认设计')
  if ((reconfirmed.project as { status: string }).status !== 'confirmed') throw new Error('同步后设计应可再次确认')
  console.log('同步后设计可再次确认')

  // 第二次变更：删除 STORY-002，验证 regenerate 清理失效引用
  assertOk(await request('POST', `/apps/${appId}/requirements-doc/reopen`), '再次重新编辑需求')
  const epicsNow = assertOk(await request('GET', `/apps/${appId}/requirements-doc`), '读取需求文档')
  const epicsSectionNow = (epicsNow.sections as Array<{ sectionKey: string; data?: typeof outline }>).find(
    section => section.sectionKey === 'epics'
  )
  const secondChange = JSON.parse(JSON.stringify(epicsSectionNow?.data ?? { scenes: [], epics: changed.epics, stories: changed.stories })) as typeof outline
  secondChange.stories = secondChange.stories.filter(story => story.id !== 'STORY-002')
  assertOk(
    await request('PUT', `/apps/${appId}/requirements-doc/sections/epics`, {
      data: { scenes: [], epics: secondChange.epics, stories: secondChange.stories }
    }),
    '删除 STORY-002'
  )
  for (const section of (assertOk(await request('GET', `/apps/${appId}/requirements-doc`), '读取需求文档').sections as Array<{ sectionKey: string; required: boolean; markdown: string }>)) {
    if (!section.required || section.markdown.trim()) continue
    assertOk(
      await request('PUT', `/apps/${appId}/requirements-doc/sections/${section.sectionKey}`, { markdown: `内容-${section.sectionKey}` }),
      `补全章节 ${section.sectionKey}`
    )
  }
  assertOk(await request('POST', `/apps/${appId}/requirements-doc/confirm`), '再次确认需求')
  const secondPreview = assertOk(await request('POST', `/apps/${appId}/design/input/sync`, { mode: 'preview' }), '预览第二次变更')
  if (!(secondPreview.diff as { stories: { removed: Array<{ id: string }> } }).stories.removed.some(item => item.id === 'STORY-002')) {
    throw new Error('第二次变更应检出 STORY-002 删除')
  }

  const regenerate = assertOk(await request('POST', `/apps/${appId}/design/input/sync`, { mode: 'regenerate' }), '重生成受影响项')
  const project = regenerate.project as {
    entities: Array<{ name: string; requirementRefs: string[]; status: string }>
    pageSets: Array<{ epicId: string; storyIds: string[]; pages: Array<{ requirementRefs: string[] }> }>
  }
  const cleaned = project.entities.find(entity => entity.name === '订单')
  if (cleaned?.requirementRefs.join(',') !== 'STORY-001') throw new Error('regenerate 应只保留仍存在的引用')
  if (cleaned?.status !== 'draft') throw new Error('受影响实体应置为草稿')
  const set1 = project.pageSets.find(set => set.epicId === 'EPIC-002')
  if (set1?.storyIds.join(',') !== 'STORY-004') throw new Error('页面集 storyIds 未按新输入更新')
  if (!set1?.pages.every(page => page.requirementRefs.join(',') === 'STORY-004')) throw new Error('页面引用未清理/更新')
  console.log('regenerate：清理失效引用、受影响项置草稿（不静默覆盖内容）')

  assertOk(await request('DELETE', `/apps/${appId}?confirm=true`), '删除应用')
  const gone = await request('GET', `/apps/${appId}`)
  if (gone.status !== 404) throw new Error('删除后应用应 404')
  const inputsGone = await request('GET', `/apps/${appId}/design/input`)
  if (inputsGone.status !== 404) throw new Error('删除后设计输入应不可读')
  console.log('删除应用：登记/目录/设计输入清理')
}

main()
  .then(() => {
    console.log('\n需求→设计交接（H1—H4）冒烟通过')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n需求→设计交接冒烟失败：', error)
    process.exit(1)
  })
