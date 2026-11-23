/**
 * P7-7 spike C：内置设计模板包 catalog 可行性扫描（不调模型、只读仓库）
 *
 * 扫描 templates/design-system/afcenter-app-templates-v1：
 * - pack.json 的应用类型/页面/风格/componentMap/pageRecipes；
 * - 每个蓝图 .vue 里实际出现的 <pm-* 组件、引用次数、用法片段；
 * - 组件并集、被页面引用次数、契约渲染器可映射的控件（与 frontend/src/design/prototype/contract-view.js 的 COMPONENT_CONTROLS 对齐）；
 * - 输出 JSON（stdout + 可选文件），供 P7-7 设计稿/证据引用。
 *
 * 运行：node spike-c-catalog-scan.mjs [--json-out <file>]
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const ROOT = path.join(os.tmpdir(), 'workbench-p7-7-spike')
const REPO = process.env.REPO_ROOT || path.resolve('E:/work_space_primeton/ai-dev-workbench')
const PACK_DIR = path.join(REPO, 'templates', 'design-system', 'afcenter-app-templates-v1')
const CONTRACT_VIEW = path.join(REPO, 'frontend', 'src', 'design', 'prototype', 'contract-view.js')

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

/** 从 contract-view.js 读取 COMPONENT_CONTROLS 的键（不执行前端代码，正则抽取字面量键） */
function contractControlKeys() {
  const source = fs.readFileSync(CONTRACT_VIEW, 'utf8')
  const block = source.match(/const COMPONENT_CONTROLS = \{([\s\S]*?)\n\}/)
  const keys = new Set()
  if (!block) return keys
  for (const match of block[1].matchAll(/'([^']+)'\s*:/g)) keys.add(match[1])
  return keys
}

/** 扫描 blueprint 中 <pm-xxx ...> 标签（含自闭合/多行起始标签），返回 {name->count, snippets[name]} */
function scanComponents(file) {
  const source = fs.readFileSync(file, 'utf8')
  const counts = new Map()
  const snippets = new Map()
  const lines = source.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    for (const match of line.matchAll(/<(pm-[a-z0-9-]+)/g)) {
      const name = match[1]
      counts.set(name, (counts.get(name) || 0) + 1)
      if (!snippets.has(name)) {
        // 取从该标签开始到所在起始标签闭合的片段（最多 3 行），作为真实用法示例
        const from = match.index
        const joined = lines.slice(index, index + 3).join('\n').slice(Math.max(0, from - 0))
        const close = joined.indexOf('>')
        const snippet = (close >= 0 ? joined.slice(0, close + 1) : joined).trim().replace(/\s+/g, ' ')
        snippets.set(name, snippet.slice(0, 260))
      }
    }
  }
  return { counts, snippets }
}

function main() {
  const pack = readJson(path.join(PACK_DIR, 'pack.json'))
  const controls = contractControlKeys()
  const pages = []
  const componentRefs = new Map()
  const snippets = new Map()
  const missingBlueprints = []

  for (const type of pack.applicationTypes) {
    for (const page of type.pages) {
      const blueprintFile = path.join(PACK_DIR, page.blueprint)
      const exists = fs.existsSync(blueprintFile)
      if (!exists) missingBlueprints.push(page.blueprint)
      const scanned = exists ? scanComponents(blueprintFile) : { counts: new Map(), snippets: new Map() }
      const actual = [...scanned.counts.keys()].sort()
      const declared = [...(page.components || [])].sort()
      const onlyDeclared = declared.filter((name) => !scanned.counts.has(name))
      const onlyScanned = actual.filter((name) => !declared.includes(name))
      const pmCount = [...scanned.counts.values()].reduce((sum, value) => sum + value, 0)
      pages.push({
        applicationType: type.id,
        pageId: page.id,
        pageName: page.name,
        pageType: page.type,
        recipe: page.recipe,
        blueprint: page.blueprint,
        blueprintExists: exists,
        declaredComponents: declared,
        scannedComponents: actual,
        scannedTagCount: pmCount,
        onlyDeclared,
        onlyScanned
      })
      for (const [name, count] of scanned.counts) {
        componentRefs.set(name, (componentRefs.get(name) || 0) + count)
        if (!snippets.has(name) && scanned.snippets.has(name)) snippets.set(name, scanned.snippets.get(name))
      }
    }
  }

  const union = [...componentRefs.keys()].sort()
  const componentTable = union.map((name) => {
    const pagesUsing = pages.filter((page) => page.scannedComponents.includes(name))
    return {
      component: name,
      tagReferences: componentRefs.get(name),
      pageReferences: pagesUsing.length,
      pages: pagesUsing.map((page) => `${page.applicationType}/${page.pageId}`),
      contractControl: controls.has(name) ? name : null,
      contractSupported: controls.has(name),
      snippet: snippets.get(name) || ''
    }
  })

  const recipes = pack.pageRecipes
  const recipeUsage = {}
  for (const page of pages) recipeUsage[page.recipe] = (recipeUsage[page.recipe] || 0) + 1

  const appTypeSummary = pack.applicationTypes.map((type) => ({
    id: type.id,
    name: type.name,
    pages: type.pages.length,
    structure: type.structure,
    defaultStyle: type.defaultStyle
  }))

  const result = {
    scannedAt: new Date().toISOString(),
    pack: {
      id: pack.id,
      name: pack.name,
      version: pack.version,
      schemaVersion: pack.schemaVersion,
      defaultApplicationType: pack.defaultApplicationType,
      defaultStyle: pack.defaultStyle
    },
    applicationTypeCount: pack.applicationTypes.length,
    styleCount: pack.styles.length,
    styles: pack.styles.map((style) => ({ id: style.id, name: style.name, className: style.className, css: style.css })),
    pageCount: pages.length,
    appTypeSummary,
    recipes: Object.keys(recipes),
    recipeUsage,
    componentMap: pack.componentMap,
    componentCount: union.length,
    components: componentTable,
    contractControlCoverage: {
      mappedComponents: union.filter((name) => controls.has(name)).length,
      unmappedComponents: union.filter((name) => !controls.has(name)),
      contractControlKeys: [...controls].sort()
    },
    pagesSummary: pages.map((page) => ({
      applicationType: page.applicationType,
      pageId: page.pageId,
      pageName: page.pageName,
      recipe: page.recipe,
      componentCount: page.scannedComponents.length,
      components: page.scannedComponents,
      onlyDeclared: page.onlyDeclared,
      onlyScanned: page.onlyScanned
    })),
    missingBlueprints
  }

  const outArgIndex = process.argv.indexOf('--json-out')
  if (outArgIndex > 0 && process.argv[outArgIndex + 1]) {
    const out = process.argv[outArgIndex + 1]
    fs.mkdirSync(path.dirname(out), { recursive: true })
    fs.writeFileSync(out, JSON.stringify(result, null, 2), 'utf8')
    console.log(`[spike-c] JSON 写入 ${out}`)
  }

  console.log(
    `[spike-c] pack=${pack.id} 应用类型=${pack.applicationTypes.length} 风格=${pack.styles.length} 页面=${pages.length} 组件并集=${union.length}`
  )
  console.log(
    `[spike-c] 每类型页面数：` +
      pack.applicationTypes.map((type) => `${type.id}=${type.pages.length}`).join(' / ')
  )
  console.log(`[spike-c] componentMap=${Object.keys(pack.componentMap).length} pageRecipes=${Object.keys(recipes).length}`)
  console.log(`[spike-c] 契约控件可映射=${union.length - result.contractControlCoverage.unmappedComponents.length}/${union.length}`)
  console.log(`[spike-c] 未映射（容器/无控件语义）：${result.contractControlCoverage.unmappedComponents.join(', ')}`)
  console.log('[spike-c] 组件引用（tag refs / 页面数）：')
  for (const item of componentTable) {
    console.log(`  ${item.component}\t${item.tagReferences}\t${item.pageReferences}\t${item.contractSupported ? 'control' : 'container'}`)
  }
  console.log('[spike-c] 用法片段样例：')
  for (const item of componentTable.slice(0, 8)) console.log(`  ${item.component}: ${item.snippet}`)
  if (missingBlueprints.length) console.log('[spike-c] 缺失蓝图：', missingBlueprints)
}

main()
