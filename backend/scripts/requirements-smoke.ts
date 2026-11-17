/**
 * 需求文档化（R1）API 冒烟
 *
 * 使用临时 data/projects 目录启动真实工作台后端，走：
 * 模板 seed → 创建应用（doc 模式）→ 文档初始化 → 章节保存 → 版本回滚
 * → 模板切换 → 确认需求（校验/切阶段）→ 只读导出 → 设计阶段 R3 提示
 * → 删除应用（目录/登记/文档/会话清理）。
 *
 * 运行：npm run smoke:requirements --prefix backend
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-reqdoc-smoke-'))
const port = Number(process.env.REQDOC_SMOKE_PORT ?? 3401)
process.env.PORT = String(port)
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_PORT = String(port + 1000)
process.env.OPENCODE_AUTO_START = 'false'

const base = `http://127.0.0.1:${port}`
const appId = 'reqdoc-smoke'

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

interface DocSection {
  sectionKey: string
  title: string
  markdown: string
  required: boolean
}

function sectionsOf(payload: Record<string, unknown>): DocSection[] {
  return payload.sections as DocSection[]
}

function docOf(payload: Record<string, unknown>): { version: number; status: string; contentMd: string; title: string } {
  return payload.doc as { version: number; status: string; contentMd: string; title: string }
}

async function main(): Promise<void> {
  await import('../src/index')
  await waitForHealth()

  const templates = assertOk(await request('GET', '/requirement-templates?stage=requirements'), '读取需求模板')
  const list = templates.templates as Array<{ id: string; sections: unknown[]; builtin: boolean }>
  if (list.length !== 3) throw new Error(`需求模板应为 3 个，实际 ${list.length}`)
  const prd = list.find(item => item.id === 'builtin-prd')
  if (!prd || prd.sections.length !== 13 || !prd.builtin) throw new Error('内置标准 PRD 缺失或章节数不对')
  console.log('模板 seed：需求阶段 3 个；标准 PRD 13 节；QA 模板归测试阶段')

  const { db } = await import('../src/db')
  const nowIso = new Date().toISOString()
  db.prepare(`
    INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
    VALUES ('ghost-smoke', '不存在目录的应用', '守卫测试', 'ghost-smoke', 8097, 'requirements', ?, ?)
  `).run(nowIso, nowIso)
  const ghostDoc = await request('GET', '/apps/ghost-smoke/requirements-doc')
  if (ghostDoc.status !== 200) throw new Error(`已登记应用应可读取文档（按模板初始化），实际 ${ghostDoc.status}`)
  const missingDoc = await request('GET', '/apps/missing-smoke/requirements-doc')
  if (missingDoc.status !== 404) throw new Error(`未登记应用读取文档应 404，实际 ${missingDoc.status}`)
  db.prepare("DELETE FROM app_requirement_docs WHERE app_id = 'ghost-smoke'").run()
  db.prepare("DELETE FROM app_requirement_doc_sections WHERE app_id = 'ghost-smoke'").run()
  db.prepare("DELETE FROM app_requirement_doc_versions WHERE app_id = 'ghost-smoke'").run()
  db.prepare("DELETE FROM apps WHERE id = 'ghost-smoke'").run()
  console.log('应用存在性守卫：已登记 200 / 未登记 404')

  const created = assertOk(
    await request('POST', '/apps', { id: appId, name: '需求文档冒烟应用', description: '验证 R1 文档链路', backendPort: 8098 }),
    '创建应用'
  )
  const createdApp = created.app as { status: string }
  if (createdApp.status !== 'requirements') throw new Error('新应用应处于需求阶段')
  console.log('创建应用：', appId)

  const initial = assertOk(await request('GET', `/apps/${appId}/requirements-doc`), '文档初始化')
  let doc = docOf(initial)
  if (doc.version !== 1 || doc.status !== 'draft') throw new Error('初始文档应为 v1/draft')
  if (sectionsOf(initial).length !== 13) throw new Error('初始章节应为 13')
  if (!/^# 需求文档冒烟应用 需求文档/.test(doc.contentMd)) throw new Error('文档标题拼接不正确')
  console.log('文档初始化：v1 draft，13 章节')

  const initialVersion = doc.version
  const savedProblem = assertOk(
    await request('PUT', `/apps/${appId}/requirements-doc/sections/problem`, { markdown: '运营需要季度报表，当前靠手工 Excel。' }),
    '保存章节'
  )
  doc = docOf(savedProblem)
  if (doc.version !== initialVersion) throw new Error(`章节自动保存不应产版本，期望 v${initialVersion}，实际 v${doc.version}`)
  const savedGoals = assertOk(
    await request('PUT', `/apps/${appId}/requirements-doc/sections/goals`, { markdown: '季度报表生成时间从 2 天降到 30 分钟。' }),
    '保存第二个章节'
  )
  if (docOf(savedGoals).version !== initialVersion) throw new Error('第二次自动保存也不应产版本')
  const versionsAfterAutoSave = (
    assertOk(await request('GET', `/apps/${appId}/requirements-doc/versions`), '读取自动保存后版本列表').versions as unknown[]
  ).length
  if (versionsAfterAutoSave !== 1) throw new Error(`自动保存后版本数应仍为 1，实际 ${versionsAfterAutoSave}`)
  console.log('自动保存：内容更新但版本保持 v' + initialVersion)

  const manual = assertOk(await request('POST', `/apps/${appId}/requirements-doc/versions`), '手动保存版本')
  doc = docOf(manual)
  if (doc.version !== initialVersion + 1) throw new Error(`手动保存版本应为 v${initialVersion + 1}，实际 v${doc.version}`)
  if (!doc.contentMd.includes('运营需要季度报表')) throw new Error('手动保存版本缺少章节内容')
  const versions = assertOk(await request('GET', `/apps/${appId}/requirements-doc/versions`), '版本列表')
  const versionList = versions.versions as Array<{ version: number; source: string; changeSetSeq: number | null }>
  const manualVersion = versionList.find(item => item.version === initialVersion + 1)
  if (manualVersion?.source !== 'manual') throw new Error('手动保存版本 source 应为 manual')
  if (manualVersion.changeSetSeq !== null) throw new Error('非变更中的版本 changeSetSeq 应为 null')
  const v2 = assertOk(await request('GET', `/apps/${appId}/requirements-doc/versions/${initialVersion + 1}`), '版本详情')
  if (!(v2.version as { contentMd: string }).contentMd.includes('运营需要季度报表')) throw new Error('版本内容缺失')
  console.log('手动保存版本：v' + manualVersion.version + ' source=manual，非变更单版本')

  // 变更中版本：直接插入变更单行（不做完整发起流程），验证版本列表返回 changeSetSeq
  const { db: smokeDb } = await import('../src/db')
  const smokeNow = new Date().toISOString()
  smokeDb.prepare(`
    INSERT INTO app_change_sets (id, app_id, seq, title, description, scope, status, created_at, updated_at)
    VALUES ('cs-smoke-r2b', ?, 7, '冒烟变更', '', 'requirements', 'requirements', ?, ?)
  `).run(appId, smokeNow, smokeNow)
  const manualInChange = assertOk(await request('POST', `/apps/${appId}/requirements-doc/versions`), '变更中手动保存版本')
  const changedVersion = docOf(manualInChange).version
  const changedList = (
    assertOk(await request('GET', `/apps/${appId}/requirements-doc/versions`), '变更中版本列表').versions as Array<{
      version: number
      changeSetSeq: number | null
    }>
  ).find(item => item.version === changedVersion)
  if (changedVersion !== manualVersion.version + 1 || changedList?.changeSetSeq !== 7) {
    throw new Error(`变更中版本应带 changeSetSeq=7，实际 ${JSON.stringify(changedList)}`)
  }
  const changedDetail = assertOk(
    await request('GET', `/apps/${appId}/requirements-doc/versions/${changedVersion}`),
    '变更中版本详情'
  )
  if ((changedDetail.version as { changeSetSeq: number | null }).changeSetSeq !== 7) {
    throw new Error('版本详情应返回 changeSetSeq')
  }
  smokeDb.prepare("DELETE FROM app_change_sets WHERE id = 'cs-smoke-r2b'").run()
  console.log('版本列表：变更单内版本返回 changeSetSeq=7')

  assertOk(
    await request('PUT', `/apps/${appId}/requirements-doc/sections/problem`, { markdown: '回滚前再次修改的问题描述' }),
    '回滚前自动保存'
  )
  const rolled = assertOk(
    await request('POST', `/apps/${appId}/requirements-doc/versions/${changedVersion}/rollback`),
    '版本回滚'
  )
  const rolledProblem = sectionsOf(rolled).find(section => section.sectionKey === 'problem')
  if (!rolledProblem?.markdown.includes('运营需要季度报表')) throw new Error('回滚未恢复章节内容')
  const rolledVersion = (assertOk(await request('GET', `/apps/${appId}/requirements-doc/versions`), '回滚后版本列表').versions as Array<{
    version: number
    source: string
  }>)[0]
  if (rolledVersion.source !== 'rollback') throw new Error(`回滚版本 source 应为 rollback，实际 ${rolledVersion.source}`)
  console.log('版本回滚：内容恢复，生成 rollback 版本')

  const switched = assertOk(
    await request('PUT', `/apps/${appId}/requirements-doc/template`, { templateId: 'builtin-prd-lite' }),
    '切换模板'
  )
  if (sectionsOf(switched).length !== 6) throw new Error('精简 PRD 应为 6 节')
  if (!sectionsOf(switched).find(section => section.sectionKey === 'problem')?.markdown.includes('运营需要季度报表')) {
    throw new Error('切换模板未按标题保留内容')
  }
  const back = assertOk(
    await request('PUT', `/apps/${appId}/requirements-doc/template`, { templateId: 'builtin-prd' }),
    '切回标准 PRD'
  )
  if (sectionsOf(back).length !== 13) throw new Error('切回标准 PRD 应为 13 节')
  console.log('模板切换：精简 6 节 ↔ 标准 13 节，内容按标题保留')

  // ---- R2a：AI 建议预览 / 应用选中 / 忽略 / 模板删除保护 ----
  assertOk(
    await request('PUT', `/apps/${appId}/requirements-doc/sections/custom-note`, {
      title: 'AI 补充说明',
      markdown: '稍后会被删除的自定义章节'
    }),
    '新增自定义章节'
  )
  const beforePreview = assertOk(await request('GET', `/apps/${appId}/requirements-doc`), '读取预览前文档')
  const beforePreviewVersion = docOf(beforePreview).version
  const versionsBeforePreview = (
    assertOk(await request('GET', `/apps/${appId}/requirements-doc/versions`), '读取预览前版本列表').versions as unknown[]
  ).length

  const preview = assertOk(
    await request('POST', `/apps/${appId}/requirements-doc/preview`, {
      title: 'AI 建议标题',
      contentMd: ['# AI 建议标题', '', '## 问题与机会', '', '预览修改后的问题描述', '', '## 目标与成功指标', '', '预览目标'].join('\n')
    }),
    'AI 建议预览'
  )
  const previewSections = preview.sections as Array<{ sectionKey: string; change: string }>
  if (previewSections.find(section => section.sectionKey === 'problem')?.change !== 'modified') {
    throw new Error('预览应标记问题章节为 modified')
  }
  const previewRemoved = preview.removed as Array<{ sectionKey: string }>
  if (!previewRemoved.some(item => item.sectionKey === 'custom-note')) throw new Error('预览 removed 应包含自定义章节')
  const previewWarnings = (preview.warnings as string[]) ?? []
  if (!previewWarnings.some(item => /必填章节「文档信息」/.test(item))) throw new Error('预览应提示必填章节缺失将保留')
  if ((preview.baseVersion as number) !== beforePreviewVersion) throw new Error('预览 baseVersion 应等于当前文档版本')

  const afterPreview = assertOk(await request('GET', `/apps/${appId}/requirements-doc`), '读取预览后文档')
  if (docOf(afterPreview).version !== beforePreviewVersion) throw new Error('预览不应改变文档版本')
  const versionsAfterPreview = (
    assertOk(await request('GET', `/apps/${appId}/requirements-doc/versions`), '读取预览后版本列表').versions as unknown[]
  ).length
  if (versionsAfterPreview !== versionsBeforePreview) throw new Error('预览不应产生版本')
  if (!sectionsOf(afterPreview).some(section => section.sectionKey === 'custom-note')) {
    throw new Error('预览不应删除章节')
  }
  console.log('AI 建议预览：不写库/不产版本；removed 仅自定义章节；必填缺失只警告')
  const afterIgnore = assertOk(await request('GET', `/apps/${appId}/requirements-doc`), '读取忽略后文档')
  if (docOf(afterIgnore).version !== beforePreviewVersion) throw new Error('忽略 AI 建议不应产生版本')
  console.log('忽略 AI 建议：不调用保存接口，文档版本保持 v' + beforePreviewVersion)

  const applied = assertOk(
    await request('PUT', `/apps/${appId}/requirements-doc`, {
      title: 'AI 建议标题',
      sections: [{ id: 'problem', markdown: '应用后的 AI 问题描述' }],
      removeSectionKeys: ['custom-note', 'goals'],
      source: 'ai'
    }),
    '应用选中 AI 建议'
  )
  if (docOf(applied).version !== beforePreviewVersion + 1) throw new Error('应用选中应只生成一个新版本')
  const appliedSections = sectionsOf(applied)
  if (appliedSections.some(section => section.sectionKey === 'custom-note')) throw new Error('应用选中应删除自定义章节')
  if (!appliedSections.some(section => section.sectionKey === 'goals')) throw new Error('必填章节不应被删除')
  if (appliedSections.find(section => section.sectionKey === 'problem')?.markdown !== '应用后的 AI 问题描述') {
    throw new Error('应用选中应写入选中章节')
  }
  const appliedWarnings = (applied.warnings as string[]) ?? []
  if (!appliedWarnings.some(warning => /不可删除/.test(warning))) throw new Error('删除必填章节应返回 warning')
  const latestVersion = (
    assertOk(await request('GET', `/apps/${appId}/requirements-doc/versions`), '读取应用后版本列表').versions as Array<{
      version: number
      source: string
    }>
  )[0]
  if (latestVersion.version !== beforePreviewVersion + 1 || latestVersion.source !== 'ai') {
    throw new Error(`应用后最新版本应为 v${beforePreviewVersion + 1}/ai，实际 ${JSON.stringify(latestVersion)}`)
  }
  console.log('应用选中：只更新选中章节并生成 1 个 ai 版本；必填章节不可删（warning）')

  const privateTpl = assertOk(
    await request('POST', '/requirement-templates', {
      name: '冒烟私有模板',
      stage: 'requirements',
      category: '冒烟',
      prompt: '冒烟测试模板提示词',
      sections: [{ id: 'problem', title: '问题与机会', level: 2, kind: 'markdown', guidance: '', required: true }]
    }),
    '创建私有模板'
  )
  const privateTplId = (privateTpl.template as { id: string }).id
  assertOk(await request('PUT', `/apps/${appId}/requirements-doc/template`, { templateId: privateTplId }), '切换到私有模板')
  const blockedTpl = await request('DELETE', `/requirement-templates/${privateTplId}`)
  if (blockedTpl.status !== 400) throw new Error(`使用中的模板删除应 400，实际 ${blockedTpl.status}`)
  assertOk(await request('PUT', `/apps/${appId}/requirements-doc/template`, { templateId: 'builtin-prd' }), '切回标准 PRD')
  assertOk(await request('DELETE', `/requirement-templates/${privateTplId}`), '删除未使用模板')
  const builtinDelete = await request('DELETE', '/requirement-templates/builtin-prd')
  if (builtinDelete.status !== 400) throw new Error(`内置模板删除应 400，实际 ${builtinDelete.status}`)
  console.log('模板删除保护：使用中 400、未使用可删、内置只读')

  const tooEarly = await request('POST', `/apps/${appId}/requirements-doc/confirm`)
  if (tooEarly.status !== 400) throw new Error(`必填章节为空时确认应返回 400，实际 ${tooEarly.status}`)
  const issues = (tooEarly.data as { issues?: Array<{ message: string }> }).issues ?? []
  if (!issues.length) throw new Error('确认失败时应返回 issues')
  console.log('确认校验：必填缺失时 400 + issues', issues.length, '条')

  const required: Record<string, string> = {
    meta: '- 产品：季度报表\n- 作者：产品组\n- 日期：2026-11-10\n- 版本：v1\n- 状态：草稿',
    problem: '运营需要季度报表，当前靠手工 Excel。',
    goals: '季度报表生成时间从 2 天降到 30 分钟。',
    users: '- 运营：查看季度/ATM 指标\n- 管理员：维护数据',
    scope: '- 本期做：季度列表、ATM 列表、详情\n- 不做：数据写入',
    scenes: '### 查看季度报表\n运营按季度查看 ATM 指标。',
    epics: '### Epic 1：季度报表\n- 作为运营，我希望查看季度报表，以便复盘业绩。\n- 验收：可切换季度、查看 ATM 列表。',
    rules: '- 季度与 ATM 指标一对多\n- 金额保留两位小数',
    acceptance: '- 季度列表可用\n- ATM 列表可筛选\n- 详情字段完整'
  }
  const current = sectionsOf(assertOk(await request('GET', `/apps/${appId}/requirements-doc`), '重新读取文档'))
  for (const section of current) {
    if (section.required) {
      assertOk(
        await request('PUT', `/apps/${appId}/requirements-doc/sections/${section.sectionKey}`, {
          markdown: required[section.sectionKey] ?? `内容-${section.title}`
        }),
        `补全 ${section.title}`
      )
    }
  }
  assertOk(
    await request('PUT', `/apps/${appId}/requirements-doc/sections/issues`, { markdown: '- 待确认：是否需要导出 Excel？' }),
    '补充待澄清'
  )

  const exported = assertOk(await request('GET', `/apps/${appId}/requirements-doc/export`), '导出需求文档')
  if (exported.filename !== '01-REQUIREMENTS.md') throw new Error('导出文件名应为 01-REQUIREMENTS.md')
  if (!String(exported.content).includes('Epic 1：季度报表')) throw new Error('导出内容缺少 Epics')
  console.log('只读导出：01-REQUIREMENTS.md', String(exported.content).length, '字符')

  const beforeConfirm = docOf(assertOk(await request('GET', `/apps/${appId}/requirements-doc`), '确认前读取文档'))
  const confirmed = assertOk(await request('POST', `/apps/${appId}/requirements-doc/confirm`), '确认需求')
  if (docOf(confirmed).status !== 'confirmed') throw new Error('确认后文档状态应为 confirmed')
  if (docOf(confirmed).version !== beforeConfirm.version + 1) {
    throw new Error(`确认需求应生成新版本（v${beforeConfirm.version + 1}），实际 v${docOf(confirmed).version}`)
  }
  const confirmVersion = (
    assertOk(await request('GET', `/apps/${appId}/requirements-doc/versions`), '确认后版本列表').versions as Array<{
      version: number
      source: string
    }>
  )[0]
  if (confirmVersion.source !== 'confirm' || confirmVersion.version !== docOf(confirmed).version) {
    throw new Error(`确认版本应为 confirm/v${docOf(confirmed).version}，实际 ${JSON.stringify(confirmVersion)}`)
  }
  const warnings = (confirmed.warnings as string[]) ?? []
  if (!warnings.some(item => /待确认/.test(item))) throw new Error('待澄清应作为警告返回')
  const appAfter = assertOk(await request('GET', `/apps/${appId}`), '读取应用')
  if ((appAfter.app as { status: string }).status !== 'design') throw new Error('确认需求后应用应进入设计阶段')
  console.log('确认需求：生成 confirm 版本 v' + docOf(confirmed).version + '，应用进入 design；警告', warnings.length, '条')

  const manualBlocked = await request('POST', `/apps/${appId}/requirements-doc/versions`)
  if (manualBlocked.status !== 409) throw new Error(`已确认文档手动保存版本应 409，实际 ${manualBlocked.status}`)
  console.log('手动保存版本：文档已确认时 409')

  const designBlocked = await request('POST', `/apps/${appId}/stage/confirm`, { stage: 'design' })
  if (designBlocked.status !== 409) throw new Error(`文档模式完成设计应返回 409，实际 ${designBlocked.status}`)
  const designMessage = (designBlocked.data as { error?: string }).error ?? ''
  if (!/设计 Studio/.test(designMessage) || !/生成交接包/.test(designMessage)) {
    throw new Error(`完成设计应提示设计 Studio / 生成交接包，实际：${designMessage}`)
  }
  console.log('设计阶段：旧 stage/confirm 返回 409，引导到设计 Studio 生成交接包（D5）')

  assertOk(
    await request('PUT', `/apps/${appId}/requirements-doc/chat`, {
      messages: [{ id: 'm1', role: 'user', content: '记录一条 doc 对话', time: '00:00' }]
    }),
    '保存 doc 对话'
  )
  const chat = assertOk(await request('GET', `/apps/${appId}/requirements-doc/chat`), '读取 doc 对话')
  if ((chat.messages as unknown[]).length !== 1) throw new Error('doc 对话未持久化')
  console.log('doc 对话：持久化读取成功')

  assertOk(await request('DELETE', `/apps/${appId}?confirm=true`), '删除应用')
  const afterDelete = await request('GET', `/apps/${appId}`)
  if (afterDelete.status !== 404) throw new Error('删除后应用应 404')
  if (fs.existsSync(path.join(root, 'projects', appId))) throw new Error('删除后应用目录应被清理')
  const docRows = db.prepare('SELECT COUNT(*) AS count FROM app_requirement_docs WHERE app_id = ?').get(appId) as { count: number }
  const sectionRows = db.prepare('SELECT COUNT(*) AS count FROM app_requirement_doc_sections WHERE app_id = ?').get(appId) as { count: number }
  const versionRows = db.prepare('SELECT COUNT(*) AS count FROM app_requirement_doc_versions WHERE app_id = ?').get(appId) as { count: number }
  if (docRows.count || sectionRows.count || versionRows.count) throw new Error('删除应用后需求文档数据未清理')
  console.log('删除应用：登记/目录/文档/章节/版本清理完成')
  console.log('需求文档冒烟通过。')
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
    console.error('需求文档冒烟失败：', error)
    await cleanup()
    process.exit(1)
  })
