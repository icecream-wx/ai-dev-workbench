/**
 * 设计一致性静态检查核心（应用级，D1 去模块）
 *
 * 同一份规则同时供：
 * - `scripts/check-fidelity.mjs`（应用内/仓库内 CLI，无外部依赖）；
 * - 后端 `POST /api/apps/:id/design-fidelity`（require 本文件）。
 *
 * 只读工作区文件，不执行代码、不写文件、不做截图比对；缺失文件降级为 warn/fail，
 * 不因文件缺失抛错。输出字段固定：id/label/status/evidence(+hint)。
 *
 * D2：14 项（新增 `api-design` 接口设计文档，第 14 项）。
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')

const SKELETON_MARKER = /^<!-- adw:ui-check:skeleton hash:[a-f0-9]{64} -->\n/m
const PAGE_TEMPLATE_NAMES = [
  'BusinessListPage',
  'TreeListPage',
  'StandardFormPage',
  'FormSection',
  'QueryPanel',
  'RowActions',
  'ThreePartPagination'
]
const LIST_RECIPES = new Set(['list', 'tree-list', 'main-sub'])
const LIST_TYPES = new Set(['list', 'tree-list'])
const FORM_RECIPES = new Set(['dialog-form', 'page-form', 'wizard'])
const FORM_TYPES = new Set(['form'])
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.cache', 'coverage'])
const MAX_EVIDENCE = 5
const UI_CHECK_FILE = 'docs/design/ui-check.md'

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  } catch {
    return ''
  }
}

function readJson(file) {
  try {
    return JSON.parse(readText(file))
  } catch {
    return null
  }
}

function exists(file) {
  try {
    return fs.existsSync(file)
  } catch {
    return false
  }
}

function sha256Buffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function sha256Text(value) {
  return createHash('sha256').update(value).digest('hex')
}

function readIfExists(file) {
  try {
    return fs.readFileSync(file)
  } catch {
    return Buffer.alloc(0)
  }
}

/** 与 backend/src/design/hash.ts 一致：sha256(entities + pages + design-system) */
function designHashOf(appDir) {
  const hash = createHash('sha256')
  for (const relative of ['docs/design/entities.json', 'docs/design/pages.json', 'docs/design/design-system.json']) {
    hash.update(readIfExists(path.join(appDir, relative)))
  }
  return hash.digest('hex')
}

function rel(appDir, file) {
  return path.relative(appDir, file).replace(/\\/g, '/')
}

function listFiles(directory, out = []) {
  let entries = []
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) listFiles(full, out)
    else if (entry.isFile()) out.push(full)
  }
  return out
}

function normalizeToken(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function clipList(items, limit = MAX_EVIDENCE) {
  if (!items.length) return ''
  const shown = items.slice(0, limit)
  return `${shown.join('、')}${items.length > shown.length ? ` 等 ${items.length} 项` : ''}`
}

function pageCatalogId(catalogRef) {
  return catalogRef.includes('/') ? catalogRef.slice(catalogRef.lastIndexOf('/') + 1) : ''
}

function lastSegment(value) {
  return value.includes('/') ? value.slice(value.lastIndexOf('/') + 1) : value
}

function normalizeDesignSystem(parsed) {
  const record = asRecord(parsed)
  if (!record) return null
  const styles = asRecord(record.styles)
  const origin = asRecord(record.origin)
  return {
    pack: text(record.pack) || undefined,
    packName: text(record.packName) || undefined,
    packVersion: text(record.packVersion) || undefined,
    origin: origin
      ? {
          kind: text(origin.kind) || undefined,
          baseApplicationType: text(origin.baseApplicationType) || undefined
        }
      : undefined,
    applicationType: text(record.applicationType) || undefined,
    applicationTypeName: text(record.applicationTypeName) || undefined,
    style: text(record.style) || undefined,
    styleName: text(record.styleName) || undefined,
    styleId: text(record.styleId) || text(record.style) || undefined,
    styles: styles
      ? {
          shared: text(styles.shared) || undefined,
          style: text(styles.style) || undefined
        }
      : undefined,
    blueprintRoot: text(record.blueprintRoot) || undefined,
    templateDir: text(record.templateDir) || undefined,
    pages: asArray(record.pages)
      .map(item => asRecord(item))
      .filter(Boolean)
      .map(item => {
        const source = asRecord(item.source)
        const kindText = text(item.kind)
        return {
          id: text(item.id),
          name: text(item.name),
          blueprint: text(item.blueprint),
          recipe: text(item.recipe),
          kind:
            kindText === 'reference' || kindText === 'contract' || kindText === 'blueprint'
              ? kindText
              : 'blueprint',
          contractFile: text(item.contractFile),
          source: source
            ? {
                pack: text(source.pack),
                applicationType: text(source.applicationType),
                pageId: text(source.pageId)
              }
            : undefined
        }
      })
      .filter(item => item.id)
  }
}

function readDesignSystemFile(appDir) {
  const file = path.join(appDir, 'docs', 'design', 'design-system.json')
  if (!exists(file)) return { file: rel(appDir, file), exists: false, error: '', data: null }
  const raw = readText(file)
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    return {
      file: rel(appDir, file),
      exists: true,
      error: error instanceof Error ? error.message : String(error),
      data: null
    }
  }
  const data = normalizeDesignSystem(parsed)
  return {
    file: rel(appDir, file),
    exists: true,
    error: data ? '' : '根节点不是对象',
    data
  }
}

function readEntitiesFile(appDir) {
  const file = path.join(appDir, 'docs', 'design', 'entities.json')
  if (!exists(file)) return { exists: false, file: rel(appDir, file), data: null }
  const data = asRecord(readJson(file))
  return { exists: true, file: rel(appDir, file), data }
}

function readPagesFile(appDir) {
  const file = path.join(appDir, 'docs', 'design', 'pages.json')
  if (!exists(file)) return { exists: false, file: rel(appDir, file), data: null }
  const data = asRecord(readJson(file))
  return { exists: true, file: rel(appDir, file), data }
}

/**
 * 蓝图路径解析：
 * - pages.json 可能写 pack 相对路径（application-types/<type>/pages/X.vue）；
 * - design-system.json 的 pages[].blueprint 是工作区路径（docs/design/template/<type>/pages/X.vue）；
 * - 也接受直接写工作区路径/受管模板相对路径。
 */
function resolveBlueprint(appDir, page, system) {
  const declared = text(page.blueprint)
  const catalogId = pageCatalogId(text(page.catalogRef))
  const systemById = new Map((system?.pages ?? []).map(entry => [entry.id, entry]))
  const fromSystem = systemById.get(catalogId) || systemById.get(text(page.id))
  const systemBlueprint = text(fromSystem?.blueprint)
  const candidates = []

  if (declared.startsWith('docs/')) candidates.push(declared)
  if (declared.startsWith('application-types/')) {
    const base = path.posix.basename(declared)
    const templateDir = system?.templateDir || (system?.applicationType ? `docs/design/template/${system.applicationType}` : '')
    if (templateDir) candidates.push(`${templateDir.replace(/\/+$/, '')}/pages/${base}`)
    if (system?.blueprintRoot) candidates.push(`${system.blueprintRoot.replace(/\/+$/, '')}/pages/${base}`)
  }
  if (declared && !declared.startsWith('docs/') && !declared.startsWith('application-types/')) {
    if (system?.templateDir) candidates.push(`${system.templateDir.replace(/\/+$/, '')}/${declared.replace(/^\/+/, '')}`)
    candidates.push(declared)
  }
  if (systemBlueprint) candidates.push(systemBlueprint)

  for (const candidate of candidates) {
    const relative = candidate.replace(/\\/g, '/').replace(/^\.\//, '')
    if (exists(path.join(appDir, relative))) return { file: relative, exists: true }
  }
  return { file: candidates[0] || '', exists: false }
}

/** pages.json → 扁平页面（带 pageSet/epic） */
function normalizePages(pagesData, system, appDir) {
  const systemById = new Map((system?.pages ?? []).map(entry => [entry.id, entry]))
  const pages = []
  for (const rawSet of asArray(pagesData?.pageSets)) {
    const pageSet = asRecord(rawSet)
    if (!pageSet) continue
    const pageSetId = text(pageSet.id)
    const epic = text(pageSet.epic)
    for (const rawPage of asArray(pageSet.pages)) {
      const item = asRecord(rawPage)
      if (!item) continue
      const catalogId = pageCatalogId(text(item.catalogRef))
      const fromSystem = systemById.get(catalogId) || systemById.get(text(item.id))
      const kind = fromSystem?.kind === 'contract' ? 'contract' : fromSystem?.kind === 'reference' ? 'reference' : 'blueprint'
      const contractFile = kind === 'contract' ? text(fromSystem?.contractFile) : ''
      const contractExists = Boolean(contractFile) && exists(path.join(appDir, contractFile))
      const resolved = kind === 'contract' ? { file: '', exists: false } : resolveBlueprint(appDir, item, system)
      const recipe = text(item.recipe)
      const type = text(item.type)
      pages.push({
        id: text(item.id) || 'page',
        name: text(item.name) || text(item.id) || 'page',
        pageSet: pageSetId,
        epic,
        type,
        recipe,
        kind,
        contractFile,
        contractExists,
        systemRecipe: text(fromSystem?.recipe),
        catalogRef: text(item.catalogRef),
        blueprint: resolved.file,
        blueprintExists: resolved.exists,
        needsForm: Boolean(asRecord(item.form)) || FORM_RECIPES.has(recipe) || FORM_TYPES.has(type),
        needsList: LIST_RECIPES.has(recipe) || LIST_TYPES.has(type)
      })
    }
  }
  return pages
}

function collectFrontend(appDir) {
  const srcDir = path.join(appDir, 'frontend', 'src')
  if (!exists(srcDir)) {
    return { exists: false, srcDir: rel(appDir, srcDir), files: [], usageFiles: [], views: [], router: null }
  }
  const files = listFiles(srcDir)
    .filter(file => /\.(vue|js|ts|mjs|cjs)$/i.test(file))
    .map(file => ({ file, rel: rel(appDir, file), text: readText(file) }))
  const views = files.filter(item => {
    if (!/\.vue$/i.test(item.rel)) return false
    if (item.rel.includes('components/PageTemplates/')) return false
    const base = path.basename(item.rel)
    return base !== 'App.vue' && base !== 'AppIndex.vue'
  })
  const usageFiles = files.filter(item => {
    if (item.rel.includes('components/PageTemplates/')) return false
    if (item.rel.endsWith('/views/AppIndex.vue') || item.rel === 'frontend/src/views/AppIndex.vue') return false
    if (item.rel.endsWith('/preferences/GlobalPreference.js')) return false
    return true
  })
  const routerCandidates = [
    'frontend/src/router/index.js',
    'frontend/src/router/index.ts',
    'frontend/src/router/index.mjs',
    'frontend/src/router.js'
  ]
  let router = null
  for (const candidate of routerCandidates) {
    const file = path.join(appDir, candidate)
    if (!exists(file)) continue
    router = { rel: candidate, text: readText(file) }
    break
  }
  return { exists: true, srcDir: rel(appDir, srcDir), files, usageFiles, views, router }
}

function pageKeywords(page) {
  const values = []
  if (page.blueprint) values.push(path.basename(page.blueprint, path.extname(page.blueprint)))
  values.push(page.id)
  if (page.catalogRef) values.push(lastSegment(page.catalogRef))
  values.push(page.name)
  return unique(values)
}

function matchView(page, views) {
  const keywords = pageKeywords(page)
  let best = null
  for (const view of views) {
    const base = normalizeToken(path.basename(view.rel, path.extname(view.rel)))
    let score = 0
    for (const keyword of keywords) {
      const normalized = normalizeToken(keyword)
      if (normalized.length >= 3) {
        if (base === normalized) score += 6
        else if (base.includes(normalized) || normalized.includes(base)) score += 3
      }
      if (/[\u4e00-\u9fff]/.test(keyword) && view.text.includes(keyword)) score += 2
      else if (normalized.length >= 3 && view.text.includes(keyword)) score += 1
    }
    if (score > 0 && (!best || score > best.score)) best = { view, score }
  }
  return best ? best.view : null
}

function routeCount(frontend) {
  if (!frontend.router) return { file: '', count: 0 }
  const count = (frontend.router.text.match(/\bpath\s*:/g) || []).length
  return { file: frontend.router.rel, count }
}

function uiCheckStatus(appDir) {
  const file = path.join(appDir, UI_CHECK_FILE)
  if (!exists(file)) return { status: 'missing', file: UI_CHECK_FILE }
  try {
    const content = fs.readFileSync(file, 'utf8')
    const marker = SKELETON_MARKER.exec(content)
    if (!marker) return { status: 'filled', file: UI_CHECK_FILE }
    const expected = (marker[0].match(/hash:([a-f0-9]{64})/) || [])[1] || ''
    const actual = sha256Text(content.replace(SKELETON_MARKER, ''))
    return { status: actual === expected ? 'skeleton' : 'filled', file: UI_CHECK_FILE }
  } catch {
    return { status: 'skeleton', file: UI_CHECK_FILE }
  }
}

function prototypeInfo(appDir) {
  const manifestFile = path.join(appDir, 'docs', 'design', 'prototypes', '_manifest.json')
  const manifest = readJson(manifestFile)
  if (!manifest || !asRecord(manifest)) return { state: 'missing', pages: 0 }
  const pages = manifest.pages && typeof manifest.pages === 'object' ? Object.keys(manifest.pages).length : 0
  const designHash = text(manifest.designHash)
  const currentHash = designHashOf(appDir)
  const stale = Boolean(designHash) && Boolean(currentHash) && designHash !== currentHash
  return { state: stale ? 'stale' : pages ? 'fresh' : 'empty', pages }
}

/**
 * 风格样式文件：`docs/design/template/styles/<styleId>/style.css`；
 * 旧应用若仍是 `docs/design/template/styles/style.css` 也接受（不迁移、不 fail，只提示）。
 */
function styleFileState(appDir, data) {
  const declared = text(data?.styles?.style)
  if (!declared) return { checked: false }
  const legacy = 'docs/design/template/styles/style.css'
  const styleId = text(data.styleId) || text(data.style)
  const preferred = styleId ? `docs/design/template/styles/${styleId}/style.css` : ''
  const safeExists = relative => {
    if (!relative) return false
    const file = path.resolve(appDir, relative)
    if (file !== appDir && !file.startsWith(appDir + path.sep)) return false
    return exists(file)
  }
  const candidates = [declared, legacy, preferred].filter(Boolean)
  const found = candidates.find(safeExists)
  if (!found) return { checked: true, ok: false, missing: declared }
  return { checked: true, ok: true, path: found, legacy: found === legacy }
}

function designSystemCheck(system, appDir) {
  if (!system.exists) {
    return {
      id: 'design-system',
      label: '应用设计系统',
      status: 'warn',
      evidence: `缺少 ${system.file}（尚未选择设计模板）`,
      hint: '新建应用会自动生成；可在设计视图改选设计模板后由工作台对齐。'
    }
  }
  if (system.error || !system.data) {
    return {
      id: 'design-system',
      label: '应用设计系统',
      status: 'fail',
      evidence: `${system.file} 无法解析：${system.error || '内容不是对象'}`,
      hint: '修复 JSON 或重新选择设计模板；受管文件不要手改。'
    }
  }
  const data = system.data
  const missing = []
  if (!data.pack) missing.push('pack')
  if (!data.applicationType) missing.push('applicationType')
  if (!data.style) missing.push('style')
  if (!data.pages.length) missing.push('pages')
  if (missing.length) {
    return {
      id: 'design-system',
      label: '应用设计系统',
      status: 'warn',
      evidence: `${system.file} 缺少：${missing.join('、')}`,
      hint: '重新选择设计模板生成完整摘要（pack/应用类型/风格/页面库）。'
    }
  }
  const style = styleFileState(appDir, data)
  if (style.checked && !style.ok) {
    return {
      id: 'design-system',
      label: '应用设计系统',
      status: 'warn',
      evidence: `${system.file} 声明的风格样式不存在：${style.missing}`,
      hint: '新应用应为 docs/design/template/styles/<styleId>/style.css。'
    }
  }
  const evidence = `${data.pack}${data.packVersion ? ` v${data.packVersion}` : ''} · ${data.applicationType} · ${data.style} · ${data.pages.length} 页蓝图`
  return {
    id: 'design-system',
    label: '应用设计系统',
    status: 'pass',
    evidence:
      style.checked && style.legacy
        ? `${evidence}；风格样式为旧路径 ${style.path}（建议新应用使用 docs/design/template/styles/<styleId>/style.css，不迁移）`
        : evidence
  }
}

function pageContractCheck(entities, pages, pagesFile) {
  if (!entities.exists && !pagesFile.exists) {
    return {
      id: 'page-contract',
      label: '页面契约',
      status: 'warn',
      evidence: '未找到 docs/design/entities.json 与 docs/design/pages.json',
      hint: '先在设计视图生成实体/页面集（entities.json + pages.json），再实现页面。'
    }
  }
  if (!pagesFile.exists || !pagesFile.data) {
    return {
      id: 'page-contract',
      label: '页面契约',
      status: 'fail',
      evidence: `缺少 ${pagesFile.file} 或无法解析`,
      hint: '先在设计视图生成 pages.json（页面集 = Epic）。'
    }
  }
  if (!pages.length) {
    return {
      id: 'page-contract',
      label: '页面契约',
      status: 'fail',
      evidence: `${pagesFile.file} 未定义页面`,
      hint: '补充 pageSets[].pages[]（id/name/type/recipe/blueprint 等）。'
    }
  }
  const incomplete = pages.filter(page =>
    !page.recipe ||
    (page.kind === 'contract' ? !page.contractFile : !page.catalogRef && !page.blueprint)
  )
  if (incomplete.length) {
    return {
      id: 'page-contract',
      label: '页面契约',
      status: 'warn',
      evidence: `${incomplete.length}/${pages.length} 页缺少 recipe 或 blueprint/catalogRef/契约文件：${clipList(
        incomplete.map(page => page.id)
      )}`,
      hint: '补 recipe/catalogRef/blueprint；契约页补 contracts/<page>.json，避免实现时凭感觉造页面。'
    }
  }
  return {
    id: 'page-contract',
    label: '页面契约',
    status: 'pass',
    evidence: `${pages.length} 页均含 recipe 与 blueprint/catalogRef/契约文件`
  }
}

function blueprintCheck(pages) {
  const contractPages = pages.filter(page => page.kind === 'contract')
  const declared = pages.filter(page => page.kind !== 'contract' && page.blueprint)
  const missingBlueprint = declared.filter(page => !page.blueprintExists)
  const missingContract = contractPages.filter(page => !page.contractExists)

  if (missingBlueprint.length) {
    return {
      id: 'blueprint-files',
      label: '蓝图文件',
      status: 'fail',
      evidence: `缺失 ${missingBlueprint.length}/${declared.length} 个蓝图：${clipList(
        missingBlueprint.map(page => `${page.id} → ${page.blueprint}`)
      )}${contractPages.length ? `；契约页 ${contractPages.length} 个（无蓝图，不在此项校验）` : ''}`,
      hint: '检查 design-system.json 的 templateDir/blueprint 与 pages.json 的 blueprint 路径。'
    }
  }
  if (missingContract.length) {
    return {
      id: 'blueprint-files',
      label: '蓝图文件',
      status: 'warn',
      evidence: `蓝图 ${declared.length} 个均存在；缺失 ${missingContract.length}/${contractPages.length} 个契约文件：${clipList(
        missingContract.map(page => `${page.id} → ${page.contractFile || '未记录'}`)
      )}`,
      hint: '契约页无蓝图；确认 docs/design/template/<type>/contracts/<page>.json 存在（工作台对齐会补）。'
    }
  }
  if (!declared.length) {
    return {
      id: 'blueprint-files',
      label: '蓝图文件',
      status: contractPages.length ? 'pass' : 'warn',
      evidence: contractPages.length
        ? `${contractPages.length} 个契约页（无蓝图）契约文件均存在`
        : '页面契约没有可校验的 blueprint（可能是无模板页面）',
      hint: contractPages.length ? undefined : '有模板页面时补 blueprint / catalogRef，并确认 docs/design/template 下文件存在。'
    }
  }
  return {
    id: 'blueprint-files',
    label: '蓝图文件',
    status: 'pass',
    evidence: `${declared.length} 个蓝图文件均存在（例如 ${declared[0].blueprint}）${
      contractPages.length ? `；另 ${contractPages.length} 个契约页（无蓝图）` : ''
    }`
  }
}

function templateContractCheck(pages) {
  const contractPages = pages.filter(page => page.kind === 'contract')
  if (!contractPages.length) {
    return {
      id: 'template-contract',
      label: '模板契约页',
      status: 'pass',
      evidence: '无契约页引用（页面按蓝图/内置模板实现）'
    }
  }
  const problems = []
  for (const page of contractPages) {
    if (!page.contractFile) {
      problems.push(`${page.id}（未记录契约文件）`)
      continue
    }
    if (!page.contractExists) {
      problems.push(`${page.id} → ${page.contractFile} 不存在`)
      continue
    }
    if (page.systemRecipe && page.recipe && page.systemRecipe !== page.recipe) {
      problems.push(`${page.id} recipe 不一致（pages.json ${page.recipe} / 模板 ${page.systemRecipe}）`)
    }
  }
  if (problems.length) {
    return {
      id: 'template-contract',
      label: '模板契约页',
      status: 'warn',
      evidence: `${problems.length}/${contractPages.length} 个契约页待确认：${clipList(problems)}`,
      hint: '契约页以 docs/design/template/<type>/contracts/<page>.json 为骨架；补齐文件并保持 recipe 一致（只报告，不阻断）。'
    }
  }
  return {
    id: 'template-contract',
    label: '模板契约页',
    status: 'pass',
    evidence: `${contractPages.length} 个契约页与模板契约一致（文件存在、recipe 一致）`
  }
}

function implementationCheck(pages, frontend) {
  if (!frontend.exists) {
    return {
      id: 'implementation',
      label: '实现视图/路由',
      status: 'fail',
      evidence: `缺少 ${frontend.srcDir}/（无法检查前端实现）`,
      hint: '新应用应从 templates/afc-remote 生成 frontend/；确认应用设计系统已配置。'
    }
  }
  if (!pages.length) {
    return {
      id: 'implementation',
      label: '实现视图/路由',
      status: 'warn',
      evidence: '没有页面契约，无法匹配实现文件'
    }
  }
  const routes = routeCount(frontend)
  const routeHint = pages.some(
    page => frontend.router && (frontend.router.text.includes(page.id) || frontend.router.text.includes(page.name))
  )
  const routesReady = routes.count > 1 || routeHint
  const matched = []
  const unmatched = []
  for (const page of pages) {
    const view = matchView(page, frontend.views)
    if (view) matched.push({ page, view })
    else unmatched.push(page)
  }
  const parts = [`视图匹配 ${matched.length}/${pages.length}`, routes.file ? `路由 ${routes.count} 条` : '未找到路由文件']
  if (unmatched.length) {
    const candidates = frontend.views.slice(0, 6).map(item => item.rel.replace(/^frontend\/src\//, ''))
    return {
      id: 'implementation',
      label: '实现视图/路由',
      status: 'warn',
      evidence: `${parts.join('；')}；未匹配：${clipList(unmatched.map(page => page.id))}${
        candidates.length ? `；候选视图：${candidates.join('、')}` : ''
      }`,
      hint: '按蓝图复制到 frontend/src/views/，并在 router/index.js 挂载；文件名/id 未能自动判断属于正常情况。'
    }
  }
  if (!routesReady) {
    return {
      id: 'implementation',
      label: '实现视图/路由',
      status: 'warn',
      evidence: `${parts.join('；')}；视图文件已找到但路由疑似未注册`,
      hint: '在 frontend/src/router/index.js 增加页面路由（或由宿主菜单挂载）。'
    }
  }
  return {
    id: 'implementation',
    label: '实现视图/路由',
    status: 'pass',
    evidence: `${parts.join('；')}；${matched
      .map(item => `${item.page.id}→${path.basename(item.view.rel)}`)
      .join('、')}`
  }
}

function pageTemplatesCheck(frontend) {
  if (!frontend.exists) {
    return { id: 'page-templates', label: 'PageTemplates', status: 'warn', evidence: '缺少 frontend/src，未检查' }
  }
  const found = new Set()
  let importsTemplates = false
  for (const file of frontend.usageFiles) {
    if (file.text.includes('PageTemplates')) importsTemplates = true
    for (const name of PAGE_TEMPLATE_NAMES) {
      if (new RegExp(`\\b${name}\\b`).test(file.text)) found.add(name)
    }
  }
  if (!found.size && !importsTemplates) {
    return {
      id: 'page-templates',
      label: 'PageTemplates',
      status: 'warn',
      evidence: '未发现 PageTemplates 导入/使用',
      hint: '列表/树/表单优先使用 frontend/src/components/PageTemplates/。'
    }
  }
  return {
    id: 'page-templates',
    label: 'PageTemplates',
    status: 'pass',
    evidence: `${importsTemplates ? '已导入 PageTemplates' : '已使用模板组件'}：${[...found].join('、') || '—'}`
  }
}

function pmComponentsCheck(frontend) {
  if (!frontend.exists) {
    return { id: 'pm-components', label: 'pm-* 组件', status: 'warn', evidence: '缺少 frontend/src，未检查' }
  }
  const tags = new Set()
  for (const file of frontend.usageFiles) {
    for (const match of file.text.matchAll(/<\s*(pm-[a-z0-9-]+)/gi)) tags.add(match[1].toLowerCase())
  }
  if (!tags.size) {
    return {
      id: 'pm-components',
      label: 'pm-* 组件',
      status: 'warn',
      evidence: '未发现 pm-* 标签',
      hint: '业务页面应使用宿主提供的 pm-* 组件；不要自造同名组件或重复打包。'
    }
  }
  return {
    id: 'pm-components',
    label: 'pm-* 组件',
    status: 'pass',
    evidence: `${tags.size} 个：${[...tags].slice(0, 8).join('、')}${tags.size > 8 ? '…' : ''}`
  }
}

function formDialogCheck(pages, frontend) {
  const formPages = pages.filter(page => page.needsForm)
  if (!formPages.length) {
    return { id: 'form-dialog', label: '表单弹窗/FormSection', status: 'pass', evidence: '无表单页' }
  }
  if (!frontend.exists) {
    return { id: 'form-dialog', label: '表单弹窗/FormSection', status: 'warn', evidence: '缺少 frontend/src，未检查表单页' }
  }
  const problems = []
  for (const page of formPages) {
    const view = matchView(page, frontend.views)
    if (!view) {
      problems.push(`${page.id}（未找到实现文件）`)
      continue
    }
    if (!/(pm-form-dialog|FormSection|StandardFormPage)/.test(view.text)) {
      problems.push(`${page.id} → ${path.basename(view.rel)} 缺少 pm-form-dialog/FormSection`)
    }
  }
  if (problems.length) {
    return {
      id: 'form-dialog',
      label: '表单弹窗/FormSection',
      status: 'warn',
      evidence: `${problems.length}/${formPages.length} 个表单页待确认：${clipList(problems)}`,
      hint: '新增/编辑默认 pm-form-dialog；独立页面表单用 StandardFormPage/FormSection。'
    }
  }
  return {
    id: 'form-dialog',
    label: '表单弹窗/FormSection',
    status: 'pass',
    evidence: `${formPages.length} 个表单页均使用 pm-form-dialog/FormSection`
  }
}

function autoHeightCheck(pages, frontend) {
  const listPages = pages.filter(page => page.needsList)
  if (!listPages.length) {
    return { id: 'auto-height', label: '列表 v-auto-height', status: 'pass', evidence: '无列表页' }
  }
  if (!frontend.exists) {
    return { id: 'auto-height', label: '列表 v-auto-height', status: 'warn', evidence: '缺少 frontend/src，未检查列表页' }
  }
  const problems = []
  for (const page of listPages) {
    const view = matchView(page, frontend.views)
    if (!view) {
      problems.push(`${page.id}（未找到实现文件）`)
      continue
    }
    if (!/v-auto-height/.test(view.text)) problems.push(`${page.id} → ${path.basename(view.rel)} 缺少 v-auto-height`)
  }
  if (problems.length) {
    return {
      id: 'auto-height',
      label: '列表 v-auto-height',
      status: 'warn',
      evidence: `${problems.length}/${listPages.length} 个列表页待确认：${clipList(problems)}`,
      hint: 'el-table/pm-table 统一使用 v-auto-height，不要固定 height/max-height。'
    }
  }
  return {
    id: 'auto-height',
    label: '列表 v-auto-height',
    status: 'pass',
    evidence: `${listPages.length} 个列表页均使用 v-auto-height`
  }
}

function globalPreferenceCheck(frontend) {
  if (!frontend.exists) {
    return { id: 'global-preference', label: 'GlobalPreference', status: 'warn', evidence: '缺少 frontend/src，未检查' }
  }
  const hit = frontend.usageFiles.find(file => /GlobalPreference/.test(file.text))
  if (!hit) {
    return {
      id: 'global-preference',
      label: 'GlobalPreference',
      status: 'warn',
      evidence: '未发现 GlobalPreference 导入/使用',
      hint: '统一导入 src/preferences/GlobalPreference.js；预设只在页面 computed 合并。'
    }
  }
  return {
    id: 'global-preference',
    label: 'GlobalPreference',
    status: 'pass',
    evidence: `已引用：${hit.rel.replace(/^frontend\/src\//, '')}`
  }
}

function styleImportsCheck(frontend) {
  if (!frontend.exists) {
    return { id: 'style-imports', label: '结构/风格导入', status: 'warn', evidence: '缺少 frontend/src，未检查' }
  }
  const hits = frontend.usageFiles.filter(file =>
    /(structure\.css|shared\.css|styles\/style\.css|visual-style-)/.test(file.text)
  )
  const visual = frontend.usageFiles.some(file => /visual-style-/.test(file.text))
  if (!hits.length) {
    return {
      id: 'style-imports',
      label: '结构/风格导入',
      status: 'warn',
      evidence: '未发现 structure.css/style.css/shared.css 导入或 visual-style-* 使用',
      hint: '把 docs/design/template 的结构/风格接入 frontend（或由宿主提供），保持蓝图视觉基准。'
    }
  }
  return {
    id: 'style-imports',
    label: '结构/风格导入',
    status: 'pass',
    evidence: `命中 ${hits.length} 个文件${visual ? '（含 visual-style-*）' : ''}：${clipList(
      hits.map(file => file.rel.replace(/^frontend\/src\//, '')),
      3
    )}`
  }
}

function uiCheckCheck(appDir) {
  const info = uiCheckStatus(appDir)
  const evidence = `${info.file}: ${info.status === 'filled' ? '已填' : info.status === 'skeleton' ? '已生成未填' : '未生成'}`
  if (info.status === 'missing') {
    return {
      id: 'ui-check',
      label: 'ui-check 对照表',
      status: 'warn',
      evidence,
      hint: '未生成：打开开发视图发送首条开发消息会自动生成骨架；实现前先填。'
    }
  }
  if (info.status === 'skeleton') {
    return {
      id: 'ui-check',
      label: 'ui-check 对照表',
      status: 'warn',
      evidence,
      hint: '已生成未填：先填 docs/design/ui-check.md 的「实现前」表再写代码；未填不阻断。'
    }
  }
  return { id: 'ui-check', label: 'ui-check 对照表', status: 'pass', evidence }
}

function prototypesCheckResult(appDir) {  const info = prototypeInfo(appDir)
  if (info.state === 'missing') {
    return {
      id: 'prototypes',
      label: 'PNG 原型',
      status: 'warn',
      evidence: '未导出',
      hint: 'PNG 未导出不影响静态一致性检查；需要视觉参考时在设计视图导出。'
    }
  }
  if (info.state === 'stale') {
    return {
      id: 'prototypes',
      label: 'PNG 原型',
      status: 'warn',
      evidence: '已过期（designHash 不一致）',
      hint: 'PNG 是模板风格截图（无显式契约的旧设计为线框）；过期时先说明，不要据旧图判断结构差异。可在设计视图重新导出。'
    }
  }
  if (info.state === 'empty') {
    return {
      id: 'prototypes',
      label: 'PNG 原型',
      status: 'warn',
      evidence: 'manifest 无页面',
      hint: 'PNG 未导出不影响静态一致性检查；需要视觉参考时在设计视图导出。'
    }
  }
  return { id: 'prototypes', label: 'PNG 原型', status: 'pass', evidence: `${info.pages} 张未过期` }
}

/** D2 第 14 项：接口设计文档（api-design.md） */
function apiDesignCheck(appDir) {
  const file = path.join(appDir, 'docs', 'design', 'api-design.md')
  if (!exists(file)) {
    return {
      id: 'api-design',
      label: '接口设计',
      status: 'warn',
      evidence: 'docs/design/api-design.md: 未生成',
      hint: '设计视图「接口设计」可生成；按 adw-api-design skill 的固定模板/规范编写。'
    }
  }
  const candidates = [
    path.resolve(__dirname, '../../../adw-api-design/scripts/lib/api-design-core.cjs'),
    path.join(appDir, '.opencode', 'skills', 'adw-api-design', 'scripts', 'lib', 'api-design-core.cjs')
  ]
  let core = null
  for (const candidate of candidates) {
    if (!exists(candidate)) continue
    try {
      core = require(candidate)
      break
    } catch {
      core = null
    }
  }
  if (!core || typeof core.runApiDesignCheckForApp !== 'function') {
    return {
      id: 'api-design',
      label: '接口设计',
      status: 'fail',
      evidence: '缺少 api-design-core.cjs（无法校验接口设计文档）',
      hint: '确认 .opencode/skills/adw-api-design/scripts/lib/api-design-core.cjs 存在（工作台对齐会补）。'
    }
  }
  let result
  try {
    result = core.runApiDesignCheckForApp(appDir)
  } catch (error) {
    return {
      id: 'api-design',
      label: '接口设计',
      status: 'fail',
      evidence: `校验失败：${error instanceof Error ? error.message : String(error)}`,
      hint: '检查 api-design.md 结构与表格；或运行 adw-api-design/scripts/validate-api-design.mjs。'
    }
  }
  if (!result.exists) {
    return {
      id: 'api-design',
      label: '接口设计',
      status: 'warn',
      evidence: 'docs/design/api-design.md: 未生成',
      hint: '设计视图「接口设计」可生成；按 adw-api-design skill 的固定模板/规范编写。'
    }
  }
  if (result.errors.length) {
    return {
      id: 'api-design',
      label: '接口设计',
      status: 'fail',
      evidence: `${result.errors.length} 个错误：${clipList(result.errors.map(error => `${error.path} ${error.message}`), 3)}`,
      hint: '按 errors 修复接口设计文档（缺章节/引用/索引详情一致性/分页等）；errors 清零后再交付。'
    }
  }
  if (result.warnings.length) {
    return {
      id: 'api-design',
      label: '接口设计',
      status: 'warn',
      evidence: `${result.interfaces.length} 个接口 · ${result.byEpic.length} 个 Epic；${result.warnings.length} 个 warning：${clipList(
        result.warnings.map(warning => `${warning.path} ${warning.message}`),
        3
      )}`,
      hint: '补齐页面动作/实体 CRUD 覆盖、权限/错误码/示例；warnings 只报告不阻断。'
    }
  }
  return {
    id: 'api-design',
    label: '接口设计',
    status: 'pass',
    evidence: `${result.interfaces.length} 个接口 · ${result.byEpic.length} 个 Epic；索引/覆盖/引用校验通过`
  }
}

function summarize(checks) {
  const summary = { pass: 0, warn: 0, fail: 0, total: checks.length, status: 'pass' }
  for (const check of checks) {
    if (check.status === 'fail') summary.fail += 1
    else if (check.status === 'warn') summary.warn += 1
    else summary.pass += 1
  }
  summary.status = summary.fail ? 'fail' : summary.warn ? 'warn' : 'pass'
  return summary
}

function designSystemInfo(system) {
  if (!system.exists || !system.data) {
    return { exists: system.exists, valid: false, pack: undefined, applicationType: undefined, style: undefined, pageCount: 0 }
  }
  return {
    exists: true,
    valid: !system.error,
    pack: system.data.pack,
    applicationType: system.data.applicationType,
    style: system.data.style,
    styleName: system.data.styleName,
    pageCount: system.data.pages.length,
    blueprintRoot: system.data.blueprintRoot || 'docs/design/template'
  }
}

/**
 * 运行一致性检查（应用级）。
 * @param {{ appDir: string }} input
 * @returns {object} 固定字段报告（不抛文件缺失错误）
 */
function runFidelityCheck(input) {
  const appDir = path.resolve(String(input?.appDir ?? '.'))
  const generatedAt = new Date().toISOString()
  const system = readDesignSystemFile(appDir)
  const entities = readEntitiesFile(appDir)
  const pagesFile = readPagesFile(appDir)
  const designSystem = designSystemInfo(system)

  if (!entities.exists && !pagesFile.exists) {
    const checks = [designSystemCheck(system, appDir), pageContractCheck(entities, [], pagesFile)]
    const summary = summarize(checks)
    return {
      schemaVersion: 2,
      ok: summary.status !== 'fail',
      empty: true,
      reason: 'no-design',
      generatedAt,
      designSystem,
      checks,
      summary
    }
  }

  const pages = pagesFile.data ? normalizePages(pagesFile.data, system.data, appDir) : []
  const checks = []
  checks.push(designSystemCheck(system, appDir))
  checks.push(
    pageContractCheck(
      entities,
      pages,
      pagesFile
    )
  )
  checks.push(blueprintCheck(pages))

  const frontend = collectFrontend(appDir)
  checks.push(implementationCheck(pages, frontend))
  checks.push(pageTemplatesCheck(frontend))
  checks.push(pmComponentsCheck(frontend))
  checks.push(formDialogCheck(pages, frontend))
  checks.push(autoHeightCheck(pages, frontend))
  checks.push(globalPreferenceCheck(frontend))
  checks.push(styleImportsCheck(frontend))
  checks.push(templateContractCheck(pages))
  checks.push(uiCheckCheck(appDir))
  checks.push(prototypesCheckResult(appDir))
  checks.push(apiDesignCheck(appDir))

  const summary = summarize(checks)
  return {
    schemaVersion: 2,
    ok: summary.status !== 'fail',
    empty: false,
    generatedAt,
    designSystem,
    checks,
    summary
  }
}

module.exports = {
  PAGE_TEMPLATE_NAMES,
  designHashOf,
  runFidelityCheck
}
