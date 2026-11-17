/**
 * U7 开发阶段 API 冒烟（M6b：单模块平铺回归 + 两模块两层阶段）
 *
 * 真实 Express + 临时 SQLite/projects + 真实 opencode 2.2.5（**不调用模型**）：
 * 1) 单模块 large 交接包 → manifest.phases 平铺（base + Epic）→ 生成/开始/切换/完成/跳过/恢复/删除（U7-1 回归）
 * 2) 两模块 large 交接包 → manifest.phases 含 base + module:<MOD> + module 内 Epic + parentKey；
 *    phases/generate 写 module_id/parent_key/phase_kind；模块阶段 start/complete/skip/reopen → 409；
 *    Epic 会话标题/brief 带模块；previous summary 只取同模块；modules 汇总/状态派生；删除清理。
 *
 * 运行：npm run smoke:dev-phases --prefix backend
 * 可选环境变量：DEV_PHASES_SMOKE_PORT（默认 3418）
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-dev-phases-smoke-'))
const port = Number(process.env.DEV_PHASES_SMOKE_PORT ?? 3418)
process.env.PORT = String(port)
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_PORT = String(port + 1000)
process.env.OPENCODE_AUTO_START = 'true'

const base = `http://127.0.0.1:${port}`
const appId = 'dev-phases-smoke'
const appName = '开发阶段冒烟'
const multiAppId = 'dev-phases-smoke-mod'
const multiAppName = '开发阶段多模块冒烟'
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03])

const EPICS = ['客户管理', '订单管理', '商品管理']
const ENTITIES = [
  { name: '客户', tableName: 'biz_customer', refs: ['STORY-001', 'STORY-002', 'STORY-003', 'STORY-004'] },
  { name: '订单', tableName: 'biz_order', refs: ['STORY-005', 'STORY-006', 'STORY-007'] },
  { name: '商品', tableName: 'biz_product', refs: ['STORY-008', 'STORY-009', 'STORY-010'] }
]

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
  const text = await res.text()
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

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function deepEqual(actual: unknown, expected: unknown, message: string): void {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${message}（实际 ${JSON.stringify(actual)}）`)
}

function equal(actual: unknown, expected: unknown, message: string): void {
  assert(actual === expected, `${message}（期望 ${String(expected)}，实际 ${String(actual)}）`)
}

async function waitForHealth(): Promise<void> {
  for (let index = 0; index < 120; index += 1) {
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

function moduleQuery(moduleId: string): string {
  return `?moduleId=${encodeURIComponent(moduleId)}`
}

// ---- 单模块（U7-1 回归） ----

async function fillRequirement(): Promise<void> {
  const markdown: Record<string, string> = {
    meta: '- 产品：U7-1 开发阶段冒烟\n- 作者：测试\n- 日期：2026-11-12\n- 版本：v1\n- 状态：已确认',
    problem: '大交接包需要按阶段组织开发会话。',
    goals: '能按需生成阶段、开始/完成/跳过/重新打开，并给会话打阶段标签。',
    users: '- 开发者：按阶段推进开发',
    scope: '- 本期做：阶段生成/会话/摘要入口\n- 不做：阶段门禁',
    rules: '- 同一时间只有一个 active 会话；阶段完成不归档',
    pages: '- 客户列表、创建客户、编辑客户；订单列表、创建订单；商品列表、创建商品',
    acceptance: '- 阶段可生成并开始\n- 会话带阶段标签\n- 完成/跳过/重新打开可用'
  }
  const initial = assertOk(await request('GET', `/apps/${appId}/requirements-doc`), '初始化需求文档')
  const sections = initial.sections as Array<{ sectionKey: string; required: boolean }>
  for (const section of sections) {
    if (section.sectionKey === 'scenes') {
      assertOk(
        await request('PUT', `/apps/${appId}/requirements-doc/sections/scenes`, {
          data: { scenes: EPICS.map(title => ({ title, description: `${title}场景` })), epics: [], stories: [] }
        }),
        '保存场景'
      )
      continue
    }
    if (section.sectionKey === 'epics') {
      const epics = EPICS.map((title, index) => ({
        id: `EPIC-${String(index + 1).padStart(3, '0')}`,
        title,
        goal: `支持${title}`,
        priority: 'P0'
      }))
      const stories = Array.from({ length: 10 }, (_value, index) => {
        const epicIndex = index < 4 ? 0 : index < 7 ? 1 : 2
        return {
          id: `STORY-${String(index + 1).padStart(3, '0')}`,
          epicId: `EPIC-${String(epicIndex + 1).padStart(3, '0')}`,
          title: `${EPICS[epicIndex]}故事 ${index + 1}`,
          description: `${EPICS[epicIndex]}相关操作 ${index + 1}`,
          acceptance: ['可操作', '有加载/空状态'],
          priority: 'P0'
        }
      })
      assertOk(
        await request('PUT', `/apps/${appId}/requirements-doc/sections/epics`, { data: { scenes: [], epics, stories } }),
        '保存 Epic/Story'
      )
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

async function prepareConfirmedDesign(): Promise<{ pageCount: number }> {
  assertOk(await request('GET', `/apps/${appId}/design`), '设计项目初始化')
  assertOk(
    await request('PUT', `/apps/${appId}/design/entities`, {
      entities: ENTITIES.map(entity => ({
        name: entity.name,
        tableName: entity.tableName,
        description: `${entity.name}主表`,
        requirementRefs: entity.refs,
        fields: [
          { name: 'id', label: '主键', type: 'string', length: 32, required: true, unique: true },
          { name: 'name', label: `${entity.name}名称`, type: 'string', required: true },
          { name: 'status', label: '状态', type: 'string', required: false }
        ]
      }))
    }),
    '保存实体'
  )
  const generated = assertOk(
    await request('POST', `/apps/${appId}/design/page-sets/generate`, { mode: 'default' }),
    '生成页面集'
  )
  const pageSets = (generated.project as { pageSets: Array<{ pages: Array<{ id: string; title: string }> }> }).pageSets
  const pages = pageSets.flatMap(set => set.pages)
  for (const page of pages) {
    assertOk(
      await request('POST', `/apps/${appId}/design/pages/${page.id}/snapshot`, {
        imageBase64: `data:image/png;base64,${PNG.toString('base64')}`,
        html: `<div class="prototype">${page.title}</div>`
      }),
      `上传页面 PNG：${page.title}`
    )
  }
  const current = assertOk(await request('GET', `/apps/${appId}/design`), '读取页面集')
  const entities = (current.entities as Array<Record<string, unknown>>).map(entity => ({ ...entity, status: 'confirmed' }))
  assertOk(await request('PUT', `/apps/${appId}/design/entities`, { entities }), '确认实体')
  for (const set of current.pageSets as Array<{ id: string }>) {
    assertOk(await request('PUT', `/apps/${appId}/design/page-sets/${set.id}`, { status: 'confirmed' }), '确认页面集')
  }
  assertOk(await request('POST', `/apps/${appId}/design/confirm`), '确认设计')
  return { pageCount: pages.length }
}

// ---- 两模块（M6b） ----

async function fillMultiRequirements(): Promise<{ moduleA: string; moduleB: string }> {
  assertOk(await request('POST', '/apps', { id: multiAppId, name: multiAppName, description: 'M6b', backendPort: 8103 }), '创建多模块应用')
  assertOk(await request('GET', `/apps/${multiAppId}/requirements-doc`), '初始化多模块需求文档')
  const modules = assertOk(await request('GET', `/apps/${multiAppId}/requirements-modules`), '读取模块')
  const moduleA = String(modules.defaultModuleId ?? '')
  assert(Boolean(moduleA), '缺少默认模块')
  assertOk(
    await request('PATCH', `/apps/${multiAppId}/requirements-modules/${encodeURIComponent(moduleA)}`, { title: '商品管理' }),
    '重命名默认模块'
  )
  const created = assertOk(await request('POST', `/apps/${multiAppId}/requirements-modules`, { title: '订单管理' }), '新增模块')
  const moduleB = String((created.module as { id: string }).id)

  const fill = async (
    moduleId: string,
    tag: string,
    epics: Array<{ id: string; title: string }>,
    storyBase: number,
    extraScenes: Array<{ title: string; description: string }> = []
  ): Promise<void> => {
    const payload = assertOk(
      await request('GET', `/apps/${multiAppId}/requirements-doc${moduleQuery(moduleId)}`),
      '读取模块文档'
    )
    const sections = (payload.sections ?? []) as Array<{ sectionKey: string; required: boolean }>
    for (const section of sections) {
      if (section.sectionKey === 'scenes') {
        assertOk(
          await request('PUT', `/apps/${multiAppId}/requirements-doc/sections/scenes${moduleQuery(moduleId)}`, {
            data: {
              scenes: [
                ...epics.map(epic => ({ title: `${epic.title}场景`, description: `${epic.title}场景` })),
                ...extraScenes
              ],
              epics: [],
              stories: []
            }
          }),
          '保存模块场景'
        )
        continue
      }
      if (section.sectionKey === 'epics') {
        const stories = Array.from({ length: 5 }, (_value, index) => {
          const epicIndex = Math.min(Math.floor((index * epics.length) / 5), epics.length - 1)
          const epic = epics[epicIndex]
          return {
            id: `STORY-${String(storyBase + index).padStart(3, '0')}`,
            epicId: epic.id,
            title: `${tag}故事 ${index + 1}`,
            description: `${tag}操作 ${index + 1}`,
            acceptance: ['可操作'],
            priority: 'P0'
          }
        })
        assertOk(
          await request('PUT', `/apps/${multiAppId}/requirements-doc/sections/epics${moduleQuery(moduleId)}`, {
            data: {
              scenes: [],
              epics: epics.map(epic => ({ id: epic.id, title: epic.title, goal: `支持${epic.title}`, priority: 'P0' })),
              stories
            }
          }),
          '保存模块 Epic/Story'
        )
        continue
      }
      if (!section.required) continue
      assertOk(
        await request('PUT', `/apps/${multiAppId}/requirements-doc/sections/${section.sectionKey}${moduleQuery(moduleId)}`, {
          markdown: `${tag}：${section.sectionKey}`
        }),
        '保存模块章节'
      )
    }
    assertOk(await request('POST', `/apps/${multiAppId}/requirements-doc/confirm${moduleQuery(moduleId)}`), '确认模块需求')
  }

  await fill(
    moduleA,
    '商品',
    [
      { id: 'EPIC-001', title: '商品档案' },
      { id: 'EPIC-002', title: '库存管理' },
      { id: 'EPIC-004', title: '商品报表' }
    ],
    1
  )
  await fill(moduleB, '订单', [{ id: 'EPIC-003', title: '订单管理' }], 6)
  assertOk(await request('POST', `/apps/${multiAppId}/requirements-bundle/confirm`), '完成多模块需求')
  return { moduleA, moduleB }
}

async function prepareMultiDesign(moduleA: string, moduleB: string): Promise<{ pageCount: number }> {
  const prepare = async (
    moduleId: string,
    tag: string,
    entities: Array<{ name: string; tableName: string }>
  ): Promise<number> => {
    assertOk(await request('GET', `/apps/${multiAppId}/design${moduleQuery(moduleId)}`), '初始化模块设计')
    assertOk(
      await request('PUT', `/apps/${multiAppId}/design/entities${moduleQuery(moduleId)}`, {
        entities: entities.map(entity => ({
          name: entity.name,
          tableName: entity.tableName,
          description: `${entity.name}主表`,
          requirementRefs: [],
          fields: [
            { name: 'id', label: '主键', type: 'string', length: 32, required: true, unique: true },
            { name: 'name', label: `${entity.name}名称`, type: 'string', required: true }
          ]
        }))
      }),
      '保存模块实体'
    )
    const generated = assertOk(
      await request('POST', `/apps/${multiAppId}/design/page-sets/generate${moduleQuery(moduleId)}`, { mode: 'default' }),
      '生成模块页面集'
    )
    const pageSets = (generated.project as { pageSets: Array<{ pages: Array<{ id: string; title: string }> }> }).pageSets
    const pages = pageSets.flatMap(set => set.pages)
    for (const page of pages) {
      assertOk(
        await request('POST', `/apps/${multiAppId}/design/pages/${page.id}/snapshot${moduleQuery(moduleId)}`, {
          imageBase64: `data:image/png;base64,${PNG.toString('base64')}`,
          html: `<div>${tag} ${page.title}</div>`
        }),
        '上传模块页面 PNG'
      )
    }
    const current = assertOk(await request('GET', `/apps/${multiAppId}/design${moduleQuery(moduleId)}`), '读取模块设计')
    assertOk(
      await request('PUT', `/apps/${multiAppId}/design/entities${moduleQuery(moduleId)}`, {
        entities: (current.entities as Array<Record<string, unknown>>).map(entity => ({ ...entity, status: 'confirmed' }))
      }),
      '确认模块实体'
    )
    for (const set of current.pageSets as Array<{ id: string }>) {
      assertOk(
        await request('PUT', `/apps/${multiAppId}/design/page-sets/${set.id}${moduleQuery(moduleId)}`, { status: 'confirmed' }),
        '确认模块页面集'
      )
    }
    assertOk(await request('POST', `/apps/${multiAppId}/design/confirm${moduleQuery(moduleId)}`), '确认模块设计')
    return pages.length
  }
  const pageCountA = await prepare(moduleA, '商品', [
    { name: '商品', tableName: 'biz_product' },
    { name: '库存', tableName: 'biz_stock' }
  ])
  const pageCountB = await prepare(moduleB, '订单', [{ name: '订单', tableName: 'biz_order' }])
  return { pageCount: pageCountA + pageCountB }
}

// ---- 阶段类型/读取 ----

interface PhaseView {
  id: string
  key: string
  title: string
  order: number
  status: string
  kind: string
  moduleId: string | null
  moduleKey: string | null
  goal: string
  scope: {
    kind: string
    storyIds: string[]
    pageSetCodes: string[]
    pageCodes: string[]
    note?: string
  }
  summary: string | null
  summarySource: string | null
  session: { id: string; status: string } | null
  sessionCount: number
  handoffVersion: number
}

interface PhasesResponse {
  handoffVersion: number | null
  canGenerate: boolean
  generated: boolean
  changeSet: { id: string; seq: number } | null
  phases: PhaseView[]
  modules: Array<{
    id: string
    key: string
    moduleId: string | null
    title: string
    status: string
    total: number
    completed: number
    skipped: number
    inProgress: number
  }>
  modulePhaseCount: number
}

interface SessionListItem {
  id: string
  status: string
  active: boolean
  phaseId: string | null
  phaseKey: string | null
  phaseTitle: string | null
  phaseOrder: number | null
  phaseStatus: string | null
  phaseKind: string | null
  phaseModuleId: string | null
  phaseModuleKey: string | null
}

async function getPhases(targetAppId = appId): Promise<PhasesResponse> {
  return assertOk(await request('GET', `/apps/${targetAppId}/development/phases`), '读取阶段') as unknown as PhasesResponse
}

async function listSessions(targetAppId = appId): Promise<SessionListItem[]> {
  const data = assertOk(await request('GET', `/apps/${targetAppId}/development/sessions`), '读取会话列表')
  return data.sessions as SessionListItem[]
}

async function main(): Promise<void> {
  await import('../src/index')
  await waitForHealth()

  // ---- 单模块回归 ----
  assertOk(await request('POST', '/apps', { id: appId, name: appName, description: 'U7-1', backendPort: 8102 }), '创建应用')
  await fillRequirement()
  const { pageCount } = await prepareConfirmedDesign()
  assert(pageCount >= 12, `页面数应 ≥ 12，实际 ${pageCount}`)
  assertOk(await request('POST', `/apps/${appId}/design/handoff/generate`), '生成交接包')
  console.log(`单模块准备：doc 应用 + 3 Epic / 10 Story / ${pageCount} 页面 + 交接包 v1`)

  const read = assertOk(await request('GET', `/apps/${appId}/design/handoff`), '读取交接包')
  const handoff = read.handoff as {
    version: number
    manifest: {
      scale?: { level?: string; suggested?: boolean; phaseCount?: number; modulePhaseCount?: number }
      phases?: Array<{ key: string; kind: string; title: string; goal: string; storyIds: string[]; pageSetCodes: string[]; pageCodes: string[]; note?: string }>
    }
  }
  const manifestPhases = handoff.manifest.phases ?? []
  assert(handoff.manifest.scale?.suggested === true, `scale.suggested 应为 true：${JSON.stringify(handoff.manifest.scale)}`)
  assert(manifestPhases.length >= 3, `manifest.phases 至少 3 个，实际 ${manifestPhases.length}`)
  assert(
    manifestPhases.map(phase => phase.key).join(',') === ['base', 'epic:EPIC-001', 'epic:EPIC-002', 'epic:EPIC-003'].join(','),
    `单模块阶段 key 不正确：${manifestPhases.map(phase => phase.key).join(',')}`
  )
  assert(manifestPhases[0].kind === 'base', '首个阶段应为 base')
  assert(manifestPhases[1].pageSetCodes.length > 0, 'Epic 阶段应带页面集范围')
  assert(manifestPhases[1].storyIds.length > 0, 'Epic 阶段应带 Story 范围')
  assert(handoff.manifest.scale?.phaseCount === 4, '单模块可执行阶段应为 4')
  assert((handoff.manifest.scale?.modulePhaseCount ?? 0) === 0, '单模块不应有模块阶段')
  console.log(`单模块 manifest.phases：${manifestPhases.length} 阶段 / key=${manifestPhases.map(phase => phase.key).join(' | ')}`)

  const empty = await getPhases()
  assert(empty.canGenerate === true, '大交接包应可生成阶段')
  assert(empty.generated === false && empty.phases.length === 0, '未生成时阶段应为空')
  assert(empty.changeSet?.seq === 1, '阶段应归属 Change Set #1')
  assert(empty.modules.length === 0, '单模块 phases 不应有模块分组')

  const generated = assertOk(await request('POST', `/apps/${appId}/development/phases/generate`), '生成阶段') as unknown as PhasesResponse
  assert(generated.phases.length === manifestPhases.length, `阶段数应为 ${manifestPhases.length}，实际 ${generated.phases.length}`)
  assert(generated.phases.every(phase => phase.status === 'not_started'), '生成后应为 not_started')
  assert(generated.canGenerate === false, '已生成后 canGenerate=false')
  const again = assertOk(await request('POST', `/apps/${appId}/development/phases/generate`), '重复生成阶段') as unknown as PhasesResponse
  assert(
    again.phases.map(phase => phase.id).join(',') === generated.phases.map(phase => phase.id).join(','),
    '重复生成应幂等（阶段 ID 不变）'
  )
  console.log(`单模块生成：${generated.phases.length} 阶段（base + Epic），幂等`)

  const [basePhase, epic1, epic2, epic3] = generated.phases

  const started1 = assertOk(
    await request('POST', `/apps/${appId}/development/phases/${basePhase.id}/start`),
    '开始阶段 1'
  ) as unknown as { session: { id: string; title: string | null; phase?: { id: string; order: number; status: string } }; defaultPrompt: string; phase: PhaseView }
  assert(started1.phase.status === 'in_progress', '开始后阶段应 in_progress')
  assert(started1.session.phase?.id === basePhase.id, '会话应记录阶段')
  assert(started1.session.phase?.status === 'in_progress', '会话阶段状态应为 in_progress')
  assert(/阶段 1 数据模型与基础框架$/.test(started1.session.title ?? ''), `阶段会话标题不正确：${started1.session.title}`)
  assert(started1.defaultPrompt.includes('你现在在阶段 1/4：数据模型与基础框架。'), 'brief 缺少阶段位置')
  assert(started1.defaultPrompt.includes('docs/handoff/00-README.md、04-PLAN.md'), 'brief 缺少交接包路径')
  assert(started1.defaultPrompt.includes('无上一阶段摘要'), '无摘要时 brief 应写明')
  assert(!started1.defaultPrompt.includes('批次'), 'brief 不应注入批次')

  const started1Again = assertOk(
    await request('POST', `/apps/${appId}/development/phases/${basePhase.id}/start`),
    '重复开始阶段 1'
  ) as unknown as { session: { id: string } }
  assert(started1Again.session.id === started1.session.id, '已有 active 会话时应返回同一会话')

  const started2 = assertOk(
    await request('POST', `/apps/${appId}/development/phases/${epic1.id}/start`),
    '开始阶段 2'
  ) as unknown as { session: { id: string; phase?: { order: number } }; defaultPrompt: string; phase: PhaseView }
  assert(started2.phase.status === 'in_progress', '阶段 2 应 in_progress')
  assert(started2.session.phase?.order === 2, '阶段 2 会话 order 应为 2')
  assert(started2.defaultPrompt.includes('你现在在阶段 2/4：EPIC-001 客户管理。'), '阶段 2 brief 不正确')
  assert(started2.defaultPrompt.includes('Story STORY-001'), '阶段 2 brief 缺少 Story 范围')
  const sessionsAfter2 = await listSessions()
  const phase1Item = sessionsAfter2.find(item => item.id === started1.session.id)
  const phase2Item = sessionsAfter2.find(item => item.id === started2.session.id)
  assert(phase1Item?.status === 'archived', '阶段 1 会话应归档')
  assert(phase2Item?.active === true, '阶段 2 会话应 active')
  assert(phase1Item?.phaseOrder === 1 && phase1Item.phaseTitle === '数据模型与基础框架', '会话列表缺少阶段字段')
  assert(phase2Item?.phaseKey === 'epic:EPIC-001' && phase2Item.phaseStatus === 'in_progress', '阶段 2 字段不正确')
  const devState = assertOk(await request('GET', `/apps/${appId}/development`), '读取开发状态') as unknown as {
    session: { id: string; phase?: { id: string; order: number; status: string } }
    phases: Array<{ id: string; order: number; status: string }>
  }
  assert(devState.session.phase?.id === epic1.id, '开发状态 session.phase 不正确')
  assert(devState.phases.length === 4, '开发状态应带阶段摘要')
  console.log('单模块阶段 2：会话归档/active/列表与状态字段')

  const readOnly = assertOk(
    await request('GET', `/apps/${appId}/development?sessionId=${encodeURIComponent(started1.session.id)}`),
    '只读查看阶段 1 会话'
  ) as unknown as { readOnly: boolean; session: { status: string; phase?: { order: number } } }
  assert(readOnly.readOnly === true && readOnly.session.status === 'archived', '阶段 1 会话应只读')
  assert(readOnly.session.phase?.order === 1, '只读会话应带阶段')
  const restored = assertOk(
    await request('POST', `/apps/${appId}/development/sessions/${started1.session.id}/activate`),
    '恢复阶段 1 会话'
  ) as unknown as { session: { id: string; phase?: { order: number } } }
  assert(restored.session.id === started1.session.id && restored.session.phase?.order === 1, '恢复阶段 1 会话失败')
  const afterRestore = await listSessions()
  assert(afterRestore.find(item => item.id === started2.session.id)?.status === 'archived', '恢复后阶段 2 会话应归档')

  const completed = assertOk(
    await request('POST', `/apps/${appId}/development/phases/${basePhase.id}/complete`),
    '完成阶段 1'
  ) as unknown as { phase: PhaseView; warnings: string[] }
  assert(completed.phase.status === 'completed', '阶段 1 应 completed')
  assert(completed.phase.summarySource === 'none', `无 assistant 时应 none，实际 ${completed.phase.summarySource}`)
  assert(completed.warnings.length === 0, `无 assistant 不应有 warning：${JSON.stringify(completed.warnings)}`)
  const afterComplete = await listSessions()
  assert(afterComplete.find(item => item.id === started1.session.id)?.status === 'active', '完成阶段不应归档会话')

  const skipped = assertOk(
    await request('POST', `/apps/${appId}/development/phases/${epic2.id}/skip`),
    '跳过阶段 3'
  ) as unknown as PhaseView
  assert(skipped.status === 'skipped', '阶段 3 应 skipped')
  assert(Boolean(skipped.completedAt), 'skipped 应记录 completedAt')
  const reopened = assertOk(
    await request('POST', `/apps/${appId}/development/phases/${basePhase.id}/reopen`),
    '重新打开阶段 1'
  ) as unknown as PhaseView
  assert(reopened.status === 'in_progress' && reopened.completedAt === null, '重新打开应 in_progress 且清 completedAt')

  const started4 = assertOk(
    await request('POST', `/apps/${appId}/development/phases/${epic3.id}/start`),
    '开始阶段 4'
  ) as unknown as { session: { id: string }; phase: PhaseView }
  assert(started4.phase.status === 'in_progress', '阶段 4 应 in_progress')
  const completed4 = assertOk(
    await request('POST', `/apps/${appId}/development/phases/${epic3.id}/complete`),
    '完成阶段 4'
  ) as unknown as { phase: PhaseView }
  assert(completed4.phase.status === 'completed', '阶段 4 应 completed')

  const final = await getPhases()
  assert(final.phases.length === 4, '最终应有 4 个阶段')
  assert(final.phases.filter(phase => phase.status === 'completed').length === 1, '阶段 4 已完成')
  assert(final.phases.filter(phase => phase.status === 'skipped').length === 1, '阶段 3 已跳过')
  assert(final.phases.filter(phase => phase.status === 'in_progress').length === 2, '阶段 1/2 进行中')
  const historical = assertOk(
    await request('GET', `/apps/${appId}/development/phases?handoffVersion=1`),
    '读取历史交接包阶段'
  ) as unknown as PhasesResponse
  assert(historical.phases.length === 4, '历史交接包 v1 阶段应保留')
  console.log('单模块状态/历史：completed×1 / skipped×1 / in_progress×2')

  assertOk(await request('DELETE', `/apps/${appId}?confirm=true`), '删除应用')
  const { db } = await import('../src/db')
  const phaseCount = db.prepare('SELECT COUNT(*) AS count FROM app_dev_phases WHERE app_id = ?').get(appId) as { count: number }
  const sessionCount = db.prepare('SELECT COUNT(*) AS count FROM app_sessions WHERE app_id = ?').get(appId) as { count: number }
  assert(phaseCount.count === 0, `删除后阶段应清理，实际 ${phaseCount.count}`)
  assert(sessionCount.count === 0, `删除后会话应清理，实际 ${sessionCount.count}`)
  console.log('清理：单模块应用 → 阶段/会话/目录已删除')

  // ---- 两模块两层阶段 ----
  const multiModules = await fillMultiRequirements()
  const multiDesign = await prepareMultiDesign(multiModules.moduleA, multiModules.moduleB)
  assert(multiDesign.pageCount >= 12, `多模块页面数应 ≥ 12，实际 ${multiDesign.pageCount}`)
  assertOk(await request('POST', `/apps/${multiAppId}/design/handoff/generate`), '生成多模块交接包')
  const multiRead = assertOk(await request('GET', `/apps/${multiAppId}/design/handoff`), '读取多模块交接包')
  const multiManifest = (multiRead.handoff as {
    manifest: {
      scale?: { suggested?: boolean; phaseCount?: number; modulePhaseCount?: number }
      phases?: Array<{ key: string; kind: string; title: string; moduleId?: string; moduleKey?: string; parentKey?: string }>
    }
  }).manifest
  const multiPhases = multiManifest.phases ?? []
  assert(multiManifest.scale?.suggested === true, '多模块交接包应为 large')
  assert(multiManifest.scale?.phaseCount === 5, `可执行阶段应为 5，实际 ${multiManifest.scale?.phaseCount}`)
  assert(multiManifest.scale?.modulePhaseCount === 2, `模块阶段应为 2，实际 ${multiManifest.scale?.modulePhaseCount}`)
  deepEqual(multiPhases.map(phase => phase.key), [
    'base',
    'module:MOD-001',
    'epic:EPIC-001',
    'epic:EPIC-002',
    'epic:EPIC-004',
    'module:MOD-002',
    'epic:EPIC-003'
  ], '多模块阶段 key 不正确')
  equal(multiPhases[1].kind, 'module')
  equal(multiPhases[1].moduleKey, 'MOD-001')
  equal(multiPhases[2].parentKey, 'MOD-001')
  equal(multiPhases[2].moduleKey, 'MOD-001')

  const multiGenerated = assertOk(
    await request('POST', `/apps/${multiAppId}/development/phases/generate`),
    '生成多模块阶段'
  ) as unknown as PhasesResponse
  equal(multiGenerated.phases.length, 7)
  equal(multiGenerated.modulePhaseCount, 2)
  equal(multiGenerated.modules.length, 2)
  equal(multiGenerated.modules[0].key, 'MOD-001')
  equal(multiGenerated.modules[0].total, 3)
  equal(multiGenerated.modules[1].total, 1)
  deepEqual(
    multiGenerated.phases.filter(phase => phase.kind !== 'module').map(phase => phase.order),
    [1, 2, 3, 4, 5],
    '可执行阶段顺序不正确'
  )
  const mModuleA = multiGenerated.phases.find(phase => phase.key === 'module:MOD-001') as PhaseView
  equal(mModuleA.parentKey, null)
  equal((multiGenerated.phases.find(phase => phase.key === 'epic:EPIC-001') as PhaseView).parentKey, 'MOD-001')
  equal((multiGenerated.phases.find(phase => phase.key === 'epic:EPIC-003') as PhaseView).parentKey, 'MOD-002')
  const modulePhase = multiGenerated.phases.find(phase => phase.kind === 'module' && phase.moduleKey === 'MOD-001')
  assert(Boolean(modulePhase), '缺少 MOD-001 模块阶段')
  for (const action of ['start', 'complete', 'skip', 'reopen']) {
    const result = await request(
      'POST',
      `/apps/${multiAppId}/development/phases/${(modulePhase as PhaseView).id}/${action}`
    )
    assert(result.status === 409, `模块阶段 ${action} 应 409，实际 ${result.status}`)
  }
  console.log('多模块 manifest/phases：base + MOD-001 + 3 Epic + MOD-002 + Epic；模块操作 409')

  const multiBase = multiGenerated.phases.find(phase => phase.key === 'base') as PhaseView
  const mEpic1 = multiGenerated.phases.find(phase => phase.key === 'epic:EPIC-001') as PhaseView
  const mEpic2 = multiGenerated.phases.find(phase => phase.key === 'epic:EPIC-002') as PhaseView
  const mEpic3 = multiGenerated.phases.find(phase => phase.key === 'epic:EPIC-003') as PhaseView

  const multiStart = assertOk(
    await request('POST', `/apps/${multiAppId}/development/phases/${multiBase.id}/start`),
    '开始多模块 base 阶段'
  ) as unknown as { session: { id: string; phase?: { kind: string } } }
  assert(multiStart.session.phase?.kind === 'base', 'base 会话 kind 不正确')
  const multiStartEpic1 = assertOk(
    await request('POST', `/apps/${multiAppId}/development/phases/${mEpic1.id}/start`),
    '开始 MOD-001 第一个 Epic'
  ) as unknown as { session: { id: string; title: string | null; phase?: { kind: string; moduleKey: string } }; defaultPrompt: string }
  assert(/MOD-001 商品管理/.test(multiStartEpic1.session.title ?? ''), `Epic 会话标题缺少模块：${multiStartEpic1.session.title}`)
  assert(multiStartEpic1.session.phase?.moduleKey === 'MOD-001', 'Epic 会话模块 key 不正确')
  assert(/模块：MOD-001 商品管理/.test(multiStartEpic1.defaultPrompt), 'Epic brief 缺少模块信息')
  assert(/你现在在阶段 2\/5/.test(multiStartEpic1.defaultPrompt), 'Epic brief 阶段顺序应只计可执行阶段')
  let multiState = await getPhases(multiAppId)
  equal(multiState.modules.find(module => module.key === 'MOD-001')?.status, 'in_progress')
  equal(multiState.modules.find(module => module.key === 'MOD-002')?.status, 'not_started')
  const multiSessions = await listSessions(multiAppId)
  const epicSession = multiSessions.find(item => item.id === multiStartEpic1.session.id)
  assert(epicSession?.phaseModuleKey === 'MOD-001', '会话列表缺少 phaseModuleKey')
  assert(epicSession?.phaseKind === 'epic', '会话列表缺少 phaseKind')

  // MF-M6b-2：完成 1/3 子阶段后模块应为 in_progress（不是 not_started）
  const mEpic1Completed = assertOk(
    await request('POST', `/apps/${multiAppId}/development/phases/${mEpic1.id}/complete`),
    '完成 MOD-001 第 1/3 个 Epic'
  ) as unknown as { phase: PhaseView; warnings: string[] }
  equal(mEpic1Completed.phase.status, 'completed')
  equal(mEpic1Completed.phase.summarySource, 'none')
  multiState = await getPhases(multiAppId)
  const moduleAPartial = multiState.modules.find(module => module.key === 'MOD-001')
  equal(moduleAPartial?.status, 'in_progress')
  equal(moduleAPartial?.completed, 1)
  equal(moduleAPartial?.total, 3)

  db.prepare('UPDATE app_dev_phases SET summary = ? WHERE id = ?').run('模块 A 第一段摘要', mEpic1.id)
  const multiEpic2 = assertOk(
    await request('POST', `/apps/${multiAppId}/development/phases/${mEpic2.id}/start`),
    '开始 MOD-001 第二个 Epic'
  ) as unknown as { defaultPrompt: string }
  assert(/模块 A 第一段摘要/.test(multiEpic2.defaultPrompt), '同模块 previous summary 未带入')
  const multiEpic3 = assertOk(
    await request('POST', `/apps/${multiAppId}/development/phases/${mEpic3.id}/start`),
    '开始 MOD-002 第一个 Epic'
  ) as unknown as { defaultPrompt: string; session: { title: string | null } }
  assert(/无上一阶段摘要/.test(multiEpic3.defaultPrompt), '跨模块不应带上一模块摘要')
  assert(/MOD-002 订单管理/.test(multiEpic3.session.title ?? ''), 'MOD-002 Epic 会话标题缺少模块')

  const multiCompleted = assertOk(
    await request('POST', `/apps/${multiAppId}/development/phases/${mEpic3.id}/complete`),
    '完成 MOD-002 Epic'
  ) as unknown as { phase: PhaseView; warnings: string[] }
  equal(multiCompleted.phase.status, 'completed')
  equal(multiCompleted.phase.summarySource, 'none')
  equal(multiCompleted.warnings.length, 0)
  const multiSessionsAfter = await listSessions(multiAppId)
  equal(multiSessionsAfter.find(item => item.id === multiEpic3.session.id)?.status, 'active')

  multiState = await getPhases(multiAppId)
  equal(multiState.phases.length, 7)
  equal(multiState.modules.length, 2)
  equal(multiState.modules.find(module => module.key === 'MOD-002')?.status, 'completed')
  console.log('多模块阶段：base/Epic 会话含模块、模块状态派生、同模块摘要/跨模块不串、Epic complete 不归档')

  assertOk(await request('DELETE', `/apps/${multiAppId}?confirm=true`), '删除多模块应用')
  const multiPhaseCount = db.prepare('SELECT COUNT(*) AS count FROM app_dev_phases WHERE app_id = ?').get(multiAppId) as { count: number }
  assert(multiPhaseCount.count === 0, `多模块删除后阶段应清理，实际 ${multiPhaseCount.count}`)
  console.log('清理：多模块应用 → 阶段/会话/目录已删除')
}

async function cleanup(): Promise<void> {
  try {
    const { opencode } = await import('../src/opencode/runtime')
    await opencode.stop()
  } catch {
    // 忽略
  }
  try {
    const { db } = await import('../src/db')
    db.close()
  } catch {
    // 忽略
  }
  try {
    fs.rmSync(root, { recursive: true, force: true })
  } catch {
    // Windows 句柄释放滞后时留给系统清理
  }
}

main()
  .then(async () => {
    await cleanup()
    console.log('\n开发阶段冒烟通过')
    process.exit(0)
  })
  .catch(async error => {
    console.error('\n开发阶段冒烟失败：', error)
    await cleanup()
    process.exit(1)
  })
