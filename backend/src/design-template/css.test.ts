/**
 * P7-7a structure.css 解析/合并（共享核心 `lib/css.cjs`）
 *
 * - spike D 基数可复现：4 套结构 793 条 → 514 唯一三元组（去重 279）、跨类型真冲突 3 条；
 * - 顺序/去重/注释/@media/@keyframes；
 * - 同选择器不同规则体全部保留并记录冲突（后者生效）。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { builtinDesignSystemRoot } from '../design/pack'
import { workshopCore } from '../design-template/core'

const css = workshopCore().css
const PACK = path.join(builtinDesignSystemRoot(), 'afcenter-app-templates-v1')
const TYPES = [
  'enterprise-application-platform',
  'operations-management',
  'data-governance-workbench',
  'incident-response-console'
]

function builtinSources(): Array<{ type: string; css: string }> {
  return TYPES.map(type => ({
    type,
    css: fs.readFileSync(path.join(PACK, 'application-types', type, 'structure.css'), 'utf8')
  }))
}

test('内置 4 套 structure.css：793 条 → 514 唯一三元组（去重 279），3 条真冲突', () => {
  const merged = css.mergeStructureCss(builtinSources())
  assert.equal(merged.totalRules, 793)
  assert.equal(merged.uniqueTriples, 514)
  assert.equal(merged.rules, 514)
  assert.equal(merged.deduped, 279)
  assert.equal(merged.conflicts.length, 3)
  assert.deepEqual(merged.sources, TYPES)
  assert.deepEqual(
    merged.conflicts.map(item => item.selector).sort(),
    ['.pm-search-body', '.pm-search-main', '.pm-upload-copy']
  )
  for (const conflict of merged.conflicts) {
    assert.ok(conflict.sources.length >= 2)
  }
  const conflictWarnings = merged.warnings.filter(item => item.code === 'css-conflict')
  assert.equal(conflictWarnings.length, 3)
  // 每个来源类型都有分节注释
  for (const type of TYPES) assert.ok(merged.css.includes(`/* ===== ${type} ===== */`))
  // @keyframes 保留但不计入规则基线
  assert.equal(merged.atRules, 2)
  assert.ok(merged.css.includes('@keyframes classic-page-in'))
  assert.ok(merged.css.includes('@keyframes pm-scan'))
  assert.ok(merged.css.endsWith('\n'))
})

test('确定性：同输入两次合并结果字节一致', () => {
  const first = css.mergeStructureCss(builtinSources())
  const second = css.mergeStructureCss(builtinSources())
  assert.equal(first.css, second.css)
  assert.deepEqual(first.conflicts, second.conflicts)
})

test('解析：去注释、保留原始规则体、@media 带条件', () => {
  const source = `/* 注释 */
.a { color: red; }
@media (max-width: 640px) {
  .a { color: blue; }
  .b, .c { display: flex; }
}
@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
`
  const parsed = css.parseStructureCss(source)
  const selectors = parsed.rules.map(rule => `${rule.media}|${rule.selector}`)
  assert.deepEqual(selectors, ['|.a', '@media (max-width:640px)|.a', '@media (max-width:640px)|.b,.c'])
  assert.equal(parsed.rules[0].body, 'color:red;')
  assert.equal(parsed.atRules.length, 1)
  assert.ok(parsed.atRules[0].startsWith('@keyframes spin'))
})

test('合并：三元组完全相同去重（保留首次原文）；同选择器不同规则体全部保留', () => {
  const merged = css.mergeStructureCss([
    { type: 'a', css: '.dup { color: red; }\n.only-a { margin: 0; }\n.conflict { color: red; }' },
    { type: 'b', css: '.dup { color: red; }\n.conflict { color: blue; }\n.only-b { padding: 0; }' }
  ])
  assert.equal(merged.totalRules, 6)
  assert.equal(merged.rules, 5)
  assert.equal(merged.deduped, 1)
  assert.equal(merged.conflicts.length, 1)
  assert.equal(merged.conflicts[0].selector, '.conflict')
  assert.deepEqual(merged.conflicts[0].sources, ['a', 'b'])
  // 顺序：a 段在前，b 段在后；后写的 .conflict 覆盖前者
  const aIndex = merged.css.indexOf('/* ===== a ===== */')
  const bIndex = merged.css.indexOf('/* ===== b ===== */')
  assert.ok(aIndex >= 0 && bIndex > aIndex)
  assert.equal(merged.css.indexOf('.conflict { color: red; }') < merged.css.indexOf('.conflict { color: blue; }'), true)
  assert.equal(merged.css.split('.dup { color: red; }').length - 1, 1, '相同三元组只写一份')
})

test('合并：@media 内规则去重与跨来源冲突（media 参与键）', () => {
  const merged = css.mergeStructureCss([
    { type: 'a', css: '@media (max-width: 640px) { .x { color: red; } }' },
    { type: 'b', css: '@media (max-width: 640px) { .x { color: red; } .y { color: blue; } }' }
  ])
  assert.equal(merged.totalRules, 3)
  assert.equal(merged.rules, 2)
  assert.equal(merged.conflicts.length, 0)
  assert.ok(merged.css.includes('@media (max-width:640px) {'))
  assert.ok(merged.css.includes('.y { color: blue; }'))

  const conflicting = css.mergeStructureCss([
    { type: 'a', css: '.m { color: red; }' },
    { type: 'b', css: '@media (max-width: 640px) { .m { color: red; } }' }
  ])
  assert.equal(conflicting.conflicts.length, 0, 'media 不同不视为同选择器冲突')
})
