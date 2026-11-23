/**
 * P7-7a spec → pack 生成器（纯 CommonJS，无外部依赖）
 *
 * 输入：raw spec + 内置 pack + 内置 pack 根目录 + 暂存目录
 * 输出：暂存目录内的完整 pack（pack.json / structure.css / pages / assets / styles）+ JSON 报告
 *
 * 约束（设计稿 §8）：
 * - 只写暂存目录；不写最终目录、不写时间戳（pack.json 字节可复现）；
 * - 任何 error：删除暂存目录，不产生半成品；
 * - reference 页复制内置蓝图**字节**并记录 sha256（快照语义）；
 * - contract 页不写 .vue（契约内联在 pack.json）；
 * - 权威校验不在这里（由后端 `pack.ts#validatePackDir` 负责）。
 */

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const specCore = require('./spec.cjs')
const { mergeStructureCss } = require('./css.cjs')

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
}

function typeOfPack(builtin, id) {
  return asArray(builtin && builtin.applicationTypes).find(type => type && type.id === id) || null
}

function pageOfPack(builtin, applicationTypeId, pageId) {
  const type = typeOfPack(builtin, applicationTypeId)
  if (!type) return null
  return asArray(type.pages).find(page => page && page.id === pageId) || null
}

function styleOfPack(builtin, id) {
  return asArray(builtin && builtin.styles).find(style => style && style.id === id) || null
}

/** 蓝图里的相对资产引用（`from '../assets/x.svg'` / `src="../assets/x.png"`） */
function blueprintAssetRefs(source) {
  const found = []
  const pattern = /(?:from\s+|src\s*=\s*)['"]\.\.\/assets\/([^'"]+)['"]/g
  let match = pattern.exec(source)
  while (match) {
    const name = text(match[1])
    if (name && !found.includes(name)) found.push(name)
    match = pattern.exec(source)
  }
  return found
}

function contractComponents(contract, pageRecipes, recipe) {
  const components = []
  const push = value => {
    const name = text(value)
    if (name && !components.includes(name)) components.push(name)
  }
  if (isRecord(contract.components)) {
    for (const value of Object.values(contract.components)) push(value)
  }
  for (const value of asArray(pageRecipes && pageRecipes[recipe])) push(value)
  return components
}

function packPageOrder(page) {
  const ordered = {
    id: page.id,
    name: page.name,
    type: page.type,
    recipe: page.recipe,
    preview: page.preview,
    description: page.description,
    kind: page.kind
  }
  if (page.kind === 'reference') {
    ordered.blueprint = page.blueprint
    ordered.source = page.source
  } else {
    ordered.contract = page.contract
    if (page.sampleEntity) ordered.sampleEntity = page.sampleEntity
    if (page.sampleSubEntities) ordered.sampleSubEntities = page.sampleSubEntities
  }
  ordered.components = page.components
  if (page.blocks !== undefined) ordered.blocks = page.blocks
  return ordered
}

/**
 * 生成 pack 到暂存目录。
 *
 * @param {{
 *   spec: unknown, builtin: Record<string, unknown>, builtinRoot: string, targetDir: string,
 *   packId?: string, reservedIds?: string[], knownComponents?: string[],
 *   publishedRevision?: number
 * }} input
 */
function generatePack(input) {
  const options = input || {}
  const targetDir = options.targetDir
  if (!text(targetDir)) {
    return {
      ok: false,
      errors: [{ code: 'spec-invalid', path: '$', message: '缺少生成暂存目录（targetDir）' }],
      warnings: []
    }
  }
  const builtinRoot = options.builtinRoot
  if (!text(builtinRoot) || !fs.existsSync(builtinRoot)) {
    return {
      ok: false,
      errors: [{ code: 'spec-invalid', path: '$', message: '内置设计模板包目录不存在' }],
      warnings: []
    }
  }
  const builtin = options.builtin
  const normalized = specCore.normalizeSpec(options.spec, {
    packId: options.packId,
    builtin,
    reservedIds: options.reservedIds,
    knownComponents: options.knownComponents
  })
  const warnings = [...normalized.warnings]
  if (!normalized.ok || !normalized.spec) {
    return { ok: false, errors: normalized.errors, warnings, spec: null }
  }
  const spec = normalized.spec
  const packId = spec.id
  const errors = []

  const cleanup = () => {
    try {
      fs.rmSync(targetDir, { recursive: true, force: true })
    } catch {
      // 清理失败不覆盖原始错误
    }
  }

  try {
    fs.mkdirSync(targetDir, { recursive: true })
    const typeRoot = path.join(targetDir, 'application-types', packId)
    const pagesRoot = path.join(typeRoot, 'pages')
    const assetsRoot = path.join(typeRoot, 'assets')
    fs.mkdirSync(pagesRoot, { recursive: true })

    // 1) 来源类型顺序（reference 首次出现顺序 + baseApplicationType）
    const sourceTypes = []
    const pushType = type => {
      const id = text(type)
      if (id && !sourceTypes.includes(id)) sourceTypes.push(id)
    }
    for (const page of spec.pages) {
      if (page.kind === 'reference' && page.source) pushType(page.source.applicationType)
    }
    pushType(spec.baseApplicationType)

    // 2) structure.css 合并
    const cssSources = []
    for (const type of sourceTypes) {
      const typeMeta = typeOfPack(builtin, type)
      if (!typeMeta) {
        errors.push({ code: 'base-type-missing', path: 'baseApplicationType', message: `应用类型不存在：${type}` })
        continue
      }
      const file = path.join(builtinRoot, String(typeMeta.structure))
      if (!fs.existsSync(file)) {
        warnings.push({ code: 'css-invalid', path: typeMeta.structure, message: `结构样式缺失，已跳过：${type}` })
        continue
      }
      cssSources.push({ type, css: fs.readFileSync(file, 'utf8') })
    }
    const merged = mergeStructureCss(cssSources)
    warnings.push(...merged.warnings)
    writeFile(path.join(typeRoot, 'structure.css'), merged.css)

    // 3) styles（shared + 选中风格）
    const sharedFile = path.join(builtinRoot, 'styles', 'shared.css')
    if (fs.existsSync(sharedFile)) copyFile(sharedFile, path.join(targetDir, 'styles', 'shared.css'))
    const style = styleOfPack(builtin, spec.style)
    if (!style) {
      errors.push({ code: 'style-missing', path: 'style', message: `视觉风格不存在：${spec.style}` })
    } else {
      const styleFile = path.join(builtinRoot, String(style.css))
      if (!fs.existsSync(styleFile)) {
        errors.push({ code: 'style-missing', path: 'style', message: `风格样式文件不存在：${style.css}` })
      } else {
        copyFile(styleFile, path.join(targetDir, String(style.css)))
      }
    }

    // 4) 资产（来源类型 assets 并集 + 蓝图相对 import）
    const copiedAssets = new Map() // basename -> sha256
    const copyAsset = (type, relative, required) => {
      const rel = text(relative).replace(/\\/g, '/')
      if (!rel) return
      const name = path.posix.basename(rel)
      const candidates = [path.join(builtinRoot, rel), path.join(builtinRoot, 'application-types', type, 'assets', name)]
      const from = candidates.find(file => fs.existsSync(file) && fs.statSync(file).isFile())
      if (!from) {
        if (required) {
          warnings.push({
            code: 'asset-import-missing',
            path: `${type}/${rel}`,
            message: `蓝图引用的资产不存在（仍复制其余资产）：${rel}`
          })
        }
        return
      }
      const buffer = fs.readFileSync(from)
      const digest = sha256(buffer)
      const previous = copiedAssets.get(name)
      if (previous !== undefined) {
        if (previous !== digest) {
          errors.push({
            code: 'asset-collision',
            path: `application-types/${packId}/assets/${name}`,
            message: `不同来源类型的同名资产内容不同：${name}（${type}）；请重命名或调整来源顺序`
          })
        }
        return
      }
      copiedAssets.set(name, digest)
      writeFile(path.join(assetsRoot, name), buffer)
    }
    for (const type of sourceTypes) {
      const typeMeta = typeOfPack(builtin, type)
      for (const asset of asArray(typeMeta && typeMeta.assets)) copyAsset(type, asset, false)
    }

    // 5) 页面
    const pages = []
    for (const page of spec.pages) {
      if (page.kind === 'reference') {
        const sourcePage = pageOfPack(builtin, page.source.applicationType, page.source.pageId)
        if (!sourcePage) {
          errors.push({
            code: 'source-page-missing',
            path: `pages.${page.id}.source`,
            message: `来源页面不存在：${page.source.applicationType}/${page.source.pageId}`
          })
          continue
        }
        const sourceFile = path.join(builtinRoot, String(sourcePage.blueprint))
        if (!fs.existsSync(sourceFile)) {
          errors.push({
            code: 'source-page-missing',
            path: `pages.${page.id}.source`,
            message: `来源蓝图文件不存在：${sourcePage.blueprint}`
          })
          continue
        }
        const buffer = fs.readFileSync(sourceFile)
        const blueprint = `application-types/${packId}/pages/${page.id}.vue`
        writeFile(path.join(targetDir, blueprint), buffer)
        for (const name of blueprintAssetRefs(buffer.toString('utf8'))) {
          copyAsset(page.source.applicationType, `application-types/${page.source.applicationType}/assets/${name}`, true)
        }
        pages.push(
          packPageOrder({
            id: page.id,
            name: page.name,
            type: page.type,
            recipe: page.recipe,
            preview: page.preview,
            description: page.description || text(sourcePage.description) || `${page.name}（引用页面）`,
            kind: 'reference',
            blueprint,
            source: {
              pack: text(page.source.pack),
              applicationType: text(page.source.applicationType),
              pageId: text(page.source.pageId),
              blueprint: text(sourcePage.blueprint),
              sha256: sha256(buffer)
            },
            components: asArray(sourcePage.components).map(String),
            blocks: Number.isInteger(sourcePage.blocks) ? sourcePage.blocks : undefined
          })
        )
      } else {
        pages.push(
          packPageOrder({
            id: page.id,
            name: page.name,
            type: page.type,
            recipe: page.recipe,
            preview: page.preview,
            description: page.description || `${page.name}（按页面契约实现）`,
            kind: 'contract',
            contract: page.contract || {},
            sampleEntity: page.sampleEntity,
            sampleSubEntities: page.sampleSubEntities,
            components: contractComponents(page.contract, builtin.pageRecipes, page.recipe),
            blocks: 0
          })
        )
      }
    }

    if (errors.length) {
      cleanup()
      return { ok: false, errors, warnings, spec: normalized.spec }
    }

    // 6) pack.json（固定键顺序；生成阶段不写时间戳）
    const publishedRevision = Number.isInteger(options.publishedRevision) && options.publishedRevision > 0
      ? options.publishedRevision
      : 0
    const version = publishedRevision > 0 ? `1.0.${publishedRevision}` : '1.0.0'
    const pack = {
      schemaVersion: 1,
      id: packId,
      name: spec.name,
      version,
      defaultApplicationType: packId,
      defaultStyle: spec.style,
      origin: {
        kind: 'custom',
        draftId: packId,
        builtFrom: { pack: text(builtin.id), version: text(builtin.version) },
        baseApplicationType: spec.baseApplicationType,
        style: spec.style,
        revision: publishedRevision,
        specHash: normalized.specHash
      },
      applicationTypes: [
        {
          id: packId,
          name: spec.name,
          category: 'custom',
          description: spec.description || `${spec.name}（自定义设计模板）`,
          structure: `application-types/${packId}/structure.css`,
          ...(copiedAssets.size ? { assets: [...copiedAssets.keys()].map(name => `application-types/${packId}/assets/${name}`) } : {}),
          defaultStyle: spec.style,
          pages
        }
      ],
      styles: [
        {
          id: style.id,
          name: style.name,
          className: style.className,
          css: style.css,
          description: style.description,
          signature: style.signature,
          tokens: style.tokens
        }
      ],
      skills: asArray(builtin.skills).map(String),
      componentMap: builtin.componentMap || {},
      pageRecipes: builtin.pageRecipes || {},
      conformance: asArray(builtin.conformance).map(String)
    }
    writeFile(path.join(targetDir, 'pack.json'), `${JSON.stringify(pack, null, 2)}\n`)

    return {
      ok: true,
      spec,
      specHash: normalized.specHash,
      pack: {
        id: packId,
        name: spec.name,
        version,
        revision: publishedRevision,
        pageCount: pages.length
      },
      pages: pages.map(page => ({
        id: page.id,
        name: page.name,
        kind: page.kind,
        recipe: page.recipe,
        ...(page.kind === 'reference' ? { source: `${page.source.applicationType}/${page.source.pageId}`, blueprint: page.blueprint } : {})
      })),
      css: {
        sources: merged.sources,
        totalRules: merged.totalRules,
        rules: merged.rules,
        deduped: merged.deduped,
        atRules: merged.atRules,
        conflicts: merged.conflicts.map(item => item.selector),
        conflictDetails: merged.conflicts
      },
      assets: [...copiedAssets.keys()],
      warnings,
      errors: []
    }
  } catch (error) {
    cleanup()
    return {
      ok: false,
      errors: [
        {
          code: 'generate-failed',
          path: '$',
          message: `生成失败：${error instanceof Error ? error.message : String(error)}`
        }
      ],
      warnings
    }
  }
}

module.exports = {
  generatePack,
  blueprintAssetRefs,
  contractComponents
}
