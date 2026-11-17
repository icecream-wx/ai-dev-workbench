/**
 * 需求模块（M2，#6）API 冒烟
 *
 * 临时 data/projects 目录 + 临时端口（默认 3419）启动真实工作台后端（不调模型/不启 opencode），走：
 * 单模块（旧行为）→ 模块懒创建 → 多模块新增 → 同 section 隔离 → 跨模块 Outline ID 唯一
 * → 模块确认（单/多）→ bundle 只读/confirm → 归档/恢复/守卫 → 模板切换/rollback/export 按模块
 * → 删除应用清理 app_modules/app_requirement_bundles。
 *
 * 运行：npm run smoke:modules --prefix backend
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-modules-smoke-'))
const port = Number(process.env.MODULE_SMOKE_PORT ?? 3419)
process.env.PORT = String(port)
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_PORT = String(port + 1000)
process.env.OPENCODE_AUTO_START = 'false'

const base = `http://127.0.0.1:${port}`

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

function assertStatus(result: ApiResult, expected: number, label: string): Record<string, unknown> {
  if (result.status !== expected) {
    throw new Error(`${label} 期望 HTTP ${expected}，实际 ${result.status}：${JSON.stringify(result.data)}`)
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

interface ModuleView {
  id: string
  moduleKey: string
  title: string
  required: boolean
  archived: boolean
  position: number
  docStatus: string | null
  docVersion: number | null
}

interface DocSection {
  sectionKey: string
  title: string
  markdown: string
  required: boolean
  kind: string
  data?: {
    scenes: Array<{ id: string; title: string }>
    epics: Array<{ id: string; title: string }>
    stories: Array<{ id: string; title: string; epicId: string | null; acceptance: string[] }>
  }
}

function modulesOf(payload: Record<string, unknown>): ModuleView[] {
  return payload.modules as ModuleView[]
}

function sectionsOf(payload: Record<string, unknown>): DocSection[] {
  return payload.sections as DocSection[]
}

function docOf(payload: Record<string, unknown>): {
  moduleId: string
  moduleKey: string
  version: number
  status: string
  contentMd: string
  title: string
} {
  return payload.doc as {
    moduleId: string
    moduleKey: string
    version: number
    status: string
    contentMd: string
    title: string
  }
}

const REQUIRED_CONTENT: Record<string, string> = {
  meta: '- 产品：季度报表\n- 作者：产品组\n- 日期：2026-11-13\n- 版本：v1\n- 状态：草稿',
  problem: '运营需要季度报表，当前靠手工 Excel。',
  goals: '季度报表生成时间从 2 天降到 30 分钟。',
  users: '- 运营：查看季度/ATM 指标\n- 管理员：维护数据',
  scope: '- 本期做：季度列表、ATM 列表、详情\n- 不做：数据写入',
  rules: '- 季度与 ATM 指标一对多\n- 金额保留两位小数',
  acceptance: '- 季度列表可用\n- ATM 列表可筛选\n- 详情字段完整'
}

async function fillRequired(appId: string, moduleId: string, prefix: string): Promise<void> {
  const doc = assertOk(
    await request('GET', `/apps/${appId}/requirements-doc?moduleId=${encodeURIComponent(moduleId)}`),
    `读取文档（${prefix}）`
  )
  for (const section of sectionsOf(doc)) {
    if (!section.required) continue
    if (section.kind === 'scenes') {
      if (section.data?.scenes?.length) continue
      assertOk(
        await request(
          'PUT',
          `/apps/${appId}/requirements-doc/sections/scenes?moduleId=${encodeURIComponent(moduleId)}`,
          { data: { scenes: [{ title: `${prefix} 场景`, description: `${prefix} 场景说明` }], epics: [], stories: [] } }
        ),
        `补全场景（${prefix}）`
      )
      continue
    }
    if (section.kind === 'epics') {
      if (section.data?.epics?.length) continue
      assertOk(
        await request(
          'PUT',
          `/apps/${appId}/requirements-doc/sections/epics?moduleId=${encodeURIComponent(moduleId)}`,
          {
            data: {
              scenes: [],
              epics: [{ title: `${prefix} Epic`, goal: `${prefix} 业务目标` }],
              stories: [{ title: `${prefix} Story`, acceptance: [`${prefix} 验收`], priority: 'P0' }]
            }
          }
        ),
        `补全 Epics（${prefix}）`
      )
      continue
    }
    if (section.markdown.trim()) continue
    assertOk(
      await request(
        'PUT',
        `/apps/${appId}/requirements-doc/sections/${section.sectionKey}?moduleId=${encodeURIComponent(moduleId)}`,
        { markdown: `${prefix}：${REQUIRED_CONTENT[section.sectionKey] ?? `内容-${section.title}`}` }
      ),
      `补全章节 ${section.title}（${prefix}）`
    )
  }
}

async function main(): Promise<void> {
  await import('../src/index')
  await waitForHealth()

  const { db } = await import('../src/db')
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
    VALUES ('single-app', '单模块应用', '旧行为', 'single-app', 8101, 'requirements', ?, ?)
  `).run(now, now)
  const singleDoc = assertOk(await request('GET', '/apps/single-app/requirements-doc'), '单模块应用初始化文档')
  if (docOf(singleDoc).moduleKey !== 'MOD-001') throw new Error('默认模块 key 应为 MOD-001')
  if (docOf(singleDoc).title !== '单模块应用 需求文档') throw new Error('默认模块文档标题应保持旧行为')
  const singleModules = modulesOf(assertOk(await request('GET', '/apps/single-app/requirements-modules'), '读取单模块列表'))
  if (singleModules.length !== 1 || singleModules[0].title !== '单模块应用' || singleModules[0].archived) {
    throw new Error(`默认模块应懒创建且 title=应用名，实际 ${JSON.stringify(singleModules)}`)
  }
  console.log('单模块：默认模块 MOD-001 懒创建，文档标题保持旧行为，列表/文档 module 字段可用')

  const created = assertOk(
    await request('POST', '/apps', { id: 'multi-app', name: '多模块应用', description: 'M2 冒烟', backendPort: 8102 }),
    '创建应用'
  )
  const createdApp = created.app as { requirementModules: unknown[]; requirementDoc: unknown }
  if (!Array.isArray(createdApp.requirementModules) || createdApp.requirementModules.length !== 0) {
    throw new Error('新建应用 payload.requirementModules 应为空数组（只读，不建模块）')
  }
  if (createdApp.requirementDoc !== null) throw new Error('新建应用 requirementDoc 应为 null')
  const emptyModules = assertOk(await request('GET', '/apps/multi-app/requirements-modules'), '空模块列表（只读）')
  if (modulesOf(emptyModules).length !== 0 || emptyModules.defaultModuleId !== null) {
    throw new Error(`模块列表只读：空应用不应创建模块，实际 ${JSON.stringify(emptyModules)}`)
  }
  console.log('新建应用：requirementModules=[]、模块列表只读（不懒创建）')

  const defaultDoc = assertOk(await request('GET', '/apps/multi-app/requirements-doc'), '默认模块初始化')
  const module1 = docOf(defaultDoc).moduleId
  if (!module1) throw new Error('文档应返回 moduleId')
  const createdModule = assertOk(
    await request('POST', '/apps/multi-app/requirements-modules', { title: '订单管理', ownerLabel: '张三' }),
    '新增模块'
  )
  const module2View = createdModule.module as ModuleView
  if (module2View.moduleKey !== 'MOD-002' || module2View.docVersion !== 1 || module2View.docStatus !== 'draft') {
    throw new Error(`新模块应为 MOD-002/v1/draft，实际 ${JSON.stringify(module2View)}`)
  }
  const module2 = module2View.id
  const module2Doc = assertOk(
    await request('GET', `/apps/multi-app/requirements-doc?moduleId=${module2}`),
    '读取新模块文档'
  )
  if (docOf(module2Doc).title !== '多模块应用 · 订单管理 需求文档') {
    throw new Error(`新模块文档标题不对：${docOf(module2Doc).title}`)
  }
  if (sectionsOf(module2Doc).length !== 13) throw new Error('新模块应复制应用需求模板 13 节')
  if (docOf(module2Doc).version !== 1) throw new Error('新模块文档应为 v1')
  console.log('新增模块：MOD-002 + 空文档 v1（13 节，标题带模块名）')

  // 同 section key 隔离
  assertOk(
    await request('PUT', `/apps/multi-app/requirements-doc/sections/problem?moduleId=${module1}`, {
      markdown: '模块一的专属问题描述'
    }),
    '模块一保存 problem'
  )
  assertOk(
    await request('PUT', `/apps/multi-app/requirements-doc/sections/problem?moduleId=${module2}`, {
      markdown: '模块二的专属问题描述'
    }),
    '模块二保存 problem'
  )
  const read1 = assertOk(await request('GET', `/apps/multi-app/requirements-doc?moduleId=${module1}`), '复读模块一')
  const read2 = assertOk(await request('GET', `/apps/multi-app/requirements-doc?moduleId=${module2}`), '复读模块二')
  const problem1 = sectionsOf(read1).find(section => section.sectionKey === 'problem')?.markdown ?? ''
  const problem2 = sectionsOf(read2).find(section => section.sectionKey === 'problem')?.markdown ?? ''
  if (!problem1.includes('模块一的专属问题描述') || !problem2.includes('模块二的专属问题描述')) {
    throw new Error('两个模块的同一 section key 内容互相串了')
  }
  const versions1 = assertOk(
    await request('GET', `/apps/multi-app/requirements-doc/versions?moduleId=${module1}`),
    '模块一版本列表'
  ).versions as Array<{ version: number }>
  const versions2 = assertOk(
    await request('GET', `/apps/multi-app/requirements-doc/versions?moduleId=${module2}`),
    '模块二版本列表'
  ).versions as Array<{ version: number }>
  if (versions1.length !== versions2.length) throw new Error('两个模块应各自只有 1 个初始版本')
  console.log('模块隔离：同 section key 内容/版本互不影响')

  // 跨模块 ID 唯一（§9.3）
  assertOk(
    await request('PUT', `/apps/multi-app/requirements-doc/sections/epics?moduleId=${module1}`, {
      data: {
        scenes: [],
        epics: [{ title: '季度报表' }],
        stories: [{ title: '查看列表', acceptance: ['可查看'] }]
      }
    }),
    '模块一写入结构化 epics'
  )
  assertOk(
    await request('PUT', `/apps/multi-app/requirements-doc/sections/epics?moduleId=${module2}`, {
      data: {
        scenes: [],
        epics: [{ title: '订单中心' }],
        stories: [{ title: '查看列表', acceptance: ['可查看'] }]
      }
    }),
    '模块二写入同名 Story'
  )
  const epics1 = sectionsOf(
    assertOk(await request('GET', `/apps/multi-app/requirements-doc?moduleId=${module1}`), '复读模块一 epics')
  ).find(section => section.sectionKey === 'epics')?.data
  const epics2 = sectionsOf(
    assertOk(await request('GET', `/apps/multi-app/requirements-doc?moduleId=${module2}`), '复读模块二 epics')
  ).find(section => section.sectionKey === 'epics')?.data
  const story1 = epics1?.stories[0]?.id ?? ''
  const story2 = epics2?.stories[0]?.id ?? ''
  if (!story1 || !story2 || story1 === story2) {
    throw new Error(`两个模块的同名 Story 应分配不同 ID，实际 ${story1} / ${story2}`)
  }
  if (epics1?.epics[0]?.id === epics2?.epics[0]?.id) throw new Error('两个模块的 Epic ID 不应相同')
  // 模块二直接提交模块一的 STORY id → 必须换新号，且模块一不变
  assertOk(
    await request('PUT', `/apps/multi-app/requirements-doc/sections/epics?moduleId=${module2}`, {
      data: {
        scenes: [],
        epics: [{ title: '订单中心' }],
        stories: [{ id: story1, title: '借用他模块 ID', acceptance: ['可查看'] }]
      }
    }),
    '模块二提交模块一的 Story ID'
  )
  const epics2After = sectionsOf(
    assertOk(await request('GET', `/apps/multi-app/requirements-doc?moduleId=${module2}`), '复读模块二 epics（借用 ID）')
  ).find(section => section.sectionKey === 'epics')?.data
  const borrowed = epics2After?.stories.find(story => story.title === '借用他模块 ID')
  if (!borrowed?.id || borrowed.id === story1) {
    throw new Error(`模块二不应沿用模块一的 ${story1}，实际 ${borrowed?.id}`)
  }
  const epics1After = sectionsOf(
    assertOk(await request('GET', `/apps/multi-app/requirements-doc?moduleId=${module1}`), '复读模块一 epics（未被改动）')
  ).find(section => section.sectionKey === 'epics')?.data
  if (epics1After?.stories[0]?.id !== story1) throw new Error('模块一的 Story ID 不应被模块二影响')
  console.log(`跨模块 ID：同名 Story 分配不同 ID（${story1} / ${story2}），借用他模块 ID 换新号且不影响原模块`)

  // 模块确认（多模块不自动进入设计）
  await fillRequired('multi-app', module1, '模块一')
  const confirm1 = assertOk(
    await request('POST', `/apps/multi-app/requirements-doc/confirm?moduleId=${module1}`),
    '确认模块一'
  )
  if (confirm1.appConfirmed !== false) throw new Error('多模块应用确认单个模块不应应用级确认')
  const pending1 = confirm1.pendingModuleIds as string[]
  if (!pending1.includes(module2)) throw new Error('确认模块一后 pending 应包含模块二')
  const appAfterModule1 = assertOk(await request('GET', '/apps/multi-app'), '读取应用（模块一确认后）')
  if ((appAfterModule1.app as { status: string }).status !== 'requirements') {
    throw new Error('多模块应用确认单个模块后应仍在需求阶段')
  }

  await fillRequired('multi-app', module2, '模块二')
  const confirm2 = assertOk(
    await request('POST', `/apps/multi-app/requirements-doc/confirm?moduleId=${module2}`),
    '确认模块二'
  )
  if (confirm2.appConfirmed !== false || (confirm2.pendingModuleIds as string[]).length !== 0) {
    throw new Error('多模块：全部模块确认后仍需 bundle confirm 才推进应用阶段')
  }
  console.log('模块确认：多模块只确认本模块，不自动进入设计')

  // bundle 只读
  const counts = (): Record<string, number> => {
    const query = (sql: string): number => (db.prepare(sql).get() as { c: number }).c
    return {
      modules: query("SELECT COUNT(*) AS c FROM app_modules WHERE app_id = 'multi-app'"),
      docs: query("SELECT COUNT(*) AS c FROM app_requirement_docs WHERE app_id = 'multi-app'"),
      versions: query("SELECT COUNT(*) AS c FROM app_requirement_doc_versions WHERE app_id = 'multi-app'"),
      bundles: query("SELECT COUNT(*) AS c FROM app_requirement_bundles WHERE app_id = 'multi-app'")
    }
  }
  const beforeRead = counts()
  const bundleRead = assertOk(await request('GET', '/apps/multi-app/requirements-bundle'), '只读 bundle')
  const bundleReadBody = bundleRead.bundle as {
    bundleHash: string
    modules: Array<{ moduleId: string; confirmed: boolean; docHash: string }>
    allRequiredConfirmed: boolean
    latest: unknown
  }
  if (bundleReadBody.modules.length !== 2) throw new Error('bundle 应包含 2 个模块')
  if (!bundleReadBody.allRequiredConfirmed) throw new Error('两个模块都确认后 allRequiredConfirmed 应为 true')
  if (bundleReadBody.latest !== null) throw new Error('bundle confirm 之前不应有持久化快照')
  if (!bundleReadBody.bundleHash) throw new Error('bundleHash 不应为空')
  const afterRead = counts()
  if (JSON.stringify(beforeRead) !== JSON.stringify(afterRead)) {
    throw new Error(`GET bundle 不应写库：${JSON.stringify(beforeRead)} → ${JSON.stringify(afterRead)}`)
  }
  console.log('bundle 只读：模块/hash/确认状态可读，不创建模块/文档/bundle')

  const bundleConfirm = assertOk(await request('POST', '/apps/multi-app/requirements-bundle/confirm'), 'bundle confirm')
  const confirmedBundle = bundleConfirm.bundle as { latest: { version: number; hash: string } | null; bundleHash: string }
  if (!confirmedBundle.latest || confirmedBundle.latest.version !== 1) {
    throw new Error(`bundle confirm 后应有 v1 快照，实际 ${JSON.stringify(confirmedBundle.latest)}`)
  }
  if (confirmedBundle.latest.hash !== confirmedBundle.bundleHash) {
    throw new Error('持久化 bundle hash 与当前聚合 hash 应一致')
  }
  if (bundleConfirm.appConfirmed !== true) throw new Error('bundle confirm 应返回 appConfirmed=true')
  const appAfterBundle = assertOk(await request('GET', '/apps/multi-app'), '读取应用（bundle confirm 后）')
  const appBody = appAfterBundle.app as { status: string; requirementsConfirmedAt: string | null; requirementModules: ModuleView[] }
  if (appBody.status !== 'design' || !appBody.requirementsConfirmedAt) {
    throw new Error('bundle confirm 后应用应进入 design 且 requirements_confirmed_at 有值')
  }
  if (appBody.requirementModules.length !== 2) throw new Error('appPayload.requirementModules 应返回 2 个模块')
  console.log('bundle confirm：生成 v1 快照 + 应用确认 + 进入设计；payload.requirementModules 可用')

  // M5：模块管理（归档/更新/排序）只在需求阶段；这里把应用拉回需求阶段继续验证
  db.prepare("UPDATE apps SET status = 'requirements', requirements_confirmed_at = NULL WHERE id = 'multi-app'").run()
  db.prepare("UPDATE app_requirement_docs SET status = 'draft', confirmed_at = NULL WHERE app_id = 'multi-app'").run()

  // 归档/恢复/守卫
  const archived = assertOk(
    await request('POST', `/apps/multi-app/requirements-modules/${module2}/archive`),
    '归档模块二'
  )
  if (!(archived.module as ModuleView).archived) throw new Error('归档后 archived 应为 true')
  const lastArchive = assertStatus(
    await request('POST', `/apps/multi-app/requirements-modules/${module1}/archive`),
    409,
    '归档最后一个模块'
  )
  if (!/至少保留 1 个未归档模块/.test(String(lastArchive.error ?? ''))) {
    throw new Error(`归档最后一个模块应提示至少保留 1 个，实际 ${JSON.stringify(lastArchive)}`)
  }
  const archivedWrite = assertStatus(
    await request('PUT', `/apps/multi-app/requirements-doc/sections/problem?moduleId=${module2}`, { markdown: 'x' }),
    409,
    '归档模块写入'
  )
  if (!/模块已归档/.test(String(archivedWrite.error ?? ''))) throw new Error('归档模块写入应 409「模块已归档」')
  const archivedRead = assertOk(
    await request('GET', `/apps/multi-app/requirements-doc?moduleId=${module2}`),
    '归档模块读取'
  )
  if (docOf(archivedRead).moduleId !== module2) throw new Error('归档模块应允许读取')
  const missingModule = assertStatus(
    await request('GET', '/apps/multi-app/requirements-doc?moduleId=not-a-module'),
    404,
    '未知模块读取'
  )
  if (!/模块不存在/.test(String(missingModule.error ?? ''))) throw new Error('未知模块应 404「模块不存在」')
  assertOk(await request('POST', `/apps/multi-app/requirements-modules/${module2}/restore`), '恢复模块二')
  const withArchived = modulesOf(
    assertOk(await request('GET', '/apps/multi-app/requirements-modules?includeArchived=true'), '模块列表含归档')
  )
  if (withArchived.length !== 2) throw new Error('includeArchived=true 应返回 2 个模块')
  console.log('模块归档：至少保留 1 个；归档写 409/读允许；未知模块 404；可恢复')

  // 模块更新
  const patched = assertOk(
    await request('PATCH', `/apps/multi-app/requirements-modules/${module2}`, { title: '订单中心', ownerLabel: '李四' }),
    '更新模块'
  )
  const patchedModule = patched.module as ModuleView & { ownerLabel: string }
  if (patchedModule.title !== '订单中心' || patchedModule.ownerLabel !== '李四') {
    throw new Error(`模块更新失败：${JSON.stringify(patchedModule)}`)
  }
  console.log('模块更新：title/ownerLabel 生效')

  const orderResult = assertOk(
    await request('PUT', '/apps/multi-app/requirements-modules/order', { moduleIds: [module2, module1] }),
    '模块排序'
  )
  const ordered = modulesOf(orderResult)
  if (ordered.map(item => item.id).join(',') !== `${module2},${module1}`) {
    throw new Error(`排序后列表顺序不正确：${JSON.stringify(ordered.map(item => item.id))}`)
  }
  if (ordered[0].position !== 0 || ordered[1].position !== 1) throw new Error('排序后 position 应为 0/1')
  const badOrder = assertStatus(
    await request('PUT', '/apps/multi-app/requirements-modules/order', { moduleIds: [module2] }),
    400,
    '排序缺模块'
  )
  if (!/未归档模块/.test(String(badOrder.error ?? ''))) throw new Error('排序缺模块应 400 并提示全部未归档模块')
  assertOk(
    await request('PUT', '/apps/multi-app/requirements-modules/order', { moduleIds: [module1, module2] }),
    '恢复模块顺序'
  )
  console.log('模块排序：合法顺序写 position；缺失/多余 → 400 且不改库')

  // M3：应用级模板预览（只读）+ 应用（所有未归档模块一起切换）
  const m3Counts = (): string => {
    const query = (sql: string): number => (db.prepare(sql).get() as { c: number }).c
    return JSON.stringify({
      docs: query("SELECT COUNT(*) AS c FROM app_requirement_docs WHERE app_id = 'multi-app'"),
      versions: query("SELECT COUNT(*) AS c FROM app_requirement_doc_versions WHERE app_id = 'multi-app'"),
      bundles: query("SELECT COUNT(*) AS c FROM app_requirement_bundles WHERE app_id = 'multi-app'")
    })
  }
  const countsBeforePreview = m3Counts()
  const appPreview = assertOk(
    await request('POST', '/apps/multi-app/requirements-doc/template/preview', {
      templateId: 'builtin-prd-lite',
      scope: 'app'
    }),
    '应用级模板预览'
  )
  const previewModules = appPreview.modules as Array<{
    moduleId: string
    fromSections: number
    toSections: number
    kept: number
    dropped: unknown[]
  }>
  if (previewModules.length !== 2 || appPreview.canApply !== true) {
    throw new Error(`应用级预览应列出 2 个模块且可应用：${JSON.stringify(appPreview)}`)
  }
  if (previewModules.some(item => item.fromSections !== 13 || item.toSections !== 6)) {
    throw new Error('应用级预览 from/to 章节数应 13 → 6')
  }
  if (previewModules.some(item => item.kept !== 6 || item.dropped.length !== 7)) {
    throw new Error('应用级预览 kept/dropped 计数应为 6/7')
  }
  if (m3Counts() !== countsBeforePreview) throw new Error('应用级预览不得写库/产版本')

  const appSwitch = assertOk(
    await request('PUT', '/apps/multi-app/requirements-doc/template', { templateId: 'builtin-prd-lite', scope: 'app' }),
    '应用级模板切换'
  )
  const switchedModules = appSwitch.modules as Array<{ moduleId: string; version: number; sectionCount: number }>
  if (switchedModules.length !== 2 || switchedModules.some(item => item.sectionCount !== 6)) {
    throw new Error(`应用级切换后两个模块都应为 6 节：${JSON.stringify(switchedModules)}`)
  }
  for (const moduleId of [module1, module2]) {
    const doc = assertOk(
      await request('GET', `/apps/multi-app/requirements-doc?moduleId=${moduleId}`),
      '应用级切换后读取模块'
    )
    if (sectionsOf(doc).length !== 6) throw new Error('应用级切换后模块应为 6 节')
    const versions = assertOk(
      await request('GET', `/apps/multi-app/requirements-doc/versions?moduleId=${moduleId}`),
      '应用级切换后版本列表'
    ).versions as Array<{ source: string }>
    if (versions[0].source !== 'template-change') throw new Error('应用级切换版本来源应为 template-change')
  }
  const afterAppSwitch = assertOk(await request('GET', '/apps/multi-app'), '应用级切换后应用')
  if ((afterAppSwitch.app as { requirementTemplateId: string }).requirementTemplateId !== 'builtin-prd-lite') {
    throw new Error('应用级切换应同步应用默认模板')
  }
  console.log('应用级模板切换：预览只读；两模块一起切 6 节，各产 template-change 版本并同步应用默认模板')

  // M3：已确认模块阻止应用级切换（409 + issues，不写库）
  db.prepare("UPDATE app_requirement_docs SET status = 'confirmed' WHERE app_id = 'multi-app' AND module_id = ?").run(module2)
  const countsBeforeBlocked = m3Counts()
  const blockedPreview = assertOk(
    await request('POST', '/apps/multi-app/requirements-doc/template/preview', { templateId: 'builtin-prd' }),
    '阻塞预览'
  )
  if (blockedPreview.canApply !== false || (blockedPreview.blockedModules as unknown[]).length !== 1) {
    throw new Error(`已确认模块应阻止应用级切换：${JSON.stringify(blockedPreview)}`)
  }
  const blockedSwitch = assertStatus(
    await request('PUT', '/apps/multi-app/requirements-doc/template', { templateId: 'builtin-prd', scope: 'app' }),
    409,
    '阻塞切换'
  )
  if ((blockedSwitch.issues as unknown[]).length !== 1) throw new Error('阻塞切换应返回 issues 模块列表')
  if (m3Counts() !== countsBeforeBlocked) throw new Error('阻塞切换不得写任何模块')
  db.prepare("UPDATE app_requirement_docs SET status = 'draft' WHERE app_id = 'multi-app' AND module_id = ?").run(module2)
  console.log('已确认模块阻止：409 + issues，不写任何模块')

  // M3：按模块 doc 对话（旧 key 只读回退 + 模块 key 隔离）
  const legacyChatKey = 'app.multi-app.requirementsDocChat'
  db.prepare('DELETE FROM app_settings WHERE key = ? OR key LIKE ?').run(legacyChatKey, `${legacyChatKey}.%`)
  db.prepare('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)').run(
    legacyChatKey,
    JSON.stringify({ messages: [{ id: 'legacy-1', role: 'user', content: '旧应用级历史' }] }),
    new Date().toISOString()
  )
  const fallbackChat = assertOk(
    await request('GET', `/apps/multi-app/requirements-doc/chat?moduleId=${module1}`),
    '默认模块旧历史回退'
  )
  if (fallbackChat.legacyFallback !== true) throw new Error('默认模块无模块 key 时应回退旧 key')
  const emptyOtherChat = assertOk(
    await request('GET', `/apps/multi-app/requirements-doc/chat?moduleId=${module2}`),
    '非默认模块对话'
  )
  if ((emptyOtherChat.messages as unknown[]).length !== 0) throw new Error('非默认模块不应回退旧 key')
  assertOk(
    await request('PUT', `/apps/multi-app/requirements-doc/chat?moduleId=${module1}`, {
      messages: [{ id: 'm1-1', role: 'user', content: '模块一历史' }]
    }),
    '保存模块一对话'
  )
  const legacyRow = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(legacyChatKey) as
    | { value: string }
    | undefined
  if (!legacyRow || !legacyRow.value.includes('旧应用级历史')) throw new Error('PUT 模块对话不得删除/覆盖旧 key')
  const module1Chat = assertOk(
    await request('GET', `/apps/multi-app/requirements-doc/chat?moduleId=${module1}`),
    '模块一对话'
  )
  if ((module1Chat.messages as Array<{ content: string }>)[0].content !== '模块一历史') {
    throw new Error('模块一对话应独立保存')
  }
  console.log('按模块对话：旧 key 只读回退；模块 key 隔离；PUT 不删旧 key')

  // 恢复原有“模块一 = 标准 PRD（13 节）/ 模块二 = 精简 PRD（6 节）”场景，供后续按模块切换/回滚断言使用
  assertOk(
    await request('PUT', `/apps/multi-app/requirements-doc/template?moduleId=${module1}`, { templateId: 'builtin-prd' }),
    '恢复模块一标准模板'
  )

  const module1VersionsBefore = assertOk(
    await request('GET', `/apps/multi-app/requirements-doc/versions?moduleId=${module1}`),
    '模板切换前模块一版本'
  ).versions as Array<{ version: number }>
  const switched = assertOk(
    await request('PUT', `/apps/multi-app/requirements-doc/template?moduleId=${module2}`, { templateId: 'builtin-prd-lite' }),
    '模块二切换模板'
  )
  if (sectionsOf(switched).length !== 6) throw new Error('模块二精简模板应为 6 节')
  const module1AfterSwitch = assertOk(
    await request('GET', `/apps/multi-app/requirements-doc?moduleId=${module1}`),
    '模板切换后模块一'
  )
  if (sectionsOf(module1AfterSwitch).length !== 13) throw new Error('切换模块二模板不应影响模块一')
  const module1VersionsAfter = assertOk(
    await request('GET', `/apps/multi-app/requirements-doc/versions?moduleId=${module1}`),
    '模板切换后模块一版本'
  ).versions as Array<{ version: number }>
  if (module1VersionsAfter.length !== module1VersionsBefore.length) {
    throw new Error('切换模块二模板不应给模块一产版本')
  }
  console.log('模板切换：scope=module（缺省）只影响当前模块，不重写其它模块；scope=app 已在 M3 段验证')

  const module2Versions = assertOk(
    await request('GET', `/apps/multi-app/requirements-doc/versions?moduleId=${module2}`),
    '模块二版本列表'
  ).versions as Array<{ version: number; source: string }>
  const exported = assertOk(
    await request('GET', `/apps/multi-app/requirements-doc/export?moduleId=${module2}`),
    '模块二导出'
  )
  if (!String(exported.content).includes('模块二的专属问题描述')) throw new Error('模块二导出应包含模块二内容')
  const exportDefault = assertOk(await request('GET', '/apps/multi-app/requirements-doc/export'), '默认模块导出')
  if (String(exportDefault.content).includes('模块二的专属问题描述')) throw new Error('默认模块导出不应包含模块二内容')

  const rollbackTarget = module2Versions[module2Versions.length - 1].version
  const rolled = assertOk(
    await request('POST', `/apps/multi-app/requirements-doc/versions/${rollbackTarget}/rollback?moduleId=${module2}`),
    '模块二回滚'
  )
  if (sectionsOf(rolled).length !== 13) throw new Error('回滚到 v1 应恢复 13 节')
  const module1Unchanged = assertOk(
    await request('GET', `/apps/multi-app/requirements-doc?moduleId=${module1}`),
    '回滚后模块一'
  )
  if (docOf(module1Unchanged).version !== docOf(module1AfterSwitch).version) {
    throw new Error('模块二回滚不应影响模块一版本')
  }
  console.log('rollback/export：按 moduleId 工作，导出互不串，互不影响版本')

  // 单模块应用确认（旧行为：进入 design + bundle v1）
  const singleModuleId = docOf(singleDoc).moduleId
  await fillRequired('single-app', singleModuleId, '单模块')
  const singleConfirm = assertOk(
    await request('POST', `/apps/single-app/requirements-doc/confirm?moduleId=${singleModuleId}`),
    '确认单模块应用'
  )
  if (singleConfirm.appConfirmed !== true) throw new Error('单模块应用确认后应 appConfirmed=true')
  const singleApp = assertOk(await request('GET', '/apps/single-app'), '读取单模块应用（确认后）')
  if ((singleApp.app as { status: string }).status !== 'design') throw new Error('单模块应用确认后应进入 design')
  const singleBundle = assertOk(await request('GET', '/apps/single-app/requirements-bundle'), '读取单模块 bundle')
  if ((singleBundle.bundle as { latest: { version: number } | null }).latest?.version !== 1) {
    throw new Error('单模块确认应生成 bundle v1')
  }
  const singleConfirmAgain = assertOk(
    await request('POST', `/apps/single-app/requirements-doc/confirm?moduleId=${singleModuleId}`),
    '重复确认单模块'
  )
  if (singleConfirmAgain.alreadyConfirmed !== true) throw new Error('重复确认应 alreadyConfirmed=true')
  console.log('单模块确认：与旧行为一致（design + requirements_confirmed_at + bundle v1，重复确认幂等）')

  // 删除应用清理
  assertOk(await request('DELETE', '/apps/multi-app?confirm=true'), '删除多模块应用')
  assertOk(await request('DELETE', '/apps/single-app?confirm=true'), '删除单模块应用')
  for (const appId of ['multi-app', 'single-app']) {
    for (const table of ['app_modules', 'app_requirement_bundles', 'app_requirement_docs']) {
      const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE app_id = ?`).get(appId) as { count: number }
      if (row.count !== 0) throw new Error(`删除应用后 ${table} 未清理：${appId}`)
    }
  }
  console.log('删除应用：app_modules / app_requirement_bundles / 需求文档清理完成')
  console.log('需求模块冒烟通过。')
}

async function cleanup(): Promise<void> {
  try {
    const { db } = await import('../src/db')
    db.close()
  } catch {
    // 数据库未打开时忽略
  }
  try {
    fs.rmSync(root, { recursive: true, force: true })
  } catch {
    // Windows 上 SQLite 句柄释放可能滞后；临时目录留给系统清理
  }
}

main()
  .then(async () => {
    await cleanup()
    process.exit(0)
  })
  .catch(async error => {
    console.error('需求模块冒烟失败：', error)
    await cleanup()
    process.exit(1)
  })
