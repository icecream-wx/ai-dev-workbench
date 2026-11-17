/**
 * 设计阶段（D1—D4）API 冒烟
 *
 * 真实 Express + 临时 SQLite/projects 目录，走：
 * 创建应用 → 填写并确认需求文档 → 设计项目初始化（默认原型模板）
 * → 保存实体 → 按模板生成页面集 → 保存页面规格 → 上传 PNG 快照并读取
 * → 实体/页面集确认 → 设计确认（记录状态，不切换开发阶段）
 * → 切换原型模板/版本 → 删除应用清理。
 *
 * 运行：npm run smoke:design --prefix backend
 * 可选：DESIGN_SMOKE_AI=1（真实模型生成实体/页面集，需 opencode + 模型可用）
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-design-smoke-'))
const port = Number(process.env.DESIGN_SMOKE_PORT ?? 3407)
process.env.PORT = String(port)
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_PORT = String(port + 1000)
process.env.OPENCODE_AUTO_START = process.env.DESIGN_SMOKE_AI === '1' ? 'true' : 'false'

const base = `http://127.0.0.1:${port}`
const appId = 'design-smoke'

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

async function fillRequirement(): Promise<void> {
  const required: Record<string, string> = {
    meta: '- 产品：设计阶段冒烟\n- 作者：测试\n- 日期：2026-11-10\n- 版本：v1\n- 状态：草稿',
    problem: '运营需要维护客户与订单，当前靠 Excel。',
    goals: '客户/订单查询时间从 10 分钟降到 1 分钟。',
    users: '- 销售：维护客户和订单\n- 主管：查看全部',
    scope: '- 本期做：客户列表、订单列表、创建/详情\n- 不做：财务对账',
    scenes: '### 客户管理\n销售维护客户，并为客户创建订单。\n### 订单管理\n销售查看订单列表、创建订单并跟踪状态。',
    epics:
      '### Epic 1：客户管理\n- 作为销售，我希望维护客户信息，以便跟进。\n### Epic 2：订单管理\n- 作为销售，我希望创建订单，以便记录成交。',
    rules: '- 一个客户多个订单\n- 订单金额保留两位小数\n- 订单状态：草稿/已提交/已完成',
    pages: '- 客户列表、客户详情\n- 订单列表、创建订单、订单详情',
    acceptance: '- 能维护客户\n- 能创建订单并查看列表/详情'
  }
  const initial = assertOk(await request('GET', `/apps/${appId}/requirements-doc`), '初始化需求文档')
  const sections = initial.sections as Array<{ sectionKey: string; required: boolean }>
  for (const section of sections) {
    if (!section.required) continue
    assertOk(
      await request('PUT', `/apps/${appId}/requirements-doc/sections/${section.sectionKey}`, {
        markdown: required[section.sectionKey] ?? '测试内容'
      }),
      `保存需求章节 ${section.sectionKey}`
    )
  }
  assertOk(await request('POST', `/apps/${appId}/requirements-doc/confirm`), '确认需求文档')
}

async function main(): Promise<void> {
  await import('../src/index')
  await waitForHealth()

  const templates = assertOk(await request('GET', '/prototype-templates'), '读取原型模板')
  const list = templates.templates as Array<{ id: string; builtin: boolean; category: string }>
  if (list.length !== 2) throw new Error(`内置原型模板应为 2 个，实际 ${list.length}`)
  if (!list.some(item => item.id === 'builtin-prototype-enterprise' && item.builtin)) {
    throw new Error('缺少企业级内置原型模板')
  }
  console.log('原型模板 seed：2 个内置模板（企业级/简洁）')

  const created = assertOk(
    await request('POST', '/apps', { id: appId, name: '设计阶段冒烟应用', description: 'D1—D4', backendPort: 8099 }),
    '创建应用'
  )
  if ((created.app as { status: string }).status !== 'requirements') throw new Error('新应用应在需求阶段')
  await fillRequirement()
  console.log('需求文档已填写并确认')

  const design = assertOk(await request('GET', `/apps/${appId}/design`), '设计项目初始化')
  const project = design as {
    template: { id: string }
    status: string
    version: number
    requirement: { confirmed: boolean; version: number } | null
    readiness: { ok: boolean; issues: string[] }
  }
  if (project.template.id !== 'builtin-prototype-enterprise') throw new Error('默认原型模板不正确')
  if (project.status !== 'draft' || project.version !== 1) throw new Error('设计项目应为 v1/draft')
  if (!project.requirement?.confirmed) throw new Error('设计项目应读取已确认需求文档')
  if (project.readiness.ok) throw new Error('无实体时不应可确认')
  console.log('设计项目初始化：默认企业级模板，读取需求文档 v' + project.requirement.version)

  const entities = [
    {
      name: '客户',
      tableName: 'biz_customer',
      description: '客户主表',
      fields: [
        { name: 'customerNo', label: '客户编号', type: 'string', required: true, unique: true },
        { name: 'customerName', label: '客户名称', type: 'string', required: true },
        { name: 'level', label: '客户等级', type: 'enum', options: ['普通', '重要', 'VIP'] }
      ],
      relations: [{ name: '订单', type: 'one-to-many', target: '订单' }]
    },
    {
      name: '订单',
      tableName: 'biz_order',
      description: '订单主表',
      fields: [
        { name: 'customerId', label: '客户', type: 'ref', ref: '客户', required: true },
        { name: 'orderNo', label: '订单号', type: 'string', required: true, unique: true },
        { name: 'amount', label: '金额', type: 'decimal', precision: 2 },
        { name: 'status', label: '状态', type: 'enum', options: ['草稿', '已提交', '已完成'] }
      ],
      relations: [{ name: '所属客户', type: 'many-to-one', target: '客户' }]
    }
  ]
  let saved = assertOk(await request('PUT', `/apps/${appId}/design/entities`, { entities }), '保存实体')
  const savedEntities = saved.entities as Array<{ id: string; name: string; fields: Array<{ ref?: string }>; relations: Array<{ target: string }> }>
  if (savedEntities.length !== 2) throw new Error('实体保存数量不正确')
  const customer = savedEntities.find(item => item.name === '客户')
  const order = savedEntities.find(item => item.name === '订单')
  if (!customer || !order) throw new Error('缺少客户/订单实体')
  if (order.fields.find(field => field.ref)?.ref !== customer.id) throw new Error('ref 字段未解析为实体 id')
  if (order.relations[0]?.target !== customer.id) throw new Error('关系未解析为实体 id')
  const afterEntitiesVersion = (saved as { version: number }).version
  if (afterEntitiesVersion !== 1) throw new Error(`实体自动保存不应产版本，期望 v1，实际 v${afterEntitiesVersion}`)
  const afterEntitiesVersions = assertOk(await request('GET', `/apps/${appId}/design/versions`), '读取实体保存后版本') as {
    versions: Array<{ version: number; source: string }>
  }
  if (afterEntitiesVersions.versions.length !== 1) {
    throw new Error(`实体自动保存后版本数应仍为 1，实际 ${afterEntitiesVersions.versions.length}`)
  }
  console.log('实体保存：2 个实体，ref/关系名称已解析为实体 id；自动保存不产版本')

  const generated = assertOk(await request('POST', `/apps/${appId}/design/page-sets/generate`, { mode: 'default' }), '生成页面集')
  saved = generated.project as Record<string, unknown>
  const generatedVersion = (saved as { version: number }).version
  if (generatedVersion !== 2) throw new Error(`默认页面集生成应产 manual 版本 v2，实际 v${generatedVersion}`)
  const pageSets = saved.pageSets as Array<{
    id: string
    title: string
    pages: Array<{ id: string; type: string; spec: { columns?: string[]; mode?: string } }>
  }>
  if (pageSets.length !== 2) throw new Error(`页面集数量不正确：${pageSets.length}`)
  if (pageSets.map(set => set.title).join(',') !== '客户管理,订单管理') {
    throw new Error(`页面集应按场景命名，实际：${pageSets.map(set => set.title).join(',')}`)
  }
  if (pageSets[0].pages.map(page => page.type).join(',') !== 'list,form,form,detail') {
    throw new Error('默认页面集应包含列表/创建表单/编辑表单/详情')
  }
  if (pageSets[0].pages.filter(page => page.type === 'form').map(page => page.spec.mode).join(',') !== 'create,edit') {
    throw new Error('创建/编辑表单应分开并带 mode')
  }
  console.log('页面集生成：按场景 2 个页面集，每个含列表/创建/编辑/详情')

  const listPage = pageSets[0].pages[0]
  saved = assertOk(
    await request('PUT', `/apps/${appId}/design/pages/${listPage.id}`, {
      title: '客户列表（改）',
      spec: { ...listPage.spec, columns: ['customerNo', 'customerName', 'level'], acceptance: ['能按名称查询客户'] },
      layout: { table: { columns: ['customerNo', 'customerName', 'level'], searchFields: ['customerName'], pageSize: 10 } }
    }),
    '保存页面规格'
  )
  const updatedPage = (saved.pageSets as typeof pageSets)[0].pages[0]
  if (updatedPage.spec.columns?.length !== 3) throw new Error('页面规格列未保存')
  if ((saved as { version: number }).version !== generatedVersion) throw new Error('页面规格保存不应产版本')
  console.log('页面规格保存：自定义列/查询字段/验收；自动保存不产版本')

  const badSnapshot = await request('POST', `/apps/${appId}/design/pages/${listPage.id}/snapshot`, {
    imageBase64: Buffer.from('not-a-png').toString('base64')
  })
  if (badSnapshot.status !== 400) throw new Error(`非 PNG 快照应返回 400，实际 ${badSnapshot.status}`)
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]).toString('base64')
  const snap = assertOk(
    await request('POST', `/apps/${appId}/design/pages/${listPage.id}/snapshot`, {
      imageBase64: `data:image/png;base64,${png}`,
      html: '<div class="prototype">客户列表</div>'
    }),
    '上传 PNG 快照'
  )
  const snapshotPage = snap.page as { imagePath: string; htmlPath: string; imageHash: string }
  if (!snapshotPage.imagePath.startsWith('docs/design/prototypes/')) throw new Error('快照路径不正确')
  if (!snapshotPage.imageHash) throw new Error('快照缺少 hash')
  if ((snap.project as { version: number }).version !== generatedVersion) throw new Error('PNG 快照不应产版本')
  const imageRes = await fetch(`${base}/api/apps/${appId}/design/pages/${listPage.id}/image`)
  if (!imageRes.ok) throw new Error(`读取 PNG 失败（HTTP ${imageRes.status}）`)
  if (!fs.existsSync(path.join(root, 'projects', appId, snapshotPage.imagePath))) throw new Error('PNG 未写入应用目录')
  const htmlRes = await fetch(`${base}/api/apps/${appId}/design/pages/${listPage.id}/html`)
  if (!htmlRes.ok) throw new Error(`读取 HTML 失败（HTTP ${htmlRes.status}）`)
  if (!/text\/plain/.test(htmlRes.headers.get('content-type') ?? '')) throw new Error('HTML 快照不应以 text/html 返回')
  if (!/attachment/i.test(htmlRes.headers.get('content-disposition') ?? '')) throw new Error('HTML 快照应作为附件下载')
  console.log('PNG 快照：PNG 魔数校验 + 写应用目录 + hash + 图片读取；HTML 以 text/plain 附件返回')

  const beforeConfirm = await request('POST', `/apps/${appId}/design/confirm`)
  if (beforeConfirm.status !== 400) throw new Error(`实体/页面集未确认时应 400，实际 ${beforeConfirm.status}`)
  console.log('设计确认校验：未确认时 400 + issues')

  const confirmedEntities = (saved.entities as Array<Record<string, unknown>>).map(entity => ({ ...entity, status: 'confirmed' }))
  const afterConfirmEntities = assertOk(
    await request('PUT', `/apps/${appId}/design/entities`, { entities: confirmedEntities }),
    '确认实体'
  )
  if ((afterConfirmEntities as { version: number }).version !== generatedVersion) {
    throw new Error('单个/全部实体确认不应产版本')
  }
  const current = assertOk(await request('GET', `/apps/${appId}/design`), '读取页面集')
  const currentSets = current.pageSets as Array<Record<string, unknown>>
  for (const set of currentSets) {
    const afterConfirmSet = assertOk(
      await request('PUT', `/apps/${appId}/design/page-sets/${set.id}`, { status: 'confirmed' }),
      '确认页面集'
    )
    if ((afterConfirmSet as { version: number }).version !== generatedVersion) {
      throw new Error('单个页面集确认不应产版本')
    }
  }
  const confirmed = assertOk(await request('POST', `/apps/${appId}/design/confirm`), '确认设计')
  const confirmedProject = confirmed.project as { status: string; version: number }
  if (confirmedProject.status !== 'confirmed') throw new Error('设计未进入 confirmed')
  if (confirmedProject.version !== generatedVersion + 1) {
    throw new Error(`确认设计应 +1 产 confirm 版本（v${generatedVersion + 1}），实际 v${confirmedProject.version}`)
  }
  const afterConfirmVersions = assertOk(await request('GET', `/apps/${appId}/design/versions`), '读取确认后版本') as {
    versions: Array<{ version: number; source: string }>
  }
  const confirmVersion = afterConfirmVersions.versions.find(item => item.version === confirmedProject.version)
  if (confirmVersion?.source !== 'confirm') {
    throw new Error(`确认版本来源应为 confirm，实际 ${JSON.stringify(confirmVersion)}`)
  }
  const appAfter = assertOk(await request('GET', `/apps/${appId}`), '读取应用状态')
  if ((appAfter.app as { status: string }).status !== 'design') {
    throw new Error('设计确认后应用应仍在 design（交接包生成时才进入 development）')
  }
  console.log('设计确认：status=confirmed，生成 confirm 版本 v' + confirmedProject.version + '，应用仍停留在 design')
  const confirmedAgain = assertOk(await request('POST', `/apps/${appId}/design/confirm`), '重复确认设计')
  if ((confirmedAgain.project as { version: number }).version !== confirmedProject.version) {
    throw new Error('重复确认设计不应再产版本')
  }

  const blockedAfterConfirm = await request('PUT', `/apps/${appId}/design/template`, { templateId: 'builtin-prototype-minimal' })
  if (blockedAfterConfirm.status !== 409) throw new Error(`确认后切换模板应返回 409，实际 ${blockedAfterConfirm.status}`)
  const blockedManualVersion = await request('POST', `/apps/${appId}/design/versions`)
  if (blockedManualVersion.status !== 409) throw new Error(`确认后手动保存版本应返回 409，实际 ${blockedManualVersion.status}`)
  const reopened = assertOk(await request('POST', `/apps/${appId}/design/reopen`), '重新编辑设计')
  if ((reopened.project as { status: string }).status !== 'draft') throw new Error('重新编辑后应为 draft')
  console.log('设计只读：确认后修改/手动保存版本返回 409；重新编辑后回到 draft')

  const visible = assertOk(await request('GET', `/apps/${appId}/design`), '读取确认后设计')
  const beforeTemplate = (visible.pageSets as Array<{ pages: Array<{ id: string }> }>)[0].pages[0].id
  const versionBeforeTemplate = (visible as { version: number }).version
  const switched = assertOk(
    await request('PUT', `/apps/${appId}/design/template`, { templateId: 'builtin-prototype-minimal' }),
    '切换原型模板'
  )
  const afterTemplate = (switched.pageSets as Array<{ pages: Array<{ id: string }> }>)[0].pages[0].id
  if (afterTemplate !== beforeTemplate) throw new Error('切换模板后 page id 应保留')
  if ((switched.template as { id: string }).id !== 'builtin-prototype-minimal') throw new Error('模板切换未生效')
  if ((switched.status as string) !== 'draft') throw new Error('切换模板后设计应回到 draft')
  if ((switched as { version: number }).version !== versionBeforeTemplate + 1) {
    throw new Error('切换模板应产 template-change 版本')
  }
  console.log('模板切换：保留 page id，生成 template-change 版本并回到 draft')

  const manual = assertOk(await request('POST', `/apps/${appId}/design/versions`), '手动保存版本')
  const manualVersion = (manual as { version: number }).version
  if (manualVersion !== versionBeforeTemplate + 2) {
    throw new Error(`手动保存版本应 +1（v${versionBeforeTemplate + 2}），实际 v${manualVersion}`)
  }
  const manualAgain = assertOk(await request('POST', `/apps/${appId}/design/versions`), '再次手动保存版本')
  if ((manualAgain as { version: number }).version !== manualVersion + 1) {
    throw new Error('再次手动保存版本应正常递增')
  }
  console.log('手动保存版本：v' + manualVersion + '/v' + (manualVersion + 1) + ' 来源 manual')

  const reconfirmed = assertOk(await request('POST', `/apps/${appId}/design/confirm`), '再次确认设计')
  const reconfirmedVersion = (reconfirmed.project as { version: number }).version
  if (reconfirmedVersion !== manualVersion + 2) {
    throw new Error(`再次确认应 +1 产 confirm 版本，实际 v${reconfirmedVersion}`)
  }

  const versions = assertOk(await request('GET', `/apps/${appId}/design/versions`), '版本列表') as {
    versions: Array<{ version: number; source: string; changeSetSeq: number | null }>
  }
  const versionList = versions.versions
  if (!versionList.length) throw new Error('缺少设计版本')
  if (versionList[0].version !== reconfirmedVersion || versionList[0].source !== 'confirm') {
    throw new Error(`最新版本应为 confirm/v${reconfirmedVersion}，实际 ${JSON.stringify(versionList[0])}`)
  }
  for (const expected of ['manual', 'template-change', 'confirm']) {
    if (!versionList.some(item => item.source === expected)) throw new Error(`版本列表缺少来源：${expected}`)
  }
  const manualEntry = versionList.find(item => item.version === manualVersion)
  if (manualEntry?.source !== 'manual') throw new Error(`v${manualVersion} 来源应为 manual`)
  if (manualEntry?.changeSetSeq !== null) throw new Error('非变更单版本 changeSetSeq 应为 null')
  console.log('版本列表：', versionList.length, '个（含 confirm/manual/template-change）')

  assertOk(await request('DELETE', `/apps/${appId}?confirm=true`), '删除应用')
  const gone = await request('GET', `/apps/${appId}`)
  if (gone.status !== 404) throw new Error('删除后应用应 404')
  console.log('删除应用：登记/目录/设计数据清理')

  if (process.env.DESIGN_SMOKE_AI === '1') {
    console.log('DESIGN_SMOKE_AI=1：真实模型生成步骤需在应用重建后单独执行，本冒烟不自动触发')
  }
}

main()
  .then(() => {
    console.log('\n设计阶段冒烟通过')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n设计阶段冒烟失败：', error)
    process.exit(1)
  })
