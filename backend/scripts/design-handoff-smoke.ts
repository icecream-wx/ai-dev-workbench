/**
 * 设计 → 开发交接包（D5）API 冒烟
 *
 * 真实 Express + 临时 SQLite/projects 目录，走：
 * 创建应用 → 结构化需求 → 确认 → 实体/页面集 → 每页 PNG → 确认设计
 * → 交接包 preview（不写盘/不创建变更单）
 * → generate（写盘、Change Set #1、切换到 development、原型 PNG）
 * → GET/文件读取 → 重新生成 v2 → 确认完成（变更单关闭）→ 删除应用清理。
 *
 * 运行：npm run smoke:design-handoff --prefix backend
 * 可选：DESIGN_HANDOFF_SMOKE_DEV=1（额外创建真实 opencode 开发会话，需 opencode 可用）
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-handoff-d5-smoke-'))
const port = Number(process.env.DESIGN_HANDOFF_SMOKE_PORT ?? 3410)
process.env.PORT = String(port)
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_PORT = String(port + 1000)
process.env.OPENCODE_AUTO_START = process.env.DESIGN_HANDOFF_SMOKE_DEV === '1' ? 'true' : 'false'

const base = `http://127.0.0.1:${port}`
const appId = 'handoff-d5-smoke'
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
  const markdown: Record<string, string> = {
    meta: '- 产品：D5 交接冒烟\n- 作者：测试\n- 日期：2026-11-11\n- 版本：v1\n- 状态：已确认',
    problem: '销售靠 Excel 维护客户，容易漏记。',
    goals: '客户查询从 10 分钟降到 1 分钟。',
    users: '- 销售：维护客户',
    scope: '- 本期做：客户列表、创建/编辑/详情\n- 不做：财务对账',
    rules: '- 客户编号唯一\n- 客户名称必填',
    pages: '- 客户列表、创建客户、编辑客户、客户详情',
    acceptance: '- 能创建客户并在列表看到\n- 能按名称查询'
  }
  const initial = assertOk(await request('GET', `/apps/${appId}/requirements-doc`), '初始化需求文档')
  const sections = initial.sections as Array<{ sectionKey: string; required: boolean }>
  for (const section of sections) {
    if (section.sectionKey === 'scenes') {
      assertOk(
        await request('PUT', `/apps/${appId}/requirements-doc/sections/scenes`, {
          data: {
            scenes: [{ title: '客户管理', description: '销售维护客户信息' }],
            epics: [],
            stories: []
          }
        }),
        '保存场景'
      )
      continue
    }
    if (section.sectionKey === 'epics') {
      assertOk(
        await request('PUT', `/apps/${appId}/requirements-doc/sections/epics`, {
          data: {
            scenes: [],
            epics: [{ id: 'EPIC-001', title: '客户管理', goal: '支持销售维护客户信息', priority: 'P0' }],
            stories: [
              {
                id: 'STORY-001',
                epicId: 'EPIC-001',
                title: '创建客户',
                description: '作为销售，我希望创建客户',
                acceptance: ['客户编号唯一', '客户名称必填'],
                priority: 'P0'
              },
              {
                id: 'STORY-002',
                epicId: 'EPIC-001',
                title: '查询客户',
                description: '作为销售，我希望按名称查询客户',
                acceptance: ['能按名称筛选'],
                priority: 'P1'
              }
            ]
          }
        }),
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

async function prepareConfirmedDesign(): Promise<void> {
  const design = assertOk(await request('GET', `/apps/${appId}/design`), '设计项目初始化')
  const project = design as {
    status: string
    requirement: { confirmed: boolean } | null
    entities: Array<Record<string, unknown>>
    pageSets: Array<{ id: string; title: string; pages: Array<{ id: string; title: string; type: string }> }>
    readiness: { ok: boolean; issues: string[] }
  }
  if (!project.requirement?.confirmed) throw new Error('设计项目应读取已确认需求文档')

  let saved = assertOk(
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
            { name: 'level', label: '客户等级', type: 'enum', options: ['普通', 'VIP'] },
            { name: 'active', label: '启用', type: 'boolean', default: true },
            { name: 'creditLimit', label: '授信额度', type: 'decimal', precision: 2 }
          ]
        }
      ]
    }),
    '保存实体'
  )
  saved = assertOk(await request('POST', `/apps/${appId}/design/page-sets/generate`, { mode: 'default' }), '生成页面集').project as Record<
    string,
    unknown
  >
  const pageSets = saved.pageSets as Array<{ id: string; title: string; pages: Array<{ id: string; title: string; type: string }> }>
  if (pageSets.length !== 1) throw new Error(`页面集数量不正确：${pageSets.length}`)
  if (!pageSets[0].pages.some(page => page.type === 'list')) throw new Error('页面集缺少列表页')

  for (const set of pageSets) {
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
  const current = assertOk(await request('GET', `/apps/${appId}/design`), '读取页面集')
  const confirmedEntities = (current.entities as Array<Record<string, unknown>>).map(entity => ({ ...entity, status: 'confirmed' }))
  assertOk(await request('PUT', `/apps/${appId}/design/entities`, { entities: confirmedEntities }), '确认实体')
  for (const set of current.pageSets as Array<{ id: string }>) {
    assertOk(await request('PUT', `/apps/${appId}/design/page-sets/${set.id}`, { status: 'confirmed' }), '确认页面集')
  }
  const confirmed = assertOk(await request('POST', `/apps/${appId}/design/confirm`), '确认设计')
  if ((confirmed.project as { status: string }).status !== 'confirmed') throw new Error('设计未进入 confirmed')
  const app = assertOk(await request('GET', `/apps/${appId}`), '读取应用状态')
  if ((app.app as { status: string }).status !== 'design') throw new Error('确认设计后应用应仍在 design')
  console.log('设计准备：1 实体 / 1 页面集（列表+创建+编辑+详情）/ 每页 PNG / 设计已确认')
}

async function main(): Promise<void> {
  await import('../src/index')
  await waitForHealth()

  assertOk(await request('POST', '/apps', { id: appId, name: 'D5 交接冒烟应用', description: 'D5', backendPort: 8099 }), '创建应用')
  await fillRequirement()
  console.log('需求文档：Scene/Epic/Story 已确认')
  await prepareConfirmedDesign()

  const before = assertOk(await request('GET', `/apps/${appId}/design/handoff`), '读取空交接包')
  if ((before.handoff as unknown) !== null) throw new Error('生成前不应有交接包')

  const preview = assertOk(await request('POST', `/apps/${appId}/design/handoff/preview`), '预览交接包')
  const previewFiles = preview.files as Array<{ name: string; content?: string; kind: string; url?: string }>
  const names = previewFiles.map(file => file.name)
  for (const expected of [
    '00-README.md',
    '01-REQUIREMENTS.md',
    '02-DATA-MODEL.md',
    '03-PAGES.md',
    '04-PLAN.md',
    '05-CHANGES.md',
    'schema.sql',
    'prototype-template.json',
    'manifest.json'
  ]) {
    if (!names.includes(expected)) throw new Error(`预览缺少文件：${expected}`)
  }
  if (!names.some(name => /^prototypes\/MOD-001\/ps-001\/page-\d+\.png$/.test(name))) throw new Error('预览缺少页面 PNG')
  const changeSet = preview.changeSet as { seq: number; title: string; status: string; baselineHandoffVersion: number | null }
  if (
    changeSet.seq !== 1 ||
    changeSet.title !== '初始开发' ||
    changeSet.status !== 'development' ||
    changeSet.baselineHandoffVersion !== null
  ) {
    throw new Error(`预览变更单不正确：${JSON.stringify(changeSet)}`)
  }
  const previewImage = previewFiles.find(file => file.kind === 'image')
  if (!previewImage) throw new Error('预览缺少页面 PNG')
  if (previewImage.url) throw new Error('预览未写盘时不应发 PNG URL')
  const readme = previewFiles.find(file => file.name === '00-README.md')?.content ?? ''
  if (!readme.includes('初始开发') || !readme.includes('status=development')) {
    throw new Error('README 未包含变更单/生成后状态')
  }
  const previewChanges = previewFiles.find(file => file.name === '05-CHANGES.md')?.content ?? ''
  if (!previewChanges.includes('状态：development')) throw new Error('05-CHANGES 未记录生成后状态')
  const plan = previewFiles.find(file => file.name === '04-PLAN.md')?.content ?? ''
  if (!plan.includes('STORY-001')) throw new Error('04-PLAN 未包含 Story')
  // I-09b-1（U6）：小交接包 normal，manifest 记录 scale，04-PLAN/README 不出现建议章节
  const previewScale = preview.scale as { level?: string; suggested?: boolean; phaseCount?: number } | undefined
  if (!previewScale || previewScale.level !== 'normal' || previewScale.suggested !== false) {
    throw new Error(`预览 scale 不正确：${JSON.stringify(previewScale)}`)
  }
  if (previewScale.phaseCount !== 0) throw new Error('小交接包不应派生阶段')
  const previewManifest = JSON.parse(
    previewFiles.find(file => file.name === 'manifest.json')?.content ?? '{}'
  ) as { scale?: { level?: string; suggested?: boolean } }
  if (!previewManifest.scale || previewManifest.scale.level !== 'normal' || previewManifest.scale.suggested !== false) {
    throw new Error(`manifest.scale 不正确：${JSON.stringify(previewManifest.scale)}`)
  }
  if (plan.includes('建议分阶段开发')) throw new Error('小交接包 04-PLAN 不应出现建议分阶段章节')
  const previewReadme = previewFiles.find(file => file.name === '00-README.md')?.content ?? ''
  if (previewReadme.includes('本交接包较大')) throw new Error('小交接包 README 不应出现规模提示')
  const afterPreview = assertOk(await request('GET', `/apps/${appId}/design/handoff`), '预览后读取交接包')
  if ((afterPreview.handoff as unknown) !== null) throw new Error('预览不应写盘/落库')
  console.log('预览：00—05 + schema/template/manifest + prototypes，未写盘、未创建变更单')

  const generated = assertOk(await request('POST', `/apps/${appId}/design/handoff/generate`), '生成交接包')
  const handoff = generated.handoff as { version: number; hash: string; files: Array<{ name: string; kind: string }> }
  if (handoff.version !== 1) throw new Error(`首次交接包应为 v1，实际 ${handoff.version}`)
  if (generated.developmentStarted !== true) throw new Error('首次生成应切换到开发阶段')
  const appAfter = assertOk(await request('GET', `/apps/${appId}`), '生成后应用状态')
  const appPayload = appAfter.app as {
    status: string
    currentChangeSetId?: string
    handoff: { version: number; hash: string; changeSet?: { seq: number; title: string } } | null
    changeSet: { seq: number; title: string } | null
  }
  if (appPayload.status !== 'development') throw new Error(`应用应进入 development，实际 ${appPayload.status}`)
  if (appPayload.handoff?.version !== 1) throw new Error('应用详情未返回交接包摘要')
  if (appPayload.changeSet?.title !== '初始开发') throw new Error('应用详情未返回变更单')
  const docsDir = path.join(root, 'projects', appId, 'docs', 'handoff')
  for (const file of handoff.files) {
    if (!fs.existsSync(path.join(docsDir, file.name))) throw new Error(`交接包文件未写盘：${file.name}`)
  }
  console.log(`生成：v${handoff.version} · hash ${handoff.hash.slice(0, 12)}… · 应用进入 development · Change Set #1`)

  const read = assertOk(await request('GET', `/apps/${appId}/design/handoff`), '读取交接包')
  const readFiles = read.files as Array<{ name: string; kind: string; content: string; url?: string; missing: boolean }>
  if (read.filesAvailable !== true) throw new Error('最新版本文件应可用')
  const readHandoff = read.handoff as { version: number; hash: string; scale?: { level?: string } } | null
  if (readHandoff?.scale?.level !== 'normal') {
    throw new Error(`读取交接包 scale 不正确：${JSON.stringify(readHandoff?.scale)}`)
  }
  const readManifest = JSON.parse(readFiles.find(file => file.name === 'manifest.json')?.content ?? '{}') as {
    scale?: { level?: string; suggested?: boolean }
  }
  if (!readManifest.scale || readManifest.scale.level !== 'normal') {
    throw new Error(`读取 manifest.scale 不正确：${JSON.stringify(readManifest.scale)}`)
  }
  const design = readFiles.find(file => file.name === '03-PAGES.md')
  if (!design?.content.includes('PAGE-001')) throw new Error('03-PAGES 未包含 PAGE-001')
  const image = readFiles.find(file => file.kind === 'image')
  if (!image?.url) throw new Error('PNG 文件缺少预览 URL')
  const firstChanges = readFiles.find(file => file.name === '05-CHANGES.md')?.content ?? ''
  if (!firstChanges.includes('初始开发（无基线差异）') || !firstChanges.includes('状态：development')) {
    throw new Error('v1 05-CHANGES 内容/状态不正确')
  }
  const imageRes = await fetch(`${base}${image.url}`)
  if (!imageRes.ok) throw new Error(`读取 PNG 文件失败（HTTP ${imageRes.status}）`)
  if (!/image\/png/.test(imageRes.headers.get('content-type') ?? '')) throw new Error('PNG 文件 Content-Type 不正确')
  const traversal = await request('GET', `/apps/${appId}/design/handoff/files/${encodeURIComponent('../user-config.xml')}`)
  assertStatus(traversal, 400, '路径穿越')
  console.log('读取：文件内容 + PNG 预览 + 路径穿越拒绝')

  const regenerated = assertOk(await request('POST', `/apps/${appId}/design/handoff/generate`), '重新生成交接包')
  const second = regenerated.handoff as { version: number }
  if (second.version !== 2) throw new Error(`重新生成应为 v2，实际 ${second.version}`)
  if (regenerated.developmentStarted !== false) throw new Error('开发阶段重新生成不应重复切换阶段')
  const changeSets = regenerated.changeSet as { seq: number; id: string }
  if (changeSets.seq !== 1) throw new Error('重新生成不应创建新的变更单')
  const latest = assertOk(await request('GET', `/apps/${appId}/design/handoff`), '读取 v2 交接包')
  const latestFiles = latest.files as Array<{ name: string; kind: string; content: string; url?: string; missing: boolean }>
  const latestChanges = latestFiles.find(file => file.name === '05-CHANGES.md')?.content ?? ''
  if (!latestChanges.includes('同一变更单 #1 内重新生成')) throw new Error('v2 05-CHANGES 未提示重新生成')
  if (latestChanges.includes('这是应用的首次开发')) throw new Error('v2 05-CHANGES 仍自称首次开发')
  const old = assertOk(await request('GET', `/apps/${appId}/design/handoff?version=1`), '读取历史版本')
  if (old.filesAvailable !== false) throw new Error('历史版本文件应标记为已覆盖')
  const oldImage = (old.files as Array<{ kind: string; missing: boolean; url?: string }>).find(file => file.kind === 'image')
  if (!oldImage?.missing) throw new Error('历史版本 PNG 应标记为不可用')
  if (oldImage.url) throw new Error('历史版本不应发 PNG URL')
  console.log('重新生成：v2 明确“同变更单重新生成/增量修改”，复用 Change Set #1，历史 PNG 不再发 URL')

  // 缺 PNG 阻塞：删掉设计阶段的页面截图后预览应 400
  const designNow = assertOk(await request('GET', `/apps/${appId}/design`), '读取设计页面') as {
    pageSets: Array<{ pages: Array<{ id: string; imagePath: string | null }> }>
  }
  const designPage = designNow.pageSets[0].pages[0]
  if (!designPage.imagePath) throw new Error('设计页面缺少 imagePath')
  fs.rmSync(path.join(root, 'projects', appId, designPage.imagePath))
  const blocked = await request('POST', `/apps/${appId}/design/handoff/preview`)
  assertStatus(blocked, 400, '缺 PNG 预览')
  const issues = (blocked.data as { issues?: string[] }).issues ?? []
  if (!issues.some(issue => issue.includes('原型 PNG 文件不存在'))) {
    throw new Error(`缺 PNG 校验未给出明确 issues：${JSON.stringify(issues)}`)
  }
  console.log('校验：页面 PNG 缺失时阻塞并给出 issues')

  if (process.env.DESIGN_HANDOFF_SMOKE_DEV === '1') {
    const session = await request('POST', `/apps/${appId}/development/session`)
    if (session.status >= 200 && session.status < 300) {
      const info = session.data as { session: { handoffVersion: number | null; changeSetId: string | null } }
      if (info.session.handoffVersion !== 2) throw new Error('开发会话未记录交接包版本')
      if (!info.session.changeSetId) throw new Error('开发会话未记录变更单')
      console.log('开发会话：记录 handoff v2 / Change Set #1')
    } else {
      console.log(`开发会话创建跳过（HTTP ${session.status}）：${JSON.stringify(session.data)}`)
    }
  } else {
    console.log('开发会话创建未验证（DESIGN_HANDOFF_SMOKE_DEV=1 可开启）')
  }

  assertOk(await request('POST', `/apps/${appId}/complete`), '确认完成')
  const changeSetAfter = assertOk(await request('GET', `/apps/${appId}`), '完成后应用状态') as {
    app: { status: string; changeSet: { status: string } | null }
  }
  if (changeSetAfter.app.status !== 'completed') throw new Error('应用应为 completed')
  if (changeSetAfter.app.changeSet?.status !== 'completed') throw new Error('变更单应关闭为 completed')
  console.log('完成：应用 completed，Change Set #1 已关闭')

  assertOk(await request('DELETE', `/apps/${appId}?confirm=true`), '删除应用')
  const gone = await request('GET', `/apps/${appId}`)
  assertStatus(gone, 404, '删除后应用')
  console.log('删除应用：登记/目录/交接包/变更单清理')
}

main()
  .then(() => {
    console.log('\n设计→开发交接包冒烟通过')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n设计→开发交接包冒烟失败：', error)
    process.exit(1)
  })
