/**
 * 单需求文档（D1）：缺失时按模板生成骨架；已存在不覆盖；frontmatter 只 title/template。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, before } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-req-doc-'))
const projects = path.join(root, 'projects')
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = projects
process.env.OPENCODE_AUTO_START = 'false'

const appId = 'doc-app'
const appDir = path.join(projects, appId)
let dbModule: typeof import('../db')

before(async () => {
  dbModule = await import('../db')
  const now = new Date().toISOString()
  dbModule.db
    .prepare(
      `INSERT INTO apps (id, name, description, dir, backend_port, status, requirement_template_id, created_at, updated_at)
       VALUES (?, ?, NULL, ?, 8081, 'requirements', NULL, ?, ?)`
    )
    .run(appId, '商品管理应用', appId, now, now)
  fs.mkdirSync(appDir, { recursive: true })
})

after(async () => {
  dbModule?.db.close()
  fs.rmSync(root, { recursive: true, force: true })
})

test('缺失时生成 requirements.md 骨架：title/template，无 module/order，含 Epic/Story 约定', async () => {
  const { ensureRequirementDoc, REQUIREMENTS_RELATIVE } = await import('./doc-file')
  const result = ensureRequirementDoc(appId, appDir)
  assert.equal(result.created, true)
  assert.equal(result.skipped, false)
  assert.equal(result.file, REQUIREMENTS_RELATIVE)
  const file = path.join(appDir, 'docs', 'requirements', 'requirements.md')
  assert.equal(fs.existsSync(file), true)
  const text = fs.readFileSync(file, 'utf8')
  assert.match(text, /^---\n/)
  assert.match(text, /^title: "商品管理应用"$/m)
  assert.match(text, /^template: builtin-prd$/m)
  assert.doesNotMatch(text, /^module:/m)
  assert.doesNotMatch(text, /^order:/m)
  assert.match(text, /### EP-001 <Epic 标题>/)
  assert.match(text, /#### US-001 <用户故事标题>/)
  assert.ok((text.match(/^## /gm) ?? []).length >= 1)
})

test('已存在不覆盖', async () => {
  const { ensureRequirementDoc } = await import('./doc-file')
  const file = path.join(appDir, 'docs', 'requirements', 'requirements.md')
  fs.writeFileSync(file, '---\ntitle: "手写"\ntemplate: builtin-prd\n---\n\n# 手写\n', 'utf8')
  const result = ensureRequirementDoc(appId, appDir)
  assert.equal(result.created, false)
  assert.equal(result.reason, 'exists')
  assert.equal(fs.readFileSync(file, 'utf8'), '---\ntitle: "手写"\ntemplate: builtin-prd\n---\n\n# 手写\n')
})

test('requirementDocTemplateOf 读取 frontmatter template', async () => {
  const { requirementDocTemplateOf } = await import('./doc-file')
  assert.equal(requirementDocTemplateOf(appDir), 'builtin-prd')
  assert.equal(requirementDocTemplateOf(path.join(root, 'missing')), '')
})

test('工作区不存在 → skipped', async () => {
  const { ensureRequirementDoc } = await import('./doc-file')
  const result = ensureRequirementDoc(appId, path.join(root, 'missing'))
  assert.equal(result.created, false)
  assert.equal(result.reason, 'workspace-missing')
})
