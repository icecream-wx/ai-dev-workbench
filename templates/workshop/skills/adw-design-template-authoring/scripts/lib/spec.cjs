/**
 * P7-7a 设计模板 spec 解析 / 规范化 / 校验（纯 CommonJS，无外部依赖）
 *
 * 输入：agent 写出的 `drafts/<packId>/spec.json`（见设计稿 §5.8）
 * 输出：`{ ok, spec, errors, warnings }`
 *
 * - spec 是唯一写入口；`blueprint` 不允许出现在 spec 的 pages 中；
 * - 自定义 pack 的页面只允许 `reference` / `contract` 两种 kind；
 * - `reference` 只能引用内置 pack（本文件通过 options.builtin 解析）；
 * - 列/查询/表单字段不在 sampleEntity 时只 warning（与 P7-4a 口径一致）；
 * - 规范化后的 spec 用于生成 pack 与 specHash（同 spec 重跑字节一致）。
 *
 * 错误/警告码见设计稿 §8.2 / 附录 G。
 */

const crypto = require('node:crypto')

const PACK_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/
const PAGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/
const RESERVED_PACK_IDS = Object.freeze(['_workshop', '_draft', 'assets', 'styles', 'application-types'])

/** 内置 pack 的 8 个页面配方 */
const RECIPES = Object.freeze([
  'list',
  'tree-list',
  'dialog-form',
  'page-form',
  'main-sub',
  'detail',
  'dashboard',
  'wizard'
])

/** design.json 允许的页面类型（contract 页的 type 必须在此范围内） */
const PAGE_TYPES = Object.freeze(['list', 'form', 'detail', 'dashboard', 'kanban', 'gantt', 'calendar'])

/** 实体字段类型（entities.schema.json） */
const FIELD_TYPES = Object.freeze(['string', 'text', 'number', 'decimal', 'date', 'datetime', 'time', 'boolean', 'enum', 'ref'])

const SPEC_KEYS = Object.freeze([
  'schemaVersion',
  'id',
  'name',
  'description',
  'baseApplicationType',
  'style',
  'pages'
])

const PAGE_KEYS = Object.freeze([
  'id',
  'name',
  'kind',
  'type',
  'recipe',
  'description',
  'preview',
  'source',
  'contract',
  'sampleEntity',
  'sampleSubEntities'
])

const RECIPE_PREVIEW = Object.freeze({
  list: 'list',
  'tree-list': 'tree',
  'page-form': 'form',
  'dialog-form': 'form',
  'main-sub': 'form',
  wizard: 'form',
  detail: 'detail',
  dashboard: 'dashboard'
})

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function error(code, path, message) {
  return { code, path, message }
}

function warning(code, path, message) {
  return { code, path, message }
}

/** 稳定序列化（键字典序 + 2 空格）；用于 specHash 与确定性字节 */
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item)).join(',')}]`
  if (isRecord(value)) {
    const keys = Object.keys(value).sort()
    return `{${keys.map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value === undefined ? null : value)
}

/** sha256 规范化 spec 哈希（`sha256:<hex>`） */
function specHash(spec) {
  const digest = crypto.createHash('sha256').update(canonicalJson(spec), 'utf8').digest('hex')
  return `sha256:${digest}`
}

/** 名称 → pack id 片段：只保留 ASCII 字母/数字/短横线并转小写 */
function slugifyPackId(name) {
  return text(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 60)
}

function isValidPackId(value) {
  const id = text(value)
  if (!PACK_ID_PATTERN.test(id)) return false
  return !RESERVED_PACK_IDS.includes(id)
}

function isValidPageId(value) {
  return PAGE_ID_PATTERN.test(text(value))
}

/** 配方 → pack 页面 preview 展示值 */
function previewForRecipe(recipe) {
  return RECIPE_PREVIEW[text(recipe)] || 'list'
}

/** 页面类型 → 缺省配方 */
function recipeForType(type, contract) {
  switch (text(type)) {
    case 'form':
      return contract && isRecord(contract.form) && text(contract.form.presentation) === 'dialog'
        ? 'dialog-form'
        : 'page-form'
    case 'list':
      return 'list'
    case 'dashboard':
      return 'dashboard'
    case 'detail':
    default:
      return 'detail'
  }
}

/** 配方 → 缺省页面类型 */
function typeForRecipe(recipe) {
  switch (text(recipe)) {
    case 'list':
    case 'tree-list':
      return 'list'
    case 'page-form':
    case 'dialog-form':
    case 'main-sub':
    case 'wizard':
      return 'form'
    case 'dashboard':
      return 'dashboard'
    case 'detail':
    default:
      return 'detail'
  }
}

function builtinTypeById(builtin, id) {
  return asArray(builtin && builtin.applicationTypes).find(type => type && type.id === id) || null
}

function builtinPage(builtin, applicationType, pageId) {
  const type = builtinTypeById(builtin, applicationType)
  if (!type) return null
  return asArray(type.pages).find(page => page && page.id === pageId) || null
}

function builtinStyleById(builtin, id) {
  return asArray(builtin && builtin.styles).find(style => style && style.id === id) || null
}

/** 只保留实体字段的已知键，保证生成字节稳定 */
function normalizeField(raw, path, errors) {
  if (!isRecord(raw)) {
    errors.push(error('spec-invalid', path, '实体字段必须是对象'))
    return null
  }
  const name = text(raw.name)
  if (!name) {
    errors.push(error('spec-invalid', `${path}.name`, '实体字段 name 不能为空'))
    return null
  }
  const field = { name }
  const label = text(raw.label)
  if (label) field.label = label
  const type = text(raw.type) || 'string'
  if (!FIELD_TYPES.includes(type)) {
    errors.push(error('spec-invalid', `${path}.type`, `字段类型「${type}」不在支持范围（${FIELD_TYPES.join('/')}）`))
    return null
  }
  field.type = type
  if (typeof raw.required === 'boolean') field.required = raw.required
  if (typeof raw.unique === 'boolean') field.unique = raw.unique
  if (raw.options !== undefined) {
    if (!Array.isArray(raw.options) || raw.options.some(item => typeof item !== 'string')) {
      errors.push(error('spec-invalid', `${path}.options`, 'options 必须是字符串数组'))
    } else if (raw.options.length) {
      field.options = raw.options.map(item => item.trim()).filter(Boolean)
    }
  }
  const ref = text(raw.ref)
  if (ref) field.ref = ref
  const note = text(raw.note)
  if (note) field.note = note
  return field
}

function normalizeEntity(raw, path, errors, code = 'sample-entity-missing') {
  if (!isRecord(raw)) {
    errors.push(error(code, path, '实体必须是对象'))
    return null
  }
  const id = text(raw.id)
  if (!id) {
    errors.push(error(code, `${path}.id`, '实体 id 不能为空'))
    return null
  }
  const name = text(raw.name)
  if (!name) {
    errors.push(error(code, `${path}.name`, '实体 name 不能为空'))
    return null
  }
  const rawFields = asArray(raw.fields)
  if (!rawFields.length) {
    errors.push(error(code, `${path}.fields`, '实体至少需要 1 个字段'))
    return null
  }
  const fields = []
  const seen = new Set()
  for (const [index, rawField] of rawFields.entries()) {
    const field = normalizeField(rawField, `${path}.fields[${index}]`, errors)
    if (!field) continue
    if (seen.has(field.name)) {
      errors.push(error(code, `${path}.fields[${index}].name`, `字段名重复：${field.name}`))
      continue
    }
    seen.add(field.name)
    fields.push(field)
  }
  if (!fields.length) {
    errors.push(error(code, `${path}.fields`, '实体至少需要 1 个有效字段'))
    return null
  }
  return { id, name, fields }
}

function entityFieldNames(entity) {
  return new Set(asArray(entity && entity.fields).map(field => field && field.name).filter(Boolean))
}

/** contract 内引用的字段（用于 page-field-unknown 软校验） */
function contractFieldRefs(contract) {
  const refs = []
  const push = (names, path) => {
    for (const [index, name] of asArray(names).entries()) {
      if (typeof name === 'string' && name.trim()) refs.push({ name: name.trim(), path: `${path}[${index}]` })
    }
  }
  push(contract.filters, 'filters')
  push(contract.columns, 'columns')
  if (isRecord(contract.form)) push(contract.form.fields, 'form.fields')
  for (const [index, group] of asArray(contract.form && contract.form.groups).entries()) {
    push(group && group.fields, `form.groups[${index}].fields`)
  }
  return refs
}

/** 校验 contract 的字段/子表/树（warning，不阻断） */
function contractWarnings(contract, page, pagePath, entityPool) {
  const warnings = []
  const mainEntity = page.sampleEntity
  const fieldNames = entityFieldNames(mainEntity)
  for (const ref of contractFieldRefs(contract)) {
    if (!fieldNames.has(ref.name)) {
      warnings.push(
        warning(
          'page-field-unknown',
          `${pagePath}.contract.${ref.path}`,
          `字段「${ref.name}」不在 sampleEntity.fields（预览会跳过）`
        )
      )
    }
  }
  const pool = new Map(entityPool.map(entity => [entity.id, entity]))
  for (const [index, item] of asArray(contract.subTables).entries()) {
    const target = text(item && (item.entity || item.target))
    if (!target || !pool.has(target)) {
      warnings.push(
        warning(
          'sample-sub-entity-missing',
          `${pagePath}.contract.subTables[${index}].${text(item && item.entity) ? 'entity' : 'target'}`,
          `子表实体「${target || '未指定'}」不在 sampleEntity + sampleSubEntities 池（预览会跳过该子表）`
        )
      )
      continue
    }
    const targetNames = entityFieldNames(pool.get(target))
    for (const [columnIndex, name] of asArray(item && item.columns).entries()) {
      const column = text(name)
      if (!column || targetNames.has(column)) continue
      warnings.push(
        warning(
          'page-field-unknown',
          `${pagePath}.contract.subTables[${index}].columns[${columnIndex}]`,
          `字段「${column}」不在子实体 ${target}.fields（预览会跳过）`
        )
      )
    }
  }
  if (text(page.recipe) === 'tree-list') {
    const tree = isRecord(contract.tree) ? contract.tree : null
    const parentField = text(tree && tree.parentField)
    const titleField = text(tree && tree.titleField)
    if (!parentField) {
      warnings.push(
        warning('tree-parent-missing', `${pagePath}.contract.tree.parentField`, '未配置 tree.parentField，树面板会按 titleField 去重扁平展示')
      )
    } else if (!fieldNames.has(parentField)) {
      warnings.push(
        warning('tree-parent-missing', `${pagePath}.contract.tree.parentField`, `parentField「${parentField}」不在 sampleEntity.fields，树面板会扁平展示`)
      )
    }
    if (titleField && !fieldNames.has(titleField)) {
      warnings.push(
        warning('page-field-unknown', `${pagePath}.contract.tree.titleField`, `字段「${titleField}」不在 sampleEntity.fields（树面板无节点）`)
      )
    }
  }
  return warnings
}

/** 组件清单软校验（catalog 组件并集） */
function componentWarnings(contract, knownComponents, pagePath) {
  if (!Array.isArray(knownComponents) || !knownComponents.length) return []
  const known = new Set(knownComponents)
  const warnings = []
  if (isRecord(contract.components)) {
    for (const [fieldName, component] of Object.entries(contract.components)) {
      const name = text(component)
      if (!name || known.has(name)) continue
      warnings.push(
        warning(
          'component-unknown',
          `${pagePath}.contract.components.${fieldName}`,
          `组件「${name}」不在 catalog 组件清单（保留原值，预览按未知组件兜底）`
        )
      )
    }
  }
  return warnings
}

/**
 * 解析/规范化 spec。
 *
 * @param {unknown} raw
 * @param {{ packId?: string, builtin: Record<string, unknown>, reservedIds?: string[],
 *           knownComponents?: string[] }} options
 * @returns {{ ok: boolean, spec: Record<string, unknown> | null, errors: object[], warnings: object[], specHash?: string }}
 */
function normalizeSpec(raw, options = {}) {
  const errors = []
  const warnings = []
  const builtin = options.builtin
  if (!isRecord(raw)) {
    errors.push(error('spec-invalid', '$', 'spec.json 必须是 JSON 对象'))
    return { ok: false, spec: null, errors, warnings }
  }
  if (!isRecord(builtin) || !asArray(builtin.applicationTypes).length || !asArray(builtin.styles).length) {
    errors.push(error('spec-invalid', '$', '缺少内置设计模板包（生成器需要内置 pack 作为引用来源）'))
    return { ok: false, spec: null, errors, warnings }
  }

  for (const key of Object.keys(raw)) {
    if (!SPEC_KEYS.includes(key)) errors.push(error('spec-invalid', key, `未知的 spec 字段：${key}`))
  }
  if (Number(raw.schemaVersion) !== 1) errors.push(error('spec-version', 'schemaVersion', 'schemaVersion 必须为 1'))

  const name = text(raw.name)
  if (!name) errors.push(error('spec-invalid', 'name', 'name 必填'))
  else if (name.length > 100) errors.push(error('spec-invalid', 'name', 'name 过长（最多 100 字符）'))
  const description = text(raw.description)
  if (description.length > 500) errors.push(error('spec-invalid', 'description', 'description 过长（最多 500 字符）'))

  // pack id：spec.id 缺省由草稿 id（= packId）或 name slug 化；不可与内置/保留/其它模板冲突
  const builtinIds = asArray(builtin.applicationTypes).map(type => text(type && type.id))
  const reserved = [...RESERVED_PACK_IDS, ...builtinIds, ...asArray(options.reservedIds).map(text)]
  let packId = text(raw.id)
  const draftId = text(options.packId)
  if (packId && draftId && packId !== draftId) {
    errors.push(error('pack-id-invalid', 'id', `spec.id「${packId}」与草稿 id「${draftId}」不一致（模板 id 不可变）`))
  }
  if (!packId) packId = draftId || slugifyPackId(name)
  if (!packId) {
    errors.push(error('pack-id-invalid', 'id', '无法从 name 生成合法 id，请显式提供 id'))
  } else if (!PACK_ID_PATTERN.test(packId)) {
    errors.push(error('pack-id-invalid', 'id', `id 不符合规则 ^[a-z0-9][a-z0-9-]{0,63}$：${packId}`))
  } else if (reserved.includes(packId)) {
    errors.push(error('pack-id-invalid', 'id', `id 与内置模板/保留名冲突：${packId}`))
  }
  if (text(builtin.id) && packId === text(builtin.id)) {
    errors.push(error('pack-id-invalid', 'id', `不能使用内置模板 id：${packId}`))
  }

  // 页面
  const rawPages = raw.pages
  if (!Array.isArray(rawPages)) {
    errors.push(error('page-count', 'pages', 'pages 必须是数组'))
  } else if (rawPages.length < 1 || rawPages.length > 40) {
    errors.push(error('page-count', 'pages', `页面数必须在 1—40 之间（当前 ${rawPages.length}）`))
  }

  const pages = []
  const pageIds = new Set()
  const sourceTypes = []
  const referencedTypes = []
  const rawPageList = asArray(rawPages)
  for (const [index, rawPage] of rawPageList.entries()) {
    const pagePath = `pages[${index}]`
    if (!isRecord(rawPage)) {
      errors.push(error('spec-invalid', pagePath, '页面必须是对象'))
      continue
    }
    for (const key of Object.keys(rawPage)) {
      if (!PAGE_KEYS.includes(key)) errors.push(error('spec-invalid', `${pagePath}.${key}`, `未知的页面字段：${key}`))
    }
    const id = text(rawPage.id)
    if (!id) errors.push(error('page-id-invalid', `${pagePath}.id`, '页面 id 必填'))
    else if (!PAGE_ID_PATTERN.test(id)) {
      errors.push(error('page-id-invalid', `${pagePath}.id`, `页面 id 不符合规则：${id}`))
    } else if (pageIds.has(id)) {
      errors.push(error('page-id-invalid', `${pagePath}.id`, `页面 id 重复：${id}`))
    } else {
      pageIds.add(id)
    }
    const pageName = text(rawPage.name)
    if (!pageName) errors.push(error('spec-invalid', `${pagePath}.name`, '页面 name 必填'))
    else if (pageName.length > 100) errors.push(error('spec-invalid', `${pagePath}.name`, '页面 name 过长（最多 100 字符）'))

    const kind = text(rawPage.kind)
    if (!kind) {
      errors.push(error('kind-required', `${pagePath}.kind`, '自定义模板页面必须显式声明 kind（reference / contract）'))
    } else if (kind === 'blueprint') {
      errors.push(error('kind-invalid', `${pagePath}.kind`, 'spec 不允许 blueprint（内置页面由内置 pack 承载）'))
    } else if (kind !== 'reference' && kind !== 'contract') {
      errors.push(error('kind-invalid', `${pagePath}.kind`, `未知页面 kind：${kind}`))
    }

    if (rawPage.blueprint !== undefined) {
      errors.push(
        error(
          kind === 'contract' ? 'blueprint-on-contract' : 'spec-invalid',
          `${pagePath}.blueprint`,
          'spec 页面不能写 blueprint（reference 由生成器复制源蓝图，contract 页无蓝图）'
        )
      )
    }

    const page = {
      id,
      name: pageName,
      kind,
      type: '',
      recipe: '',
      preview: '',
      description: text(rawPage.description)
    }

    if (kind === 'reference') {
      if (rawPage.contract !== undefined) errors.push(error('spec-invalid', `${pagePath}.contract`, 'reference 页不允许 contract'))
      if (rawPage.sampleEntity !== undefined) {
        errors.push(error('spec-invalid', `${pagePath}.sampleEntity`, 'reference 页不允许 sampleEntity'))
      }
      if (rawPage.sampleSubEntities !== undefined) {
        errors.push(error('spec-invalid', `${pagePath}.sampleSubEntities`, 'reference 页不允许 sampleSubEntities'))
      }
      const source = isRecord(rawPage.source) ? rawPage.source : null
      const sourcePack = text(source && source.pack)
      const sourceType = text(source && source.applicationType)
      const sourcePageId = text(source && source.pageId)
      if (!source || !sourcePack || !sourceType || !sourcePageId) {
        errors.push(
          error('source-missing', `${pagePath}.source`, 'reference 页必须提供 source {pack, applicationType, pageId}')
        )
      } else if (sourcePack !== text(builtin.id)) {
        errors.push(error('source-missing', `${pagePath}.source.pack`, `reference 只能引用内置模板包 ${text(builtin.id)}：${sourcePack}`))
      } else {
        const sourceTypeMeta = builtinTypeById(builtin, sourceType)
        if (!sourceTypeMeta) {
          errors.push(error('source-missing', `${pagePath}.source.applicationType`, `来源应用类型不存在：${sourceType}`))
        } else {
          const sourcePage = builtinPage(builtin, sourceType, sourcePageId)
          if (!sourcePage) {
            errors.push(error('source-page-missing', `${pagePath}.source.pageId`, `来源页面不存在：${sourceType}/${sourcePageId}`))
          } else {
            if (!referencedTypes.includes(sourceType)) referencedTypes.push(sourceType)
            const explicitRecipe = text(rawPage.recipe)
            if (explicitRecipe && explicitRecipe !== text(sourcePage.recipe)) {
              errors.push(
                error('spec-invalid', `${pagePath}.recipe`, `reference 页 recipe 必须与源页面一致（${text(sourcePage.recipe)}）`)
              )
            }
            const explicitType = text(rawPage.type)
            if (explicitType && explicitType !== text(sourcePage.type)) {
              errors.push(
                error('spec-invalid', `${pagePath}.type`, `reference 页 type 必须与源页面一致（${text(sourcePage.type)}）`)
              )
            }
            page.type = text(sourcePage.type)
            page.recipe = text(sourcePage.recipe)
            page.preview = text(rawPage.preview) || text(sourcePage.preview) || previewForRecipe(page.recipe)
            page.description = page.description || text(sourcePage.description) || `${pageName}（引用页面）`
            page.source = { pack: sourcePack, applicationType: sourceType, pageId: sourcePageId }
            if (Array.isArray(options.knownComponents) && options.knownComponents.length) {
              const known = new Set(options.knownComponents)
              for (const [componentIndex, component] of asArray(sourcePage.components).entries()) {
                const componentName = text(component)
                if (!componentName || known.has(componentName)) continue
                warnings.push(
                  warning(
                    'reference-component-extra',
                    `${pagePath}.source`,
                    `源页面组件「${componentName}」不在 catalog（第 ${componentIndex + 1} 个）`
                  )
                )
              }
            }
            pages.push(page)
            if (!sourceTypes.includes(sourceType)) sourceTypes.push(sourceType)
            continue
          }
        }
      }
      // 源页面解析失败时仍保留页面骨架，便于 errors[].path 定位
      page.type = text(rawPage.type) || 'list'
      page.recipe = text(rawPage.recipe) || 'list'
      page.preview = text(rawPage.preview) || previewForRecipe(page.recipe)
      page.source = {
        pack: sourcePack,
        applicationType: sourceType,
        pageId: sourcePageId
      }
      pages.push(page)
      continue
    }

    if (kind !== 'contract') {
      // kind 非法/缺失：保留骨架以便其它校验继续报告
      page.type = text(rawPage.type)
      page.recipe = text(rawPage.recipe)
      page.preview = text(rawPage.preview)
      pages.push(page)
      continue
    }

    // contract 页
    if (rawPage.source !== undefined) errors.push(error('spec-invalid', `${pagePath}.source`, 'contract 页不允许 source'))
    const contract = rawPage.contract
    if (!isRecord(contract)) {
      errors.push(error('contract-missing', `${pagePath}.contract`, 'contract 页必须提供 contract 对象'))
    }
    const seenEntityIds = new Set()
    const sampleEntity = rawPage.sampleEntity === undefined
      ? null
      : normalizeEntity(rawPage.sampleEntity, `${pagePath}.sampleEntity`, errors)
    if (!sampleEntity) {
      if (rawPage.sampleEntity === undefined) {
        errors.push(error('sample-entity-missing', `${pagePath}.sampleEntity`, 'contract 页必须提供 sampleEntity'))
      }
    } else {
      seenEntityIds.add(sampleEntity.id)
    }
    const sampleSubEntities = []
    if (rawPage.sampleSubEntities !== undefined) {
      if (!Array.isArray(rawPage.sampleSubEntities)) {
        errors.push(error('sample-sub-entity-invalid', `${pagePath}.sampleSubEntities`, 'sampleSubEntities 必须是数组'))
      } else {
        for (const [subIndex, rawSub] of rawPage.sampleSubEntities.entries()) {
          const subPath = `${pagePath}.sampleSubEntities[${subIndex}]`
          const sub = normalizeEntity(rawSub, subPath, errors, 'sample-sub-entity-invalid')
          if (!sub) continue
          if (seenEntityIds.has(sub.id)) {
            errors.push(error('sample-sub-entity-invalid', `${subPath}.id`, `实体 id 重复：${sub.id}`))
            continue
          }
          seenEntityIds.add(sub.id)
          sampleSubEntities.push(sub)
        }
      }
    }

    let recipe = text(rawPage.recipe)
    let type = text(rawPage.type)
    if (recipe && !RECIPES.includes(recipe)) {
      errors.push(error('contract-recipe-unsupported', `${pagePath}.recipe`, `recipe 不在 8 配方内：${recipe}`))
    }
    if (!recipe && type) recipe = recipeForType(type, isRecord(contract) ? contract : null)
    if (!recipe) {
      // type/recipe 都缺：按契约形态推断（form → 弹窗/页面表单，列表 → list，其余 detail）
      if (isRecord(contract) && isRecord(contract.form)) {
        recipe = text(contract.form.presentation) === 'dialog' ? 'dialog-form' : 'page-form'
      } else if (isRecord(contract) && (asArray(contract.columns).length || asArray(contract.filters).length)) {
        recipe = 'list'
      } else {
        recipe = 'detail'
      }
    }
    if (!RECIPES.includes(recipe)) recipe = 'detail'
    if (!type) type = typeForRecipe(recipe)
    if (!PAGE_TYPES.includes(type)) {
      errors.push(error('spec-invalid', `${pagePath}.type`, `contract 页 type 必须是 ${PAGE_TYPES.join('/')}：${type}`))
    }
    page.type = type
    page.recipe = recipe
    page.preview = text(rawPage.preview) || previewForRecipe(recipe)
    page.description = page.description || `${pageName}（按页面契约实现）`
    page.contract = isRecord(contract) ? contract : {}
    if (sampleEntity) page.sampleEntity = sampleEntity
    if (sampleSubEntities.length) page.sampleSubEntities = sampleSubEntities
    if (isRecord(contract)) {
      const pool = [sampleEntity, ...sampleSubEntities].filter(Boolean)
      warnings.push(...contractWarnings(contract, page, pagePath, pool))
      warnings.push(...componentWarnings(contract, options.knownComponents, pagePath))
    }
    pages.push(page)
  }

  // baseApplicationType / style 默认
  const requestedBase = text(raw.baseApplicationType)
  let baseApplicationType = requestedBase || referencedTypes[0] || text(builtin.defaultApplicationType)
  if (!builtinTypeById(builtin, baseApplicationType)) {
    errors.push(error('base-type-missing', 'baseApplicationType', `应用类型不存在：${baseApplicationType}`))
    baseApplicationType = text(builtin.defaultApplicationType)
  }
  const requestedStyle = text(raw.style)
  let style = requestedStyle || text(builtin.defaultStyle)
  if (!builtinStyleById(builtin, style)) {
    errors.push(error('style-missing', 'style', `视觉风格不存在：${style}`))
    style = text(builtin.defaultStyle)
  }

  const normalized = {
    schemaVersion: 1,
    id: packId,
    name,
    description,
    baseApplicationType,
    style,
    pages
  }

  const ok = errors.length === 0
  return {
    ok,
    spec: normalized,
    errors,
    warnings,
    specHash: ok ? specHash(normalized) : undefined,
    sourceTypes: sourceTypes.length ? sourceTypes : []
  }
}

/** contract 容器 → design.json 页面字段（展平；不覆盖 pack 页面的 string[] components） */
function flattenContract(contract) {
  const input = isRecord(contract) ? contract : {}
  const page = {}
  for (const key of ['filters', 'columns', 'rowActions', 'toolbarActions', 'selection', 'pagination', 'form', 'tree', 'subTables', 'components']) {
    if (input[key] !== undefined) page[key] = input[key]
  }
  return page
}

/**
 * 用 spec 的 contract 页构造 synthetic design（模板预览 / 测试用，P7-7a 先落算法）。
 * entities = sampleEntity + sampleSubEntities；page.entity = sampleEntity.id。
 */
function buildSyntheticDesign(spec, pageId) {
  const pages = asArray(spec && spec.pages)
  const page = pages.find(item => item && item.id === pageId)
  if (!page) return null
  const entities = []
  if (page.sampleEntity) entities.push(page.sampleEntity)
  for (const sub of asArray(page.sampleSubEntities)) entities.push(sub)
  const designPage = {
    id: page.id,
    name: page.name,
    type: page.type,
    entity: page.sampleEntity ? page.sampleEntity.id : '',
    recipe: page.recipe,
    ...flattenContract(page.contract)
  }
  return {
    module: 'TEMPLATE',
    title: spec.name,
    designSystem: { pack: spec.id, applicationType: spec.id, style: spec.style },
    entities,
    pages: [designPage]
  }
}

/** 结构化字段名引用（页面顶层 columns/filters/表单/子表），用于测试与 catalog 提示 */
function flattenPageFields(page) {
  const contract = isRecord(page && page.contract) ? page.contract : {}
  return {
    columns: asArray(contract.columns).map(String),
    filters: asArray(contract.filters).map(String),
    formFields: isRecord(contract.form) ? asArray(contract.form.fields).map(String) : [],
    formGroups: asArray(contract.form && contract.form.groups).map(group => ({
      title: text(group && group.title),
      fields: asArray(group && group.fields).map(String)
    })),
    subTables: asArray(contract.subTables).map(item => ({
      entity: text(item && (item.entity || item.target)),
      columns: asArray(item && item.columns).map(String)
    }))
  }
}

module.exports = {
  PACK_ID_PATTERN,
  PAGE_ID_PATTERN,
  RESERVED_PACK_IDS,
  RECIPES,
  PAGE_TYPES,
  FIELD_TYPES,
  SPEC_KEYS,
  PAGE_KEYS,
  canonicalJson,
  specHash,
  slugifyPackId,
  isValidPackId,
  isValidPageId,
  previewForRecipe,
  recipeForType,
  typeForRecipe,
  normalizeSpec,
  flattenContract,
  flattenPageFields,
  buildSyntheticDesign
}
