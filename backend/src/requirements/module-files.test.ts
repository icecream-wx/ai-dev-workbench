/**
 * 模块文件 API：新建/改名/排序/换模板；不写数据库、不提供删除
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-module-files-'))
const projects = path.join(root, 'projects')
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = projects
process.env.OPENCODE_AUTO_START = 'false'

interface Setup {
  db: typeof import('../db').db
  files: typeof import('./module-files')
  scaffold: typeof import('../apps/scaffold')
}

let setupPromise: Promise<Setup> | null = null

function setup(): Promise<Setup> {
  if (setupPromise) return setupPromise
  setupPromise = (async () => {
    const dbModule = await import('../db')
    const scaffold = await import('../apps/scaffold')
    const now = new Date().toISOString()
    scaffold.scaffoldApp(
      { appId: 'mod-app', appName: '模块应用', backendPort: 18095, requirementTemplateId: 'builtin-prd-lite' },
      projects
    )
    dbModule.db
      .prepare(
        `INSERT INTO apps (id, name, description, dir, backend_port, status, requirement_template_id, created_at, updated_at)
         VALUES (?, ?, NULL, ?, 18095, 'requirements', 'builtin-prd-lite', ?, ?)`
      )
      .run('mod-app', '模块应用', 'mod-app', now, now)
    return { db: dbModule.db, files: await import('./module-files'), scaffold }
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

test('新建模块：MOD-001 文件名 + frontmatter + 模板章节；不写 DB', async () => {
  const { db, files, scaffold } = await setup()
  const appDir = scaffold.appDirOf('mod-app', projects)
  const before = db.prepare('SELECT COUNT(*) AS count FROM app_sessions').get() as { count: number }

  const first = files.createModuleFile('mod-app', { title: '商品管理' })
  assert.equal(first.module.key, 'MOD-001')
  assert.equal(first.module.order, 1)
  assert.equal(first.module.template, 'builtin-prd-lite')
  assert.equal(first.module.file, 'docs/requirements/MOD-001-商品管理.md')

  const text = fs.readFileSync(path.join(appDir, first.module.file), 'utf8')
  assert.match(text, /^---\nmodule: MOD-001\n/)
  assert.match(text, /^title: "商品管理"$/m)
  assert.match(text, /^order: 1$/m)
  assert.match(text, /^template: builtin-prd-lite$/m)
  assert.match(text, /^# 商品管理$/m)
  assert.equal((text.match(/^## /gm) ?? []).length, 6)

  const second = files.createModuleFile('mod-app', { title: '订单管理' })
  assert.equal(second.module.key, 'MOD-002')
  assert.equal(second.module.order, 2)

  const after = db.prepare('SELECT COUNT(*) AS count FROM app_sessions').get() as { count: number }
  assert.equal(after.count, before.count)
})

test('改名：文件重命名 + frontmatter/H1 同步；章节保留', async () => {
  const { files, scaffold } = await setup()
  const appDir = scaffold.appDirOf('mod-app', projects)
  const oldFile = path.join(appDir, 'docs', 'requirements', 'MOD-001-商品管理.md')
  fs.appendFileSync(oldFile, '\n补充的业务说明。\n', 'utf8')

  const updated = files.updateModuleFile('mod-app', 'MOD-001', { title: '商品中心', order: 3 })
  assert.equal(updated.module.file, 'docs/requirements/MOD-001-商品中心.md')
  assert.equal(fs.existsSync(oldFile), false)
  const text = fs.readFileSync(path.join(appDir, updated.module.file), 'utf8')
  assert.match(text, /^title: "商品中心"$/m)
  assert.match(text, /^order: 3$/m)
  assert.match(text, /^# 商品中心$/m)
  assert.match(text, /补充的业务说明/)
})

test('换模板：frontmatter 更新 + 模板副本就位', async () => {
  const { files, scaffold } = await setup()
  const updated = files.updateModuleFile('mod-app', 'MOD-002', { template: 'builtin-prd' })
  assert.equal(updated.module.template, 'builtin-prd')
  const appDir = scaffold.appDirOf('mod-app', projects)
  const skill = path.join(appDir, '.opencode', 'skills', 'adw-template-req-builtin-prd', 'SKILL.md')
  assert.ok(fs.existsSync(skill), '换模板后应生成对应模板 skill')
})

test('非法输入：未知模块 404、空标题 400', async () => {
  const { files } = await setup()
  assert.throws(
    () => files.updateModuleFile('mod-app', 'MOD-999', { title: 'x' }),
    (error: Error & { status?: number }) => error.status === 404
  )
  assert.throws(
    () => files.createModuleFile('mod-app', { title: '   ' }),
    (error: Error & { status?: number }) => error.status === 400
  )
})
