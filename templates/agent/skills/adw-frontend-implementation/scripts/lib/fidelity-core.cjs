/**
 * 设计一致性静态检查核心（P7-6a）
 *
 * 同一份规则同时供：
 * - `scripts/check-fidelity.mjs`（应用内/仓库内 CLI，无外部依赖）；
 * - 后端 `POST /api/apps/:id/design-fidelity`（require 本文件）。
 *
 * 只读工作区文件，不执行代码、不写文件、不做截图比对；缺失文件降级为 warn/fail，
 * 不因文件缺失抛错。输出字段固定：id/label/status/evidence(+hint)。
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')

const MODULE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,64}$/
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

function listDesignModules(appDir) {
  const dir = path.join(appDir, 'docs', 'design')
  if (!exists(dir)) return []
  let entries = []
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter(entry => entry.isDirectory() && MODULE_ID_PATTERN.test(entry.name))
    .filter(entry => exists(path.join(dir, entry.name, 'design.json')))
    .map(entry => entry.name)
    .sort()
}

function readDesignFile(appDir, moduleKey) {
  return readJson(path.join(appDir, 'docs', 'design', moduleKey, 'design.json'))
}

/**
 * 蓝图路径解析：
 * - design.json 可能写 pack 相对路径（application-types/<type>/pages/X.vue）；
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

function normalizePages(design, system, appDir) {
  const systemById = new Map((system?.pages ?? []).map(entry => [entry.id, entry]))
  return asArray(design?.pages)
    .map(item => asRecord(item))
    .filter(Boolean)
    .map(item => {
      const catalogId = pageCatalogId(text(item.catalogRef))
      const fromSystem = systemById.get(catalogId) || systemById.get(text(item.id))
      const kind = fromSystem?.kind === 'contract' ? 'contract' : fromSystem?.kind === 'reference' ? 'reference' : 'blueprint'
      const contractFile = kind === 'contract' ? text(fromSystem?.contractFile) : ''
      const contractExists = Boolean(contractFile) && exists(path.join(appDir, contractFile))
      const resolved = kind === 'contract' ? { file: '', exists: false } : resolveBlueprint(appDir, item, system)
      const recipe = text(item.recipe)
      const type = text(item.type)
      return {
        id: text(item.id) || 'page',
        name: text(item.name) || text(item.id) || 'page',
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
      }
    })
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
  // 使用情况检查：排除模板组件本身、占位入口与 GlobalPreference 定义，避免自证
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

/** 启发式：按蓝图文件名/页面 id/中文名在视图文件里找最可能的实现 */
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

function uiCheckStatus(appDir, moduleKey) {
  const relative = `docs/design/${moduleKey}/ui-check.md`
  const file = path.join(appDir, relative)
  if (!exists(file)) return { status: 'missing', file: relative }
  try {
    const content = fs.readFileSync(file, 'utf8')
    const marker = SKELETON_MARKER.exec(content)
    if (!marker) return { status: 'filled', file: relative }
    const expected = (marker[0].match(/hash:([a-f0-9]{64})/) || [])[1] || ''
    const actual = sha256Text(content.replace(SKELETON_MARKER, ''))
    return { status: actual === expected ? 'skeleton' : 'filled', file: relative }
  } catch {
    return { status: 'skeleton', file: relative }
  }
}

function prototypeInfo(appDir, moduleKey) {
  const designFile = path.join(appDir, 'docs', 'design', moduleKey, 'design.json')
  const manifestFile = path.join(appDir, 'docs', 'design', moduleKey, 'prototypes', '_manifest.json')
  const manifest = readJson(manifestFile)
  if (!manifest || !asRecord(manifest)) return { module: moduleKey, state: 'missing', pages: 0 }
  const pages = manifest.pages && typeof manifest.pages === 'object' ? Object.keys(manifest.pages).length : 0
  const designHash = text(manifest.designHash)
  let currentHash = ''
  try {
    currentHash = sha256Buffer(fs.readFileSync(designFile))
  } catch {
    currentHash = ''
  }
  const stale = Boolean(designHash) && Boolean(currentHash) && designHash !== currentHash
  return { module: moduleKey, state: stale ? 'stale' : pages ? 'fresh' : 'empty', pages }
}

/**
 * 风格样式文件：新应用 `docs/design/template/styles/<styleId>/style.css`；
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
      evidence: `缺少 ${system.file}（旧应用或尚未选择设计模板）`,
      hint: '新建应用会自动生成；旧应用可在设计视图改选设计模板后由工作台对齐。'
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
      evidence: `${system.file} 声明的风格样式不存在：${style.missing}（旧路径 docs/design/template/styles/style.css 也不存在）`,
      hint: '新应用应为 docs/design/template/styles/<styleId>/style.css；旧应用保留 styles/style.css 也可通过，不迁移。'
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

function pageContractCheck(modules, pages, moduleKey) {
  if (!modules.length) {
    return {
      id: 'page-contract',
      label: '页面契约',
      status: moduleKey ? 'fail' : 'warn',
      evidence: moduleKey
        ? `未找到 docs/design/${moduleKey}/design.json`
        : 'docs/design/ 下没有模块设计（design.json）',
      hint: '先在设计视图生成页面契约，再实现页面。'
    }
  }
  if (!pages.length) {
    return {
      id: 'page-contract',
      label: '页面契约',
      status: 'fail',
      evidence: `${modules.join('、')} 的 design.json 未定义 pages`,
      hint: '补充 pages[]（id/name/type/recipe/blueprint 等）。'
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
      hint: '检查 design-system.json 的 templateDir/blueprint 与 design.json 的 blueprint 路径。'
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

/** P7-7c 第 13 项：模板契约页（只报告） */
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
      problems.push(`${page.id} recipe 不一致（design.json ${page.recipe} / 模板 ${page.systemRecipe}）`)
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

function uiCheckCheck(appDir, modules) {
  const statuses = modules.map(moduleKey => ({ moduleKey, ...uiCheckStatus(appDir, moduleKey) }))
  const missing = statuses.filter(item => item.status === 'missing')
  const skeleton = statuses.filter(item => item.status === 'skeleton')
  const evidence = statuses
    .map(item => `${item.moduleKey}: ${item.status === 'filled' ? '已填' : item.status === 'skeleton' ? '已生成未填' : '未生成'}`)
    .join('；')
  if (missing.length || skeleton.length) {
    const missingHint = '未生成：打开开发视图选择模块并发送首条开发消息会自动生成骨架；实现前先填。'
    const skeletonHint = '已生成未填：先填 docs/design/<MOD>/ui-check.md 的「实现前」表再写代码；未填不阻断。'
    const hint =
      missing.length && skeleton.length
        ? `${missingHint}${skeletonHint}`
        : missing.length
          ? missingHint
          : skeletonHint
    return {
      id: 'ui-check',
      label: 'ui-check 对照表',
      status: 'warn',
      evidence,
      hint
    }
  }
  return { id: 'ui-check', label: 'ui-check 对照表', status: 'pass', evidence }
}

function prototypesCheck(appDir, modules) {
  if (!modules.length) {
    return { id: 'prototypes', label: 'PNG 原型', status: 'warn', evidence: '无模块设计，未检查 PNG' }
  }
  const items = modules.map(moduleKey => prototypeInfo(appDir, moduleKey))
  const missing = items.filter(item => item.state === 'missing')
  const stale = items.filter(item => item.state === 'stale')
  const empty = items.filter(item => item.state === 'empty')
  const evidence = items
    .map(item => {
      if (item.state === 'missing') return `${item.module}: 未导出`
      if (item.state === 'stale') return `${item.module}: 已过期（designHash 不一致）`
      if (item.state === 'empty') return `${item.module}: manifest 无页面`
      return `${item.module}: ${item.pages} 张未过期`
    })
    .join('；')
  if (stale.length) {
    return {
      id: 'prototypes',
      label: 'PNG 原型',
      status: 'warn',
      evidence,
      hint: 'PNG 是模板风格截图（无显式契约的旧设计为线框）；过期时先说明，不要据旧图判断结构差异。可在设计视图重新导出。'
    }
  }
  if (missing.length || empty.length) {
    return {
      id: 'prototypes',
      label: 'PNG 原型',
      status: 'warn',
      evidence,
      hint: 'PNG 未导出不影响静态一致性检查；需要视觉参考时在设计视图导出。'
    }
  }
  return { id: 'prototypes', label: 'PNG 原型', status: 'pass', evidence }
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
 * 运行一致性检查。
 * @param {{ appDir: string, module?: string }} input
 * @returns {object} 固定字段报告（不抛文件缺失错误）
 */
function runFidelityCheck(input) {
  const appDir = path.resolve(String(input?.appDir ?? '.'))
  const moduleInput = text(input?.module)
  const moduleKey = moduleInput && MODULE_ID_PATTERN.test(moduleInput) ? moduleInput : ''
  const generatedAt = new Date().toISOString()
  const system = readDesignSystemFile(appDir)
  const allModules = listDesignModules(appDir)
  const modules = moduleKey ? allModules.filter(item => item === moduleKey) : allModules
  const checks = []
  const designSystem = designSystemInfo(system)

  if (!modules.length) {
    checks.push(designSystemCheck(system, appDir))
    checks.push(pageContractCheck([], [], moduleKey))
    const summary = summarize(checks)
    return {
      schemaVersion: 1,
      ok: summary.status !== 'fail',
      empty: true,
      reason: moduleKey ? 'design-missing' : 'no-design',
      generatedAt,
      module: moduleKey || null,
      modules: [],
      designSystem,
      checks,
      summary
    }
  }

  const pages = []
  const invalidDesigns = []
  for (const item of modules) {
    const design = readDesignFile(appDir, item)
    if (!design || !asRecord(design)) {
      invalidDesigns.push(item)
      continue
    }
    pages.push(...normalizePages(design, system.data, appDir))
  }

  checks.push(designSystemCheck(system, appDir))
  checks.push(
    invalidDesigns.length
      ? {
          id: 'page-contract',
          label: '页面契约',
          status: 'fail',
          evidence: `${invalidDesigns.join('、')} 的 design.json 无法解析`,
          hint: '运行 adw-design-artifacts/scripts/validate.mjs 查看字段错误。'
        }
      : pageContractCheck(modules, pages, moduleKey)
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
  checks.push(uiCheckCheck(appDir, modules))
  checks.push(prototypesCheck(appDir, modules))

  const summary = summarize(checks)
  return {
    schemaVersion: 1,
    ok: summary.status !== 'fail',
    empty: false,
    generatedAt,
    module: moduleKey || null,
    modules,
    designSystem,
    checks,
    summary
  }
}

module.exports = {
  MODULE_ID_PATTERN,
  PAGE_TEMPLATE_NAMES,
  runFidelityCheck
}
