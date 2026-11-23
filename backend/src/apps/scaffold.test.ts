/**
 * 应用脚手架：EOS 渲染 + 共享工作区结构（含 skills/commands/模板副本）
 *
 * 使用临时 SQLite + 临时 projects 目录；不启动 opencode、不调用模型。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-scaffold-'))
const projects = path.join(root, 'projects')
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = projects
process.env.OPENCODE_AUTO_START = 'false'

interface Setup {
  scaffold: typeof import('./scaffold')
  db: typeof import('../db').db
}

let setupPromise: Promise<Setup> | null = null

function setup(): Promise<Setup> {
  if (setupPromise) return setupPromise
  setupPromise = (async () => {
    const dbModule = await import('../db')
    const scaffold = await import('./scaffold')
    return { scaffold, db: dbModule.db }
  })()
  return setupPromise
}

after(async () => {
  if (setupPromise) {
    const { db } = await setupPromise
    db.close()
  }
  fs.rmSync(root, { recursive: true, force: true })
})

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (entry.isFile()) files.push(full)
  }
  return files
}

test('scaffoldApp：EOS 渲染 + 工作区结构 + 受管资源', async () => {
  const { scaffold } = await setup()
  scaffold.scaffoldApp(
    {
      appId: 'leave-test',
      appName: '请假管理',
      backendPort: 18081,
      secrets: {
        eosSysKey: 'TEST_SYS_KEY',
        dbHost: 'db.example',
        dbPort: '3307',
        dbName: 'leave_db',
        dbUser: 'leave_user',
        dbPassword: 's3&cret',
        mailHost: 'smtp.example',
        mailUsername: 'mail_user',
        mailPassword: 'mail_pass'
      },
      requirementTemplateId: 'builtin-prd-lite'
    },
    projects
  )

  const appDir = scaffold.appDirOf('leave-test', projects)
  for (const relative of [
    'AGENTS.md',
    'README.md',
    'opencode.json',
    'backend/pom.xml',
    'docs/requirements',
    'docs/design',
    '.opencode/skills/adw-requirements-document/SKILL.md',
    '.opencode/skills/adw-template-req-builtin-prd-lite/SKILL.md',
    '.opencode/skills/adw-template-req-builtin-prd-lite/assets/template.md',
    '.opencode/skills/adw-template-req-builtin-prd-lite/_manifest.json',
    '.opencode/skills/adw-design-artifacts/SKILL.md',
    '.opencode/skills/adw-design-artifacts/references/design.schema.json',
    '.opencode/skills/adw-design-artifacts/references/design-example.json',
    '.opencode/skills/adw-design-artifacts/scripts/validate.mjs',
    '.opencode/commands/update-requirements.md',
    '.opencode/commands/generate-design.md',
    '.opencode/commands/preview-app.md',
    '.opencode/commands/check-consistency.md'
  ]) {
    assert.ok(fs.existsSync(path.join(appDir, relative)), `缺少 ${relative}`)
  }
  // 退役 req/design agent；不创建任何 git 文件
  assert.equal(fs.existsSync(path.join(appDir, '.opencode', 'agents')), false)
  assert.equal(fs.existsSync(path.join(appDir, '.git')), false)
  assert.equal(fs.existsSync(path.join(appDir, '.gitignore')), false)

  const appAgents = fs.readFileSync(path.join(appDir, 'AGENTS.md'), 'utf8')
  assert.match(appAgents, /所有面向用户的文字.*一律使用中文/)
  assert.match(appAgents, /受管资源/)
  assert.match(appAgents, /不要执行任何 git 操作/)

  const config = JSON.parse(fs.readFileSync(path.join(appDir, 'opencode.json'), 'utf8')) as {
    permission: { edit: Record<string, string> }
  }
  assert.equal(config.permission.edit['*'], 'allow')
  assert.equal(config.permission.edit['.opencode/skills/**'], 'deny')
  assert.equal(config.permission.edit['.opencode/commands/**'], 'deny')

  const pom = fs.readFileSync(path.join(appDir, 'backend', 'pom.xml'), 'utf8')
  assert.match(pom, /<artifactId>leave-test<\/artifactId>/)
  const props = fs.readFileSync(path.join(appDir, 'backend', 'src', 'application.properties'), 'utf8')
  assert.match(props, /server\.port=18081/)
  assert.match(props, /eos\.application\.sys-key=TEST_SYS_KEY/)
  const userConfig = fs.readFileSync(path.join(appDir, 'backend', 'src', 'META-INF', '_srv', 'config', 'user-config.xml'), 'utf8')
  assert.match(userConfig, /jdbc:mysql:\/\/db\.example:3307\/leave_db/)
  assert.equal(userConfig.includes('s3&cret'), false)

  const residual = walk(path.join(appDir, 'backend'))
    .concat(['AGENTS.md', 'README.md', 'opencode.json'].map(file => path.join(appDir, file)))
    .filter(file => fs.readFileSync(file).includes('{{'))
  assert.deepEqual(residual.map(file => path.relative(appDir, file)), [])

  // 未提供设计系统：不生成 MF 前端与设计系统文件，也不生成任何设计模板/旧原型模板 skill
  assert.equal(fs.existsSync(path.join(appDir, 'frontend')), false)
  assert.equal(fs.existsSync(path.join(appDir, 'docs', 'design', 'design-system.json')), false)
  assert.equal(
    fs.existsSync(path.join(appDir, '.opencode', 'skills', 'adw-template-proto-builtin-prototype-minimal')),
    false
  )

  // 模板 skill：每个被选中的模板一个 skill
  const reqSkillDir = path.join(appDir, '.opencode', 'skills', 'adw-template-req-builtin-prd-lite')
  const templateCopy = fs.readFileSync(path.join(reqSkillDir, 'assets', 'template.md'), 'utf8')
  assert.match(templateCopy, /^module: MOD-XXX$/m, '模板副本应是示例占位，不是具体模块')
  assert.match(templateCopy, /^title: "<模块标题>"$/m)
  assert.match(templateCopy, /模板示例：新建模块时替换 module \/ title \/ order/)
})

test('未提供的敏感项写成 CHANGE_ME；removeAppDir 只删本地目录', async () => {
  const { scaffold } = await setup()
  scaffold.scaffoldApp({ appId: 'bare-test', appName: 'Bare', backendPort: 18082 }, projects)
  const appDir = scaffold.appDirOf('bare-test', projects)
  const props = fs.readFileSync(path.join(appDir, 'backend', 'src', 'application.properties'), 'utf8')
  assert.match(props, /eos\.application\.sys-key=CHANGE_ME/)
  const userConfig = fs.readFileSync(path.join(appDir, 'backend', 'src', 'META-INF', '_srv', 'config', 'user-config.xml'), 'utf8')
  assert.match(userConfig, /<configValue key="C3p0-Password">CHANGE_ME<\/configValue>/)
  scaffold.removeAppDir('bare-test', projects)
  assert.equal(fs.existsSync(appDir), false)
})

test('应用目录已存在 → 409；assertAsciiSecrets 拒绝非 ASCII', async () => {
  const { scaffold } = await setup()
  assert.throws(
    () => scaffold.scaffoldApp({ appId: 'leave-test', appName: 'dup', backendPort: 18081 }, projects),
    (error: Error & { status?: number }) => error.status === 409
  )
  assert.doesNotThrow(() => scaffold.assertAsciiSecrets({ eosSysKey: 'ABC-123' }))
  assert.throws(() => scaffold.assertAsciiSecrets({ dbPassword: '密码' }), /ASCII/)
})

test('带设计系统：MF remote 骨架 + PageTemplates + design-system.json + 蓝图 + 团队/设计模板 skill', async () => {
  const { scaffold } = await setup()
  const designSystem = {
    pack: 'afcenter-app-templates-v1',
    applicationType: 'enterprise-application-platform',
    style: 'platform-blue'
  }
  scaffold.scaffoldApp(
    {
      appId: 'mf-app',
      appName: 'MF 应用',
      backendPort: 18083,
      requirementTemplateId: 'builtin-prd-lite',
      designSystem
    },
    projects
  )
  const appDir = scaffold.appDirOf('mf-app', projects)

  for (const relative of [
    // MF remote 骨架
    'frontend/package.json',
    'frontend/setting.json',
    'frontend/babel.config.js',
    'frontend/build/mfp.config.js',
    'frontend/build/webpack.config.js',
    'frontend/build/webpack.dev.js',
    'frontend/build/webpack.prod.js',
    'frontend/build/utils.js',
    'frontend/public/index_app.html',
    'frontend/src/main.js',
    'frontend/src/bootstrap.js',
    'frontend/src/App.vue',
    'frontend/src/router/index.js',
    'frontend/src/views/AppIndex.vue',
    'frontend/src/preferences/GlobalPreference.js',
    'frontend/src/components/PageTemplates/index.js',
    'frontend/src/components/PageTemplates/ListPage.vue',
    'frontend/src/components/PageTemplates/TreeListPage.vue',
    'frontend/src/components/PageTemplates/BlueListPage.vue',
    'frontend/src/components/PageTemplates/utils.js',
    'frontend/src/components/PageTemplates/style.css',
    'frontend/src/components/PageTemplates/table-blue.css',
    // 设计系统与蓝图
    'docs/design/design-system.json',
    'docs/design/template/enterprise-application-platform/pages/OrganizationUsers.vue',
    'docs/design/template/enterprise-application-platform/structure.css',
    'docs/design/template/styles/shared.css',
    'docs/design/template/styles/platform-blue/style.css',
    // 团队 skill + 设计模板 skill
    '.opencode/skills/afcenter-page-generation/SKILL.md',
    '.opencode/skills/afcenter-page-generation/assets/PageTemplates/index.js',
    '.opencode/skills/pm-components-usage/SKILL.md',
    '.opencode/skills/adw-template-proto-enterprise-application-platform/SKILL.md',
    '.opencode/skills/adw-template-proto-enterprise-application-platform/assets/design-system.json',
    '.opencode/skills/adw-template-proto-enterprise-application-platform/_manifest.json'
  ]) {
    assert.ok(fs.existsSync(path.join(appDir, relative)), `缺少 ${relative}`)
  }

  // 页面模板只复制运行所需文件，不含 examples/docs/verify
  for (const relative of ['examples', 'docs', 'verify.cjs', 'install.js']) {
    assert.equal(
      fs.existsSync(path.join(appDir, 'frontend', 'src', 'components', 'PageTemplates', relative)),
      false,
      `不应复制 ${relative}`
    )
  }

  // 不再生成任何旧原型模板 skill
  assert.equal(
    fs.existsSync(path.join(appDir, '.opencode', 'skills', 'adw-template-proto-builtin-prototype-enterprise')),
    false
  )

  // setting/package 的应用名替换；前端不残留占位符
  const setting = JSON.parse(fs.readFileSync(path.join(appDir, 'frontend', 'setting.json'), 'utf8')) as Record<string, unknown>
  assert.equal(setting['app.name'], 'mf-app')
  const pkg = JSON.parse(fs.readFileSync(path.join(appDir, 'frontend', 'package.json'), 'utf8')) as { name: string }
  assert.equal(pkg.name, 'mf-app')
  const frontendResidual = walk(path.join(appDir, 'frontend')).filter(file => fs.readFileSync(file).includes('{{APP_ID}}'))
  assert.deepEqual(frontendResidual, [])

  // design-system.json：pack/类型/风格/蓝图/页面/skill
  const summary = JSON.parse(fs.readFileSync(path.join(appDir, 'docs', 'design', 'design-system.json'), 'utf8')) as {
    schemaVersion: number
    pack: string
    packVersion: string
    applicationType: string
    style: string
    styles: { shared: string | null; style: string; styleId: string }
    blueprintRoot: string
    templateDir: string
    pages: Array<{ id: string; blueprint: string; recipe: string }>
    skills: string[]
  }
  assert.equal(summary.schemaVersion, 1)
  assert.equal(summary.pack, 'afcenter-app-templates-v1')
  assert.equal(summary.packVersion, '1.0.0')
  assert.equal(summary.applicationType, 'enterprise-application-platform')
  assert.equal(summary.style, 'platform-blue')
  assert.deepEqual(summary.styles, {
    shared: 'docs/design/template/styles/shared.css',
    style: 'docs/design/template/styles/platform-blue/style.css',
    styleId: 'platform-blue'
  })
  assert.equal(summary.blueprintRoot, 'docs/design/template')
  assert.equal(summary.templateDir, 'docs/design/template/enterprise-application-platform')
  assert.equal(summary.pages.length, 5)
  assert.ok(summary.pages.every(page => fs.existsSync(path.join(appDir, page.blueprint))))
  assert.ok(summary.pages.some(page => page.id === 'organization' && page.recipe === 'tree-list'))
  assert.deepEqual(summary.skills, ['afcenter-page-generation', 'pm-components-usage'])

  // 只复制选中类型，不复制其它应用类型
  assert.equal(fs.existsSync(path.join(appDir, 'docs', 'design', 'template', 'operations-management')), false)

  // 设计模板 skill：相对引用两个团队 skill + 页面库/ui-check
  const skillMd = fs.readFileSync(
    path.join(appDir, '.opencode', 'skills', 'adw-template-proto-enterprise-application-platform', 'SKILL.md'),
    'utf8'
  )
  assert.match(skillMd, /afcenter-app-templates-v1/)
  assert.match(skillMd, /enterprise-application-platform/)
  assert.match(skillMd, /platform-blue/)
  assert.match(skillMd, /\.\.\/afcenter-page-generation\/SKILL\.md/)
  assert.match(skillMd, /\.\.\/pm-components-usage\/SKILL\.md/)
  assert.match(skillMd, /docs\/design\/template\/enterprise-application-platform\/pages\/OrganizationUsers\.vue/)
  assert.match(skillMd, /## 一致性清单（conformance）/)
  assert.match(skillMd, /ui-check\.md/)

  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(appDir, '.opencode', 'skills', 'adw-template-proto-enterprise-application-platform', '_manifest.json'),
      'utf8'
    )
  ) as { managed: boolean; kind: string; sourceId: string; templateName: string; hash: string }
  assert.equal(manifest.managed, true)
  assert.equal(manifest.kind, 'design-system')
  assert.equal(manifest.sourceId, 'enterprise-application-platform')
  assert.equal(manifest.templateName, '企业级应用管理平台')
  assert.match(manifest.hash, /^[a-f0-9]{64}$/)

  // AGENTS/README 指向 frontend 与蓝图
  const agentsMd = fs.readFileSync(path.join(appDir, 'AGENTS.md'), 'utf8')
  assert.match(agentsMd, /MF remote/)
  assert.match(agentsMd, /设计系统与开发规则/)
  assert.match(agentsMd, /docs\/design\/design-system\.json/)
  assert.match(agentsMd, /ui-check\.md/)
  assert.match(agentsMd, /PageTemplates/)
  assert.match(agentsMd, /pm-form-dialog/)
  assert.match(agentsMd, /GlobalPreference/)
  assert.match(agentsMd, /需求 > design-system\/design\.json 契约 > 蓝图/)
  assert.match(agentsMd, /EOS 后端不吃风格/)
  assert.match(fs.readFileSync(path.join(appDir, 'README.md'), 'utf8'), /frontend\/.*Module Federation/)
})

test('非法设计系统：创建前拒绝，不产生应用目录', async () => {
  const { scaffold } = await setup()
  for (const designSystem of [
    { pack: 'afcenter-app-templates-v1', applicationType: 'not-a-type', style: 'platform-blue' },
    { pack: 'afcenter-app-templates-v1', applicationType: 'enterprise-application-platform', style: 'not-a-style' },
    { pack: 'not-a-pack', applicationType: 'enterprise-application-platform', style: 'platform-blue' }
  ]) {
    assert.throws(() => scaffold.scaffoldApp({ appId: 'bad-ds', appName: 'bad', backendPort: 18084, designSystem }, projects))
    assert.equal(fs.existsSync(scaffold.appDirOf('bad-ds', projects)), false, `非法设计系统不应建目录：${JSON.stringify(designSystem)}`)
  }
})
