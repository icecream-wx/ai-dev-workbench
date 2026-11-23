/**
 * P1 底座冒烟：工作区 + 模板分发 + 模块文件 + artifacts + 事件
 *
 * 真实 Express + 临时 SQLite/projects；默认不启动 opencode（OPENCODE_AUTO_START=false）。
 *
 * 覆盖：
 * 1. 建应用 → 工作区结构（AGENTS.md/README.md/opencode.json/docs/.opencode/backend）
 * 2. skills/commands 资产就位（SKILL.md 有 name+description；5 个 command）
 * 3. POST /requirements-modules → 生成 docs/requirements/MOD-001-*.md（frontmatter + 章节）
 * 4. artifacts 解析模块与设计（合法/非法 design.json）
 * 5. 全局模板保存 → 同步应用副本 + manifest hash；POST /templates/.../sync 幂等
 * 6. 删除被模块引用的模板 → 409
 * 7. docs/ 变化 → SSE artifacts-changed
 *
 * 运行：npm run smoke:workspace --prefix backend
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-workspace-smoke-'))
const port = Number(process.env.WORKSPACE_SMOKE_PORT ?? 3416)
process.env.PORT = String(port)
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_PORT = String(port + 1000)
process.env.OPENCODE_AUTO_START = 'false'

const base = `http://127.0.0.1:${port}`
const projects = process.env.RG_PROJECTS_DIR as string

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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertOk(result: ApiResult, label: string): Record<string, unknown> {
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`${label} 失败（HTTP ${result.status}）：${JSON.stringify(result.data)}`)
  }
  return (result.data ?? {}) as Record<string, unknown>
}

function assertStatus(result: ApiResult, status: number, label: string): void {
  assert(result.status === status, `${label} 应返回 ${status}，实际 ${result.status}：${JSON.stringify(result.data)}`)
}

async function waitForHealth(): Promise<void> {
  for (let index = 0; index < 150; index += 1) {
    try {
      const res = await fetch(`${base}/api/health`)
      if (res.ok) return
    } catch {
      // 尚未监听
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('后端未在 15s 内就绪')
}

function read(file: string): string {
  return fs.readFileSync(file, 'utf8')
}

/** 读取 SSE 直到匹配或超时 */
async function waitForEvent(appId: string, predicate: (frame: Record<string, unknown>) => boolean, timeoutMs = 8000): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${base}/api/apps/${appId}/events`, { signal: controller.signal })
    if (!res.ok || !res.body) throw new Error(`events 连接失败（HTTP ${res.status}）`)
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const frames = buffer.split('\n\n')
      buffer = frames.pop() ?? ''
      for (const frame of frames) {
        const line = frame.split('\n').find(item => item.startsWith('data: '))
        if (!line) continue
        const parsed = JSON.parse(line.slice(6)) as Record<string, unknown>
        if (parsed.type === 'hello') continue
        if (predicate(parsed)) {
          await reader.cancel().catch(() => undefined)
          return parsed
        }
      }
    }
    throw new Error('SSE 在超时前没有收到目标事件')
  } finally {
    clearTimeout(timer)
    controller.abort()
  }
}

async function main(): Promise<void> {
  await import('../src/index')
  await waitForHealth()

  // 1. 建应用
  const created = assertOk(
    await request('POST', '/apps', {
      id: 'smoke-app',
      name: '冒烟应用',
      requirementTemplateId: 'builtin-prd-lite'
    }),
    '创建应用'
  )
  const appDir = path.join(projects, 'smoke-app')
  for (const relative of [
    'AGENTS.md',
    'README.md',
    'opencode.json',
    'docs/requirements',
    'docs/design',
    'backend/pom.xml',
    '.opencode/skills/adw-requirements-document/SKILL.md',
    '.opencode/skills/adw-template-req-builtin-prd-lite/SKILL.md',
    '.opencode/skills/adw-template-req-builtin-prd-lite/assets/template.md',
    '.opencode/skills/adw-template-req-builtin-prd-lite/_manifest.json',
    '.opencode/skills/afcenter-page-generation/SKILL.md',
    '.opencode/skills/pm-components-usage/SKILL.md',
    '.opencode/skills/adw-template-proto-enterprise-application-platform/SKILL.md',
    '.opencode/skills/adw-template-proto-enterprise-application-platform/assets/design-system.json',
    '.opencode/skills/adw-design-artifacts/SKILL.md',
    '.opencode/skills/adw-design-artifacts/references/design.schema.json',
    '.opencode/skills/adw-design-artifacts/scripts/validate.mjs',
    '.opencode/skills/adw-frontend-implementation/SKILL.md',
    'frontend/package.json',
    'frontend/setting.json',
    'frontend/build/mfp.config.js',
    'frontend/src/views/AppIndex.vue',
    'frontend/src/components/PageTemplates/ListPage.vue',
    'frontend/src/preferences/GlobalPreference.js',
    'docs/design/design-system.json',
    'docs/design/template/enterprise-application-platform/pages/OrganizationUsers.vue',
    'docs/design/template/enterprise-application-platform/structure.css',
    'docs/design/template/styles/shared.css',
    'docs/design/template/styles/platform-blue/style.css'
  ]) {
    assert(fs.existsSync(path.join(appDir, relative)), `缺少工作区文件：${relative}`)
  }
  assert(!fs.existsSync(path.join(appDir, '.git')), '不应创建 .git')
  assert(!fs.existsSync(path.join(appDir, '.gitignore')), '不应创建 .gitignore')
  assert(!fs.existsSync(path.join(appDir, '.opencode', 'agents')), '不应创建 .opencode/agents')

  // 2. skills / commands 资产
  for (const kind of ['adw-requirements-document', 'adw-design-artifacts', 'adw-frontend-implementation']) {
    const skill = read(path.join(appDir, '.opencode', 'skills', kind, 'SKILL.md'))
    assert(/^---\nname: .+/m.test(skill), `${kind} 缺少 frontmatter name`)
    assert(/^description: .+/m.test(skill), `${kind} 缺少 frontmatter description`)
  }
  const commands = fs.readdirSync(path.join(appDir, '.opencode', 'commands')).filter(name => name.endsWith('.md'))
  assert(commands.length === 5, `commands 应有 5 个，实际 ${commands.length}`)
  assert(commands.includes('check-design-fidelity.md'), '缺少 check-design-fidelity command')
  assert(
    fs.existsSync(
      path.join(appDir, '.opencode', 'skills', 'adw-frontend-implementation', 'scripts', 'check-fidelity.mjs')
    ),
    '缺少一致性检查脚本 check-fidelity.mjs'
  )
  const opencodeJson = JSON.parse(read(path.join(appDir, 'opencode.json'))) as {
    permission?: { edit?: Record<string, string> }
  }
  assert(opencodeJson.permission?.edit?.['*'] === 'allow', 'opencode.json 缺少 permission.edit "*": allow')
  assert(opencodeJson.permission?.edit?.['.opencode/skills/**'] === 'deny', 'opencode.json 未拒绝 skills 编辑')

  // 模板即 skill（一个模板一个 skill）
  const reqSkill = path.join(appDir, '.opencode', 'skills', 'adw-template-req-builtin-prd-lite')
  assert(fs.existsSync(path.join(reqSkill, 'assets', 'template.md')), '缺少需求模板 skill 骨架')
  const reqManifest = JSON.parse(read(path.join(reqSkill, '_manifest.json'))) as { kind: string; sourceId: string }
  assert(reqManifest.kind === 'requirement' && reqManifest.sourceId === 'builtin-prd-lite', '需求模板 skill manifest 不正确')
  const protoSkill = path.join(appDir, '.opencode', 'skills', 'adw-template-proto-enterprise-application-platform')
  assert(fs.existsSync(path.join(protoSkill, 'assets', 'design-system.json')), '缺少设计模板 skill 摘要')
  const designManifest = JSON.parse(read(path.join(protoSkill, '_manifest.json'))) as { kind: string; sourceId: string }
  assert(
    designManifest.kind === 'design-system' && designManifest.sourceId === 'enterprise-application-platform',
    '设计模板 skill manifest 不正确'
  )
  // 所有 adw-template-proto-* skill 都必须是设计模板 skill（旧原型模板概念已删除）
  const protoSkillDirs = fs
    .readdirSync(path.join(appDir, '.opencode', 'skills'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('adw-template-proto-'))
  assert(protoSkillDirs.length === 1, `设计模板 skill 应只有 1 个，实际 ${protoSkillDirs.length}`)
  for (const entry of protoSkillDirs) {
    const manifest = JSON.parse(read(path.join(appDir, '.opencode', 'skills', entry.name, '_manifest.json'))) as {
      kind: string
    }
    assert(manifest.kind === 'design-system', `${entry.name} 的 manifest.kind 应为 design-system`)
  }

  // 数据层：4 表，无 prototype_templates
  const Database = (await import('better-sqlite3')).default
  const sqlite = new Database(path.join(root, 'data', 'requirements.db'), { readonly: true })
  try {
    const tableNames = (
      sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as Array<{
        name: string
      }>
    )
      .map(row => row.name)
      .sort()
    assert(
      JSON.stringify(tableNames) === JSON.stringify(['app_sessions', 'app_settings', 'apps', 'requirement_templates']),
      `数据表应只有 4 张，实际 ${JSON.stringify(tableNames)}`
    )
    const appColumns = (sqlite.prepare('PRAGMA table_info(apps)').all() as Array<{ name: string }>).map(row => row.name)
    assert(!appColumns.includes('prototype_template_id'), 'apps 不应再有 prototype_template_id 列')
  } finally {
    sqlite.close()
  }

  const setting = JSON.parse(read(path.join(appDir, 'frontend', 'setting.json'))) as Record<string, unknown>
  assert(setting['app.name'] === 'smoke-app', 'setting.json app.name 应替换为应用 ID')
  const designSummary = JSON.parse(read(path.join(appDir, 'docs', 'design', 'design-system.json'))) as {
    applicationType: string
    style: string
    styles?: { shared?: string | null; style?: string; styleId?: string }
    pages: unknown[]
  }
  assert(
    designSummary.applicationType === 'enterprise-application-platform' && designSummary.style === 'platform-blue',
    'design-system.json 类型/风格不正确'
  )
  assert(
    designSummary.styles?.styleId === 'platform-blue' &&
      designSummary.styles?.style === 'docs/design/template/styles/platform-blue/style.css',
    'design-system.json styles.style 应指向 styles/<styleId>/style.css'
  )
  assert((designSummary.pages as unknown[]).length === 5, 'design-system.json 页面数应为 5')
  for (const method of ['adw-requirements-document', 'adw-design-artifacts', 'adw-frontend-implementation']) {
    assert(!fs.existsSync(path.join(appDir, '.opencode', 'skills', method, '_manifest.json')), `${method} 不应再有旧 manifest`)
  }

  // 3. 模块文件
  const moduleCreated = assertOk(
    await request('POST', '/apps/smoke-app/requirements-modules', { title: '商品管理' }),
    '新建模块'
  )
  const module = moduleCreated.module as { key: string; file: string }
  assert(module.key === 'MOD-001', `首个模块 key 应为 MOD-001，实际 ${module.key}`)
  const moduleFile = path.join(appDir, module.file)
  const moduleText = read(moduleFile)
  assert(/^---\nmodule: MOD-001\n/.test(moduleText), '模块文件缺少 frontmatter module')
  assert(/^title: "商品管理"$/m.test(moduleText), '模块文件缺少 frontmatter title')
  assert(/^order: 1$/m.test(moduleText), '模块文件缺少 frontmatter order')
  assert(/^template: builtin-prd-lite$/m.test(moduleText), '模块文件缺少 frontmatter template')
  assert((moduleText.match(/^## /gm) ?? []).length === 6, '精简 PRD 应渲染 6 个二级章节')

  // 4. artifacts（模块 + 设计校验）
  const artifacts = assertOk(await request('GET', '/apps/smoke-app/artifacts'), '读取 artifacts')
  const modules = artifacts.modules as Array<{ key: string; sections: unknown[] }>
  assert(modules.length === 1 && modules[0].key === 'MOD-001', 'artifacts 模块解析不正确')
  assert(typeof artifacts.hashes === 'object' && artifacts.hashes !== null, 'hashes 应为对象')

  const designDir = path.join(appDir, 'docs', 'design', 'MOD-001')
  fs.mkdirSync(designDir, { recursive: true })
  const designFile = path.join(designDir, 'design.json')
  fs.writeFileSync(
    designFile,
    JSON.stringify(
      {
        module: 'MOD-001',
        title: '商品管理',
        entities: [{ id: 'product', name: '商品', fields: [{ name: '名称', type: 'string' }] }],
        relations: [],
        pages: [{ id: 'product-list', name: '商品列表', type: 'list', entity: 'product' }]
      },
      null,
      2
    ),
    'utf8'
  )
  const valid = assertOk(await request('GET', '/apps/smoke-app/artifacts'), '读取合法设计')
  assert((valid.errors as unknown[]).length === 0, `合法设计不应有错误：${JSON.stringify(valid.errors)}`)
  assert((valid.designs as Array<{ module: string }>)[0]?.module === 'MOD-001', '设计模块解析不正确')

  // 4b. 一致性检查 API（P7-6a；规则与脚本一致）
  const fidelity = assertOk(
    await request('POST', '/apps/smoke-app/design-fidelity', { module: 'MOD-001' }),
    '一致性检查'
  )
  assert(fidelity.module === 'MOD-001', '一致性检查应回显模块')
  assert((fidelity.checks as unknown[]).length === 13, '一致性检查应有 13 项')
  assert((fidelity.summary as { total: number }).total === 13, '一致性检查 summary.total 应为 13')
  assert(
    (fidelity.designSystem as { pack?: string }).pack === 'afcenter-app-templates-v1',
    '一致性检查应回显设计系统 pack'
  )
  assert(
    (fidelity.checks as Array<{ id: string }>).some(check => check.id === 'ui-check'),
    '一致性检查应包含 ui-check 项'
  )
  assertStatus(
    await request('POST', '/apps/smoke-app/design-fidelity', { module: '../escape' }),
    400,
    '一致性检查模块非法'
  )
  assertStatus(await request('POST', '/apps/no-such-app/design-fidelity', {}), 404, '一致性检查应用不存在')

  fs.writeFileSync(designFile, JSON.stringify({ module: 'MOD-001', title: '商品管理', entities: 'oops' }, null, 2), 'utf8')
  const invalid = assertOk(await request('GET', '/apps/smoke-app/artifacts'), '读取非法设计')
  const invalidErrors = invalid.errors as Array<{ path: string; message: string }>
  assert(invalidErrors.some(item => item.path === 'entities'), '非法设计应返回 entities 类型错误')
  assert(invalidErrors.some(item => item.path === 'pages'), '非法设计应返回 pages 缺失错误')

  // 5. 模板保存同步 + 幂等 sync
  const custom = assertOk(
    await request('POST', '/requirement-templates', {
      name: '冒烟需求模板',
      stage: 'requirements',
      prompt: '按章节写需求',
      sections: [
        { id: 'goals', title: '目标', level: 2, kind: 'markdown', guidance: '', required: true },
        { id: 'acceptance', title: '验收', level: 2, kind: 'markdown', guidance: '', required: true }
      ]
    }),
    '创建需求模板'
  )
  const customId = (custom.template as { id: string }).id
  const customApp = assertOk(await request('POST', '/apps', { id: 'smoke-app-2', name: '冒烟应用二', requirementTemplateId: customId }), '创建应用二')
  const customAppDir = path.join(projects, 'smoke-app-2')
  const emptyFidelity = assertOk(
    await request('POST', '/apps/smoke-app-2/design-fidelity', {}),
    '无设计一致性检查'
  )
  assert(emptyFidelity.empty === true && emptyFidelity.reason === 'no-design', '无设计时应返回 empty/no-design')
  const customSkillDir = path.join(customAppDir, '.opencode', 'skills', `adw-template-req-${customId}`)
  const customTplFile = path.join(customSkillDir, 'assets', 'template.md')
  assert(fs.existsSync(customSkillDir), '应用二缺少自定义模板 skill')
  const firstCopy = read(customTplFile)
  assert(firstCopy.includes('## 1. 目标') && firstCopy.includes('## 2. 验收'), '模板副本章节不正确')

  assertOk(
    await request('PUT', `/requirement-templates/${customId}`, {
      name: '冒烟需求模板',
      stage: 'requirements',
      prompt: '按章节写需求（已更新）',
      sections: [
        { id: 'goals', title: '目标', level: 2, kind: 'markdown', guidance: '', required: true },
        { id: 'acceptance', title: '验收', level: 2, kind: 'markdown', guidance: '', required: true },
        { id: 'risks', title: '风险', level: 2, kind: 'markdown', guidance: '', required: false }
      ]
    }),
    '保存需求模板'
  )
  const updatedCopy = read(customTplFile)
  assert(updatedCopy.includes('## 3. 风险'), '全局模板保存后应用模板 skill 未同步')
  assert(read(path.join(customSkillDir, 'SKILL.md')).includes('## 3. 风险'), '模板 skill 的章节清单未同步')

  const manifestPath = path.join(customSkillDir, '_manifest.json')
  const manifestBefore = JSON.parse(read(manifestPath)) as { kind: string; sourceId: string; skill: string; hash: string }
  assert(manifestBefore.kind === 'requirement', '模板 skill manifest kind 不正确')
  assert(manifestBefore.sourceId === customId, 'manifest 缺少 sourceId')
  assert(manifestBefore.skill === `adw-template-req-${customId}`, 'manifest skill 名称不正确')
  assert(/^[a-f0-9]{64}$/.test(manifestBefore.hash ?? ''), 'manifest hash 应为 sha256')

  const sync1 = assertOk(await request('POST', `/templates/requirement/${customId}/sync`), '同步模板 #1')
  const sync2 = assertOk(await request('POST', `/templates/requirement/${customId}/sync`), '同步模板 #2')
  assert(JSON.stringify(sync1.apps) === JSON.stringify(sync2.apps), '同步应幂等（应用集合一致）')
  assert(sync1.templateSkill === `adw-template-req-${customId}`, 'sync 应返回模板 skill id')
  const manifestAfter = JSON.parse(read(manifestPath)) as { hash: string }
  assert(manifestAfter.hash === manifestBefore.hash, '幂等同步不应改变 hash')

  // 6. 删除保护（模块仍引用）
  const addModule = assertOk(
    await request('POST', '/apps/smoke-app-2/requirements-modules', { title: '订单管理', templateId: customId }),
    '应用二新建模块'
  )
  assertStatus(await request('DELETE', `/requirement-templates/${customId}`), 409, '删除被引用模板')
  const usage = assertOk(await request('GET', `/templates/requirement/${customId}/usage`), '读取模板引用')
  assert((usage.apps as unknown[]).length === 1, '模板引用应列出 1 个应用')

  const moduleKey = (addModule.module as { key: string }).key
  assertOk(
    await request('PATCH', `/apps/smoke-app-2/requirements-modules/${moduleKey}`, { template: 'builtin-prd-lite', order: 2 }),
    '改模块模板'
  )
  assertOk(await request('DELETE', `/requirement-templates/${customId}`), '解除引用后删除模板')
  assert(!fs.existsSync(customSkillDir), '删除模板后应用内模板 skill 应被移除')

  // 7. 事件（docs 变化）
  const eventPromise = waitForEvent('smoke-app', frame => frame.type === 'artifacts-changed')
  await new Promise(resolve => setTimeout(resolve, 300))
  fs.appendFileSync(moduleFile, '\n补充一行说明。\n', 'utf8')
  const event = await eventPromise
  assert(event.type === 'artifacts-changed', 'SSE 未收到 artifacts-changed')
  const changedPaths = event.paths as string[]
  assert(changedPaths.some(item => item.includes('MOD-001')), `事件 paths 应包含模块文件：${JSON.stringify(changedPaths)}`)
  assert(Boolean(event.hashes), '事件应带 hashes')

  // 清理：删除应用
  assertOk(await request('DELETE', '/apps/smoke-app?confirm=true'), '删除应用')
  assert(!fs.existsSync(appDir), '删除应用后目录应被移除')

  // 前端 app payload 字段
  const app = assertOk(await request('GET', '/apps/smoke-app-2'), '读取应用二')
  assert((app.app as { requirementTemplateId: string }).requirementTemplateId === 'builtin-prd', '模板删除后 payload 应回退默认')

  console.log('[smoke:workspace] 全部通过')
}

async function cleanup(): Promise<void> {
  try {
    const dbModule = await import('../src/db')
    dbModule.db.close()
  } catch {
    // 数据库未打开
  }
  try {
    fs.rmSync(root, { recursive: true, force: true })
  } catch {
    // Windows 句柄释放可能滞后：临时目录可留待系统清理
  }
}

main()
  .then(async () => {
    await cleanup()
    process.exit(0)
  })
  .catch(async error => {
    console.error('[smoke:workspace] 失败：', error instanceof Error ? error.message : error)
    await cleanup()
    process.exit(1)
  })
