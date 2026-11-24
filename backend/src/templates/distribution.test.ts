/**
 * 模板即 skill（P6-2）：生成、同步、清理、删除保护、legacy 副本清理
 *
 * 使用临时 SQLite + 临时 projects；不调用模型、不启动 opencode。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-distribution-'))
const projects = path.join(root, 'projects')
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = projects
process.env.OPENCODE_AUTO_START = 'false'

interface Setup {
  db: typeof import('../db').db
  scaffold: typeof import('../apps/scaffold')
  distribution: typeof import('./distribution')
  designSystem: typeof import('../apps/design-system')
  requirementTemplates: typeof import('../requirements/templates')
}

let setupPromise: Promise<Setup> | null = null

function setup(): Promise<Setup> {
  if (setupPromise) return setupPromise
  setupPromise = (async () => {
    const dbModule = await import('../db')
    return {
      db: dbModule.db,
      scaffold: await import('../apps/scaffold'),
      distribution: await import('./distribution'),
      designSystem: await import('../apps/design-system'),
      requirementTemplates: await import('../requirements/templates')
    }
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

function insertApp(db: Setup['db'], id: string, requirementTemplateId: string | null): void {
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO apps (id, name, description, dir, backend_port, status, requirement_template_id, created_at, updated_at)
     VALUES (?, ?, NULL, ?, 8081, 'requirements', ?, ?, ?)`
  ).run(id, `应用 ${id}`, id, requirementTemplateId, now, now)
}

function writeRequirementDoc(appDir: string, template: string): string {
  const dir = path.join(appDir, 'docs', 'requirements')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 'requirements.md')
  fs.writeFileSync(
    file,
    `---\ntitle: "测试"\ntemplate: ${template}\n---\n\n# 测试\n\n## 1. 目标\n`,
    'utf8'
  )
  return file
}

function manifestOf(appDir: string, id: string): Record<string, unknown> {
  const dir = path.join(appDir, '.opencode', 'skills', `adw-template-req-${id}`)
  return JSON.parse(fs.readFileSync(path.join(dir, '_manifest.json'), 'utf8')) as Record<string, unknown>
}

function designManifestOf(appDir: string, applicationType: string): Record<string, unknown> {
  const dir = path.join(appDir, '.opencode', 'skills', `adw-template-proto-${applicationType}`)
  return JSON.parse(fs.readFileSync(path.join(dir, '_manifest.json'), 'utf8')) as Record<string, unknown>
}

const BUILTIN_ROOT = path.resolve(__dirname, '../../../templates/design-system/afcenter-app-templates-v1')

function writeFile(file: string, content: string | Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

/** P7-7c：自定义 pack（reference + contract）fixture（用于 design skill / workspace 对齐） */
function seedCustomPack(packId: string): void {
  const packRoot = path.join(process.env.RG_DATA_DIR as string, 'design-system', packId)
  fs.mkdirSync(packRoot, { recursive: true })
  writeFile(
    path.join(packRoot, 'application-types', packId, 'pages', 'supplier-list.vue'),
    fs.readFileSync(path.join(BUILTIN_ROOT, 'application-types', 'operations-management', 'pages', 'OperationsList.vue'))
  )
  writeFile(path.join(packRoot, 'application-types', packId, 'structure.css'), '.merged-marker { color: #145fba; }\n')
  writeFile(path.join(packRoot, 'styles', 'shared.css'), ':root { --shared: 1; }\n')
  writeFile(path.join(packRoot, 'styles', 'data-cyan', 'style.css'), '.visual-style-data-cyan { color: #145fba; }\n')
  writeFile(
    path.join(packRoot, 'pack.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        id: packId,
        name: '供应商管理模板',
        version: '1.0.2',
        defaultApplicationType: packId,
        defaultStyle: 'data-cyan',
        origin: {
          kind: 'custom',
          draftId: packId,
          baseApplicationType: 'enterprise-application-platform',
          style: 'data-cyan',
          revision: 3
        },
        applicationTypes: [
          {
            id: packId,
            name: '供应商管理模板',
            category: 'custom',
            description: '引用页 + 契约页',
            structure: `application-types/${packId}/structure.css`,
            defaultStyle: 'data-cyan',
            pages: [
              {
                id: 'supplier-list',
                name: '供应商列表',
                type: 'list',
                recipe: 'list',
                preview: 'list',
                description: '台账',
                kind: 'reference',
                blueprint: `application-types/${packId}/pages/supplier-list.vue`,
                source: { pack: 'afcenter-app-templates-v1', applicationType: 'operations-management', pageId: 'list' },
                components: ['pm-table']
              },
              {
                id: 'supplier-form',
                name: '供应商表单',
                type: 'form',
                recipe: 'dialog-form',
                preview: 'form',
                description: '弹窗表单',
                kind: 'contract',
                contract: { form: { presentation: 'dialog', columns: 2, fields: ['name'] } },
                sampleEntity: { id: 'supplier', name: '供应商', fields: [{ name: 'name', type: 'string' }] },
                components: ['pm-form-dialog']
              }
            ]
          }
        ],
        styles: [
          {
            id: 'data-cyan',
            name: '数据蓝青',
            className: 'visual-style-data-cyan',
            css: 'styles/data-cyan/style.css',
            description: '蓝青冷色',
            signature: '#145FBA',
            tokens: { primary: '#145fba', accent: '#07858d', neutral: '#66758a', background: '#f3f7fb', radius: 12, density: 'compact' }
          }
        ],
        skills: ['afcenter-page-generation', 'pm-components-usage'],
        componentMap: { 'ref:org': 'pm-select-org' },
        pageRecipes: { list: ['BusinessListPage'], 'dialog-form': ['StandardFormPage'] },
        conformance: ['页面使用 PageTemplates']
      },
      null,
      2
    )}\n`
  )
}

test('默认需求模板 → 需求模板 skill + 设计模板 skill + manifest/hash', async () => {
  const { db, scaffold, distribution } = await setup()
  insertApp(db, 'dist-app', 'builtin-prd')
  scaffold.scaffoldApp({ appId: 'dist-app', appName: '分发应用', backendPort: 18091 }, projects)
  const appDir = scaffold.appDirOf('dist-app', projects)

  const synced = distribution.syncAppTemplates('dist-app')
  assert.deepEqual(synced.requirementTemplates, ['builtin-prd'])
  assert.equal('prototypeTemplate' in synced, false, '不应再返回旧原型模板')
  assert.deepEqual(synced.warnings, [])

  const reqSkill = 'adw-template-req-builtin-prd'
  assert.ok(synced.templateSkills.includes(reqSkill), '应生成需求模板 skill')
  assert.ok(
    synced.templateSkills.includes('adw-template-proto-enterprise-application-platform'),
    '应按默认设计系统生成设计模板 skill'
  )
  const reqDir = path.join(appDir, '.opencode', 'skills', reqSkill)
  const skillMd = fs.readFileSync(path.join(reqDir, 'SKILL.md'), 'utf8')
  const templateMd = fs.readFileSync(path.join(reqDir, 'assets', 'template.md'), 'utf8')
  assert.match(skillMd, /^name: "需求模板：/m)
  assert.match(skillMd, /description: "需求模板：.*template.*builtin-prd/m)
  assert.match(skillMd, /## 章节清单/)
  assert.match(skillMd, /`## 1\. 文档信息`/)
  assert.match(skillMd, /docs\/requirements\/requirements\.md/)
  assert.match(skillMd, /EP-001/)
  assert.match(templateMd, /^---\ntitle: "<应用名>"\n/)
  assert.match(templateMd, /^template: builtin-prd$/m)
  assert.match(templateMd, /模板示例：本文件是受管副本/)

  const reqManifest = manifestOf(appDir, 'builtin-prd')
  assert.equal(reqManifest.managed, true)
  assert.equal(reqManifest.kind, 'requirement')
  assert.equal(reqManifest.skill, reqSkill)
  assert.equal(reqManifest.sourceId, 'builtin-prd')
  assert.match(String(reqManifest.hash), /^[a-f0-9]{64}$/)
  assert.equal(reqManifest.hash, distribution.sha256(`${skillMd}\n${templateMd}`))

  // 设计模板 skill（pack 型）：manifest kind=design-system
  const designSkill = 'adw-template-proto-enterprise-application-platform'
  const designManifest = designManifestOf(appDir, 'enterprise-application-platform')
  assert.equal(designManifest.managed, true)
  assert.equal(designManifest.kind, 'design-system')
  assert.equal(designManifest.skill, designSkill)
  assert.equal(designManifest.sourceId, 'enterprise-application-platform')
  assert.match(String(designManifest.hash), /^[a-f0-9]{64}$/)
  assert.ok(fs.existsSync(path.join(appDir, '.opencode', 'skills', designSkill, 'assets', 'design-system.json')))
  assert.equal(
    fs.existsSync(path.join(appDir, '.opencode', 'skills', 'adw-template-proto-builtin-prototype-enterprise')),
    false,
    '不应生成旧原型模板 skill'
  )

  // 方法 skill 不再携带模板副本与 manifest
  for (const method of ['adw-requirements-document', 'adw-design-artifacts']) {
    const dir = path.join(appDir, '.opencode', 'skills', method)
    assert.equal(fs.existsSync(path.join(dir, 'assets', 'templates')), false, `${method} 不应再有 assets/templates`)
    assert.equal(fs.existsSync(path.join(dir, '_manifest.json')), false, `${method} 不应再有旧 manifest`)
  }
})

test('单需求文档引用其它需求模板 → 并存；不再引用 → 只清理该模板 skill', async () => {
  const { db, scaffold, distribution } = await setup()
  insertApp(db, 'ref-app', 'builtin-prd')
  scaffold.scaffoldApp({ appId: 'ref-app', appName: '引用应用', backendPort: 18092 }, projects)
  const appDir = scaffold.appDirOf('ref-app', projects)

  const moduleFile = writeRequirementDoc(appDir, 'builtin-prd-lite')
  distribution.syncAppTemplates('ref-app')
  assert.ok(fs.existsSync(path.join(appDir, '.opencode', 'skills', 'adw-template-req-builtin-prd-lite', 'SKILL.md')))
  assert.ok(fs.existsSync(path.join(appDir, '.opencode', 'skills', 'adw-template-req-builtin-prd', 'SKILL.md')))

  fs.writeFileSync(moduleFile, `---\ntitle: "测试"\ntemplate: builtin-prd\n---\n\n# 测试\n`, 'utf8')
  distribution.syncAppTemplates('ref-app')
  assert.equal(
    fs.existsSync(path.join(appDir, '.opencode', 'skills', 'adw-template-req-builtin-prd-lite')),
    false,
    '不再引用的模板 skill 应被清理'
  )
  assert.ok(fs.existsSync(path.join(appDir, '.opencode', 'skills', 'adw-template-req-builtin-prd', 'SKILL.md')))
})

test('单需求文档引用其它需求模板 → 与应用默认模板并存', async () => {
  const { db, scaffold, distribution, requirementTemplates } = await setup()
  const first = requirementTemplates.createTemplate({
    name: '模板甲',
    stage: 'requirements',
    prompt: '写甲',
    sections: [{ id: 'goals', title: '目标', level: 2, kind: 'markdown', guidance: '', required: true }]
  })
  insertApp(db, 'multi-app', 'builtin-prd')
  scaffold.scaffoldApp({ appId: 'multi-app', appName: '多模板应用', backendPort: 18095 }, projects)
  const appDir = scaffold.appDirOf('multi-app', projects)
  writeRequirementDoc(appDir, first.id)
  const synced = distribution.syncAppTemplates('multi-app')
  assert.deepEqual(synced.requirementTemplates, [first.id, 'builtin-prd'].sort())
  assert.ok(fs.existsSync(path.join(appDir, '.opencode', 'skills', `adw-template-req-${first.id}`, 'SKILL.md')))
  assert.ok(fs.existsSync(path.join(appDir, '.opencode', 'skills', 'adw-template-req-builtin-prd', 'SKILL.md')))
})

test('全局模板保存 → 重新生成模板 skill；syncTemplateToApps 幂等', async () => {
  const { db, scaffold, distribution, requirementTemplates } = await setup()
  const template = requirementTemplates.createTemplate({
    name: '同步模板',
    stage: 'requirements',
    prompt: '写需求',
    sections: [{ id: 'goals', title: '目标', level: 2, kind: 'markdown', guidance: '', required: true }]
  })
  insertApp(db, 'sync-app', template.id)
  scaffold.scaffoldApp(
    { appId: 'sync-app', appName: '同步应用', backendPort: 18093, requirementTemplateId: template.id },
    projects
  )
  const appDir = scaffold.appDirOf('sync-app', projects)
  const skillFile = path.join(appDir, '.opencode', 'skills', `adw-template-req-${template.id}`, 'SKILL.md')
  assert.match(fs.readFileSync(skillFile, 'utf8'), /## 1\. 目标/)

  requirementTemplates.updateTemplate(template.id, {
    name: '同步模板',
    stage: 'requirements',
    prompt: '写需求（更新）',
    sections: [
      { id: 'goals', title: '目标', level: 2, kind: 'markdown', guidance: '', required: true },
      { id: 'acceptance', title: '验收', level: 2, kind: 'markdown', guidance: '', required: true }
    ]
  })
  assert.match(fs.readFileSync(skillFile, 'utf8'), /## 2\. 验收/)

  const first = distribution.syncTemplateToApps('requirement', template.id)
  const hashFirst = manifestOf(appDir, template.id).hash
  const second = distribution.syncTemplateToApps('requirement', template.id)
  const hashSecond = manifestOf(appDir, template.id).hash
  assert.deepEqual(first.apps, second.apps)
  assert.deepEqual(first.apps, ['sync-app'])
  assert.equal(first.templateSkill, `adw-template-req-${template.id}`)
  assert.deepEqual(first.warnings, [])
  assert.equal(hashFirst, hashSecond)
})

test('删除保护：单需求文档仍引用 → 409；解除引用后删除并移除模板 skill', async () => {
  const { db, scaffold, distribution, requirementTemplates } = await setup()
  const template = requirementTemplates.createTemplate({
    name: '删除测试模板',
    stage: 'requirements',
    prompt: '写需求',
    sections: [{ id: 'goals', title: '目标', level: 2, kind: 'markdown', guidance: '', required: true }]
  })
  insertApp(db, 'del-app', template.id)
  scaffold.scaffoldApp(
    { appId: 'del-app', appName: '删除测试应用', backendPort: 18094, requirementTemplateId: template.id },
    projects
  )
  const appDir = scaffold.appDirOf('del-app', projects)
  writeRequirementDoc(appDir, template.id)
  distribution.syncAppTemplates('del-app')
  const skillDir = path.join(appDir, '.opencode', 'skills', `adw-template-req-${template.id}`)
  assert.ok(fs.existsSync(path.join(skillDir, 'SKILL.md')))

  const usage = distribution.templateUsage('requirement', template.id)
  assert.equal(usage.apps.length, 1)
  assert.equal(usage.apps[0].documents[0].file, 'docs/requirements/requirements.md')

  assert.throws(
    () => requirementTemplates.deleteTemplate(template.id),
    (error: Error & { status?: number }) => error.status === 409
  )

  const moduleFile = path.join(appDir, 'docs', 'requirements', 'requirements.md')
  fs.writeFileSync(moduleFile, `---\ntitle: "测试"\ntemplate: builtin-prd\n---\n\n# 测试\n`, 'utf8')
  requirementTemplates.deleteTemplate(template.id)
  assert.equal(fs.existsSync(skillDir), false, '删除模板后应用内模板 skill 应被移除')
})

test('清理只按 manifest 白名单：用户 skill / 无 manifest 的同前缀目录不受影响', async () => {
  const { db, scaffold, distribution, requirementTemplates } = await setup()
  const template = requirementTemplates.createTemplate({
    name: '待清理模板',
    stage: 'requirements',
    prompt: '写需求',
    sections: [{ id: 'goals', title: '目标', level: 2, kind: 'markdown', guidance: '', required: true }]
  })
  insertApp(db, 'safe-app', 'builtin-prd')
  scaffold.scaffoldApp({ appId: 'safe-app', appName: '安全应用', backendPort: 18096 }, projects)
  const appDir = scaffold.appDirOf('safe-app', projects)
  const moduleFile = writeRequirementDoc(appDir, template.id)
  distribution.syncAppTemplates('safe-app')
  const managedDir = path.join(appDir, '.opencode', 'skills', `adw-template-req-${template.id}`)
  assert.ok(fs.existsSync(managedDir))

  const userDir = path.join(appDir, '.opencode', 'skills', 'my-own-skill')
  fs.mkdirSync(userDir, { recursive: true })
  fs.writeFileSync(path.join(userDir, 'SKILL.md'), '---\nname: mine\ndescription: mine\n---\n', 'utf8')
  const lookalike = path.join(appDir, '.opencode', 'skills', 'adw-template-req-user-made')
  fs.mkdirSync(lookalike, { recursive: true })
  fs.writeFileSync(path.join(lookalike, 'SKILL.md'), '---\nname: user\ndescription: user\n---\n', 'utf8')

  fs.writeFileSync(moduleFile, `---\ntitle: "测试"\ntemplate: builtin-prd\n---\n\n# 测试\n`, 'utf8')
  distribution.syncAppTemplates('safe-app')
  assert.equal(fs.existsSync(managedDir), false)
  assert.ok(fs.existsSync(path.join(userDir, 'SKILL.md')), '用户 skill 不应被删除')
  assert.ok(fs.existsSync(path.join(lookalike, 'SKILL.md')), '无 manifest 的同前缀目录不应被删除')
})

test('legacy：方法 skill 里的旧模板副本与 _manifest 按白名单清理，方法 SKILL 保留', async () => {
  const { db, scaffold, distribution } = await setup()
  insertApp(db, 'legacy-app', 'builtin-prd')
  scaffold.scaffoldApp({ appId: 'legacy-app', appName: '旧版应用', backendPort: 18097 }, projects)
  const appDir = scaffold.appDirOf('legacy-app', projects)

  const methodDir = path.join(appDir, '.opencode', 'skills', 'adw-requirements-document')
  const templatesDir = path.join(methodDir, 'assets', 'templates')
  fs.mkdirSync(templatesDir, { recursive: true })
  fs.writeFileSync(path.join(templatesDir, 'builtin-prd.md'), '# 旧副本\n', 'utf8')
  fs.writeFileSync(path.join(templatesDir, 'other.md'), '# 未登记\n', 'utf8')
  fs.writeFileSync(
    path.join(methodDir, '_manifest.json'),
    `${JSON.stringify({ managed: true, skill: 'adw-requirements-document', skillVersion: '1', templates: { 'builtin-prd': { sourceId: 'builtin-prd', hash: 'x', file: 'builtin-prd.md', name: 'PRD' } } }, null, 2)}\n`,
    'utf8'
  )

  distribution.syncAppTemplates('legacy-app')
  assert.equal(fs.existsSync(path.join(templatesDir, 'builtin-prd.md')), false, '旧白名单副本应被删除')
  assert.equal(fs.existsSync(path.join(templatesDir, 'other.md')), true, '不在旧 manifest 白名单里的文件保留')
  assert.equal(fs.existsSync(path.join(methodDir, '_manifest.json')), false, '旧 manifest 应被删除')
  assert.ok(fs.existsSync(path.join(methodDir, 'SKILL.md')), '方法 SKILL.md 必须保留')
})

test('expectedSkillIds：方法 skill + 团队 skill + 当前选中的模板 skill', async () => {
  const { db, scaffold, distribution } = await setup()
  insertApp(db, 'expect-app', 'builtin-prd')
  scaffold.scaffoldApp({ appId: 'expect-app', appName: '期望应用', backendPort: 18098 }, projects)
  const ids = distribution.expectedSkillIds('expect-app')
  assert.deepEqual(ids, [
    'adw-requirements-document',
    'adw-design-artifacts',
    'adw-api-design',
    'adw-frontend-implementation',
    'afcenter-page-generation',
    'pm-components-usage',
    'adw-template-req-builtin-prd',
    'adw-template-proto-enterprise-application-platform'
  ])
})

test('设计系统应用：生成 pack 型模板 skill（manifest/hash）、团队 skill，且不生成旧原型模板 skill', async () => {
  const { db, scaffold, distribution, designSystem } = await setup()
  insertApp(db, 'ds-app', 'builtin-prd')
  scaffold.scaffoldApp({ appId: 'ds-app', appName: '设计系统应用', backendPort: 18100 }, projects)
  const appDir = scaffold.appDirOf('ds-app', projects)
  const legacySkill = path.join(appDir, '.opencode', 'skills', 'adw-template-proto-builtin-prototype-enterprise')
  assert.equal(fs.existsSync(legacySkill), false, '不应再生成旧原型模板 skill')

  // 模拟应用级设计系统选择（PATCH 或创建时写入 app_settings）
  designSystem.writeDesignSelection('ds-app', {
    pack: 'afcenter-app-templates-v1',
    applicationType: 'operations-management',
    style: 'classic-warm'
  })
  const synced = distribution.syncAppTemplates('ds-app')
  assert.deepEqual(synced.warnings, [])
  assert.equal('prototypeTemplate' in synced, false)
  const skill = 'adw-template-proto-operations-management'
  assert.ok(synced.templateSkills.includes(skill), '应生成设计模板 skill')

  const dir = path.join(appDir, '.opencode', 'skills', skill)
  const skillMd = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8')
  const assetText = fs.readFileSync(path.join(dir, 'assets', 'design-system.json'), 'utf8')
  assert.match(skillMd, /^name: "设计模板：运营管理后台 · 经典暖色"$/m)
  assert.match(skillMd, /afcenter-app-templates-v1/)
  assert.match(skillMd, /operations-management/)
  assert.match(skillMd, /classic-warm/)
  assert.match(skillMd, /\.\.\/afcenter-page-generation\/SKILL\.md/)
  assert.match(skillMd, /\.\.\/pm-components-usage\/SKILL\.md/)
  assert.match(skillMd, /docs\/design\/template\/operations-management\/pages\/OperationsTreeTable\.vue/)
  assert.match(skillMd, /docs\/design\/template\/styles\/classic-warm\/style\.css/)
  assert.match(skillMd, /\| 页面 id \| 名称 \| 种类 \| 配方 \| 蓝图\/契约 \| 主要组件 \|/)
  assert.match(skillMd, /`blueprint`/)
  assert.match(skillMd, /## 页面配方/)
  assert.match(skillMd, /## 组件映射/)
  assert.match(skillMd, /ui-check\.md/)

  const asset = JSON.parse(assetText) as {
    applicationType: string
    style: string
    styles: { style: string; styleId: string }
    pages: unknown[]
    skills: string[]
  }
  assert.equal(asset.applicationType, 'operations-management')
  assert.equal(asset.style, 'classic-warm')
  assert.equal(asset.styles.styleId, 'classic-warm')
  assert.equal(asset.styles.style, 'docs/design/template/styles/classic-warm/style.css')
  assert.equal(asset.pages.length, 8)
  assert.deepEqual(asset.skills, ['afcenter-page-generation', 'pm-components-usage'])

  const manifest = designManifestOf(appDir, 'operations-management')
  assert.equal(manifest.managed, true)
  assert.equal(manifest.kind, 'design-system')
  assert.equal(manifest.skill, skill)
  assert.equal(manifest.sourceId, 'operations-management')
  assert.equal(manifest.templateName, '运营管理后台')
  assert.equal(manifest.templateKind, 'builtin')
  assert.equal(manifest.packVersion, '1.0.0')
  assert.equal(manifest.hash, distribution.sha256(`${skillMd}\n${assetText}`))

  // 两个团队 skill 随工作台资产分发
  for (const team of ['afcenter-page-generation', 'pm-components-usage']) {
    assert.ok(fs.existsSync(path.join(appDir, '.opencode', 'skills', team, 'SKILL.md')), `缺少团队 skill：${team}`)
  }
  assert.equal(fs.existsSync(legacySkill), false, '不应存在旧原型模板 skill')

  // expectedSkillIds：方法 + 团队 + 需求模板 + 设计模板
  const ids = distribution.expectedSkillIds('ds-app')
  assert.ok(ids.includes('afcenter-page-generation') && ids.includes('pm-components-usage'))
  assert.ok(ids.includes(skill))
  assert.equal(ids.includes('adw-template-proto-builtin-prototype-enterprise'), false)

  // 幂等：再次同步 hash 不变、无告警
  const again = distribution.syncAppTemplates('ds-app')
  assert.deepEqual(again.warnings, [])
  assert.equal(designManifestOf(appDir, 'operations-management').hash, manifest.hash)

  // 工作区对齐：design-system.json / 蓝图副本被删除后可恢复
  const firstAlign = distribution.ensureWorkspaceAssets('ds-app')
  assert.deepEqual(firstAlign.warnings, [])
  assert.ok(fs.existsSync(path.join(appDir, 'docs', 'design', 'design-system.json')))
  fs.rmSync(path.join(appDir, 'docs', 'design', 'design-system.json'))
  fs.rmSync(path.join(appDir, 'docs', 'design', 'template', 'operations-management', 'structure.css'))
  const aligned = distribution.ensureWorkspaceAssets('ds-app')
  assert.deepEqual(aligned.warnings, [])
  assert.ok(fs.existsSync(path.join(appDir, 'docs', 'design', 'design-system.json')))
  assert.ok(fs.existsSync(path.join(appDir, 'docs', 'design', 'template', 'operations-management', 'structure.css')))
})

test('P7-7c 自定义 pack：设计模板 skill 页面 kind/契约段/manifest，ensureWorkspaceAssets 对齐 contract/structure', async () => {
  const { db, scaffold, distribution, designSystem } = await setup()
  const packId = 'supplier-hub'
  seedCustomPack(packId)
  insertApp(db, 'ds-custom', 'builtin-prd')
  designSystem.writeDesignSelection('ds-custom', { pack: packId, applicationType: packId, style: 'data-cyan' })
  scaffold.scaffoldApp({
    appId: 'ds-custom',
    appName: '自定义模板应用',
    backendPort: 18102,
    requirementTemplateId: 'builtin-prd',
    designSystem: { pack: packId, applicationType: packId, style: 'data-cyan' }
  })
  const appDir = scaffold.appDirOf('ds-custom', projects)
  const skill = `adw-template-proto-${packId}`
  assert.ok(distribution.expectedSkillIds('ds-custom').includes(skill))

  const skillMd = fs.readFileSync(path.join(appDir, '.opencode', 'skills', skill, 'SKILL.md'), 'utf8')
  assert.match(skillMd, /\| 页面 id \| 名称 \| 种类 \| 配方 \| 蓝图\/契约 \| 主要组件 \|/)
  assert.match(skillMd, /`reference`/)
  assert.match(skillMd, /`contract`/)
  assert.match(skillMd, /source=afcenter-app-templates-v1\/operations-management\/list/)
  assert.match(skillMd, /契约（无蓝图） `docs\/design\/template\/supplier-hub\/contracts\/supplier-form\.json`/)
  assert.match(skillMd, /## 契约页实现（无蓝图）/)
  assert.match(skillMd, /无蓝图，按契约实现|不要复制\/编造蓝图/)

  const manifest = designManifestOf(appDir, packId)
  assert.equal(manifest.kind, 'design-system')
  assert.equal(manifest.templateKind, 'custom')
  assert.equal(manifest.packVersion, '1.0.2')

  const asset = JSON.parse(
    fs.readFileSync(path.join(appDir, '.opencode', 'skills', skill, 'assets', 'design-system.json'), 'utf8')
  ) as {
    origin?: { kind: string }
    preview?: { structureUrl?: string; baseApplicationType?: string }
    pages: Array<{ id: string; kind: string; contractFile?: string; blueprint?: string }>
  }
  assert.equal(asset.origin?.kind, 'custom')
  assert.equal(asset.preview?.baseApplicationType, 'enterprise-application-platform')
  assert.match(String(asset.preview?.structureUrl), /^\/api\/apps\/ds-custom\/design-system\/asset\?path=/)
  const formPage = asset.pages.find(page => page.id === 'supplier-form')!
  assert.equal(formPage.kind, 'contract')
  assert.equal(formPage.blueprint, undefined)
  assert.equal(formPage.contractFile, 'docs/design/template/supplier-hub/contracts/supplier-form.json')

  // 工作区受管副本
  for (const relative of [
    'docs/design/design-system.json',
    'docs/design/template/supplier-hub/structure.css',
    'docs/design/template/supplier-hub/pages/supplier-list.vue',
    'docs/design/template/supplier-hub/contracts/supplier-form.json',
    'docs/design/template/styles/shared.css',
    'docs/design/template/styles/data-cyan/style.css'
  ]) {
    assert.ok(fs.existsSync(path.join(appDir, relative)), `缺少 ${relative}`)
  }
  assert.equal(fs.existsSync(path.join(appDir, 'docs/design/template/supplier-hub/pages/supplier-form.vue')), false)

  // 删除受管副本后对齐恢复；frontend/docs 正文不被覆盖
  const designBody = path.join(appDir, 'docs/design/design-brief.md')
  writeFile(designBody, '# 设计说明\n')
  fs.rmSync(path.join(appDir, 'docs/design/template/supplier-hub/contracts/supplier-form.json'))
  fs.rmSync(path.join(appDir, 'docs/design/design-system.json'))
  const aligned = distribution.ensureWorkspaceAssets('ds-custom')
  assert.deepEqual(aligned.warnings, [])
  assert.ok(fs.existsSync(path.join(appDir, 'docs/design/template/supplier-hub/contracts/supplier-form.json')))
  assert.ok(fs.existsSync(path.join(appDir, 'docs/design/design-system.json')))
  assert.equal(fs.readFileSync(designBody, 'utf8'), '# 设计说明\n')
})

test('设计模板 skill 清理只按 manifest：无 manifest 的同前缀目录不受影响', async () => {
  const { db, scaffold, distribution, designSystem } = await setup()
  insertApp(db, 'ds-safe', 'builtin-prd')
  scaffold.scaffoldApp({ appId: 'ds-safe', appName: '设计安全', backendPort: 18101 }, projects)
  const appDir = scaffold.appDirOf('ds-safe', projects)
  designSystem.writeDesignSelection('ds-safe', {
    pack: 'afcenter-app-templates-v1',
    applicationType: 'incident-response-console',
    style: 'high-contrast-tool'
  })
  distribution.syncAppTemplates('ds-safe')
  const userDir = path.join(appDir, '.opencode', 'skills', 'adw-template-proto-user-made')
  fs.mkdirSync(userDir, { recursive: true })
  fs.writeFileSync(path.join(userDir, 'SKILL.md'), '---\nname: user\ndescription: user\n---\n', 'utf8')

  // 不再提供设计系统：只清理有 manifest 的设计模板 skill
  const synced = distribution.syncTemplatesInto(appDir, { requirementTemplateId: 'builtin-prd' })
  assert.equal('prototypeTemplate' in synced, false)
  assert.equal(
    fs.existsSync(path.join(appDir, '.opencode', 'skills', 'adw-template-proto-incident-response-console')),
    false
  )
  assert.ok(fs.existsSync(path.join(userDir, 'SKILL.md')), '无 manifest 的同前缀目录不应被删除')
})
