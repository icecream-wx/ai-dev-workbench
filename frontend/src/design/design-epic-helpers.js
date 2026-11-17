/**
 * D-RMP：设计大纲树 / Epic 过滤 / 批量生成状态（纯函数，可直接 Node 单测）
 *
 * 语义（与后端一致）：
 * - Epic 节点来自 `project.input.epics`；完全 fallback（无 Epic）时用 `input.scenes`（SCENE-xxx）；
 * - 页面集归属：Epic 用 `epicId`；fallback 场景用 `epicId=null` + `sceneKey`；
 * - 实体按 `requirementRefs` 命中 Epic 或其 Stories 视为相关；
 * - 每 Epic 一个 primary 页面集（position 最小），其它页面集保留；
 * - 只有一个模块展开（手风琴），由组件控制，这里只提供数据。
 */

/** 设计输入里的 Epic/场景节点（带 Story 列表，供过滤与对话框展示） */
export function epicNodesOf(project) {
  const input = project?.input
  if (!input) return []
  if (Array.isArray(input.epics) && input.epics.length) {
    return input.epics.map(epic => ({
      id: epic.id,
      title: epic.title,
      goal: epic.goal || '',
      priority: epic.priority || '',
      sceneId: epic.sceneId ?? null,
      isScene: false,
      storyIds: (epic.stories ?? []).map(story => story.id)
    }))
  }
  if (Array.isArray(input.scenes) && input.scenes.length) {
    const stories = Array.isArray(input.stories) ? input.stories : []
    return input.scenes.map(scene => ({
      id: scene.id,
      title: scene.title,
      goal: scene.description || '',
      priority: '',
      sceneId: scene.id,
      isScene: true,
      storyIds: stories.filter(story => !story.epicId).map(story => story.id)
    }))
  }
  return []
}

export function epicRefList(node) {
  if (!node) return []
  return Array.from(new Set([node.id, ...(node.storyIds ?? [])]))
}

/** 实体是否与本 Epic/场景相关（requirementRefs 命中 Epic 或其 Stories） */
export function epicMatchesEntity(entity, node) {
  if (!entity || !node) return false
  const refs = new Set(epicRefList(node))
  return (entity.requirementRefs ?? []).some(ref => refs.has(ref))
}

export function epicFilterEntities(entities, node) {
  const list = Array.isArray(entities) ? entities : []
  if (!node) return list
  return list.filter(entity => epicMatchesEntity(entity, node))
}

/** 页面集是否属于本 Epic/场景（Epic 用 epicId；fallback 场景用 epicId=null + sceneKey；再兜底 storyIds 相交） */
export function epicMatchesPageSet(set, node) {
  if (!set || !node) return false
  if (node.isScene) {
    if (set.epicId) return false
    if (set.sceneKey === node.id) return true
  } else if (set.epicId === node.id) {
    return true
  }
  const storyIds = new Set(node.storyIds ?? [])
  return (set.storyIds ?? []).some(storyId => storyIds.has(storyId))
}

export function epicFilterPageSets(pageSets, node) {
  const list = Array.isArray(pageSets) ? pageSets : []
  if (!node) return list
  return list.filter(set => epicMatchesPageSet(set, node))
}

/** 该 Epic 的 primary 页面集（数组按 position 排好序，取第一个匹配） */
export function epicPrimaryPageSet(pageSets, node) {
  if (!node) return null
  return (Array.isArray(pageSets) ? pageSets : []).find(set => epicMatchesPageSet(set, node)) ?? null
}

function coverageOfPageSets(pageSets, node) {
  const storyIds = node?.storyIds ?? []
  if (!storyIds.length) return { storyTotal: 0, coveredStories: 0, uncovered: [] }
  const covered = new Set()
  for (const set of pageSets) {
    for (const storyId of set.storyIds ?? []) covered.add(storyId)
    for (const page of set.pages ?? []) for (const ref of page.requirementRefs ?? []) covered.add(ref)
  }
  const uncovered = storyIds.filter(storyId => !covered.has(storyId))
  return { storyTotal: storyIds.length, coveredStories: storyIds.length - uncovered.length, uncovered }
}

/**
 * Epic 节点统计（组件渲染用）：
 * status: none（未生成）| draft | confirmed | stale（需求变更待同步）
 * - confirmed 只由该 Epic 自身的 primary 页面集/页面/相关实体是否全部确认决定（模块项目仍可为 draft，MF-DRMP-4）；
 * - stale 优先（需求变更待同步）；
 * - needsWork：默认批量勾选依据（未生成 / 无页面 / Story 未覆盖）。
 */
export function epicStatsOf(project, node) {
  const refs = new Set(epicRefList(node))
  const allSets = (project?.pageSets ?? []).filter(set => epicMatchesPageSet(set, node))
  const primary = allSets[0] ?? null
  // MF-DRMP-5：相关实体 = requirementRefs 命中，或（本 Epic 匹配页面集的）页面 entityId 绑定
  const boundEntityIds = new Set(
    allSets
      .flatMap(set => set.pages ?? [])
      .map(page => page.entityId)
      .filter(Boolean)
  )
  const entities = (project?.entities ?? []).filter(
    entity => (entity.requirementRefs ?? []).some(ref => refs.has(ref)) || boundEntityIds.has(entity.id)
  )
  const pages = allSets.reduce((sum, set) => sum + (set.pages?.length ?? 0), 0)
  const missingImages = allSets.reduce(
    (sum, set) => sum + (set.pages ?? []).filter(page => !page.imagePath).length,
    0
  )
  const coverage = coverageOfPageSets(allSets, node)
  const generated = allSets.length > 0 || entities.length > 0
  const allConfirmed =
    Boolean(primary) &&
    primary.status === 'confirmed' &&
    (primary.pages ?? []).every(page => page.status === 'confirmed') &&
    entities.every(entity => entity.status === 'confirmed')
  let status = 'none'
  if (generated) {
    if (project?.stale?.stale) status = 'stale'
    else if (allConfirmed) status = 'confirmed'
    else status = 'draft'
  }
  return {
    node,
    entities,
    pageSets: allSets,
    primary,
    pageSetCount: allSets.length,
    pageCount: pages,
    missingImages,
    storyTotal: coverage.storyTotal,
    coveredStories: coverage.coveredStories,
    uncovered: coverage.uncovered,
    status,
    needsWork: !generated || pages === 0 || coverage.coveredStories < coverage.storyTotal
  }
}

/** 整个模块的大纲数据：Epic 节点 + 数据集 + 未归属页面集/实体 */
export function epicOutlineOf(project) {
  const nodes = epicNodesOf(project).map(node => epicStatsOf(project, node))
  const matchedEntityIds = new Set(nodes.flatMap(item => item.entities.map(entity => entity.id)))
  const matchedSetIds = new Set(nodes.flatMap(item => item.pageSets.map(set => set.id)))
  return {
    nodes,
    matchedEntities: (project?.entities ?? []).filter(entity => matchedEntityIds.has(entity.id)),
    unassignedEntities: (project?.entities ?? []).filter(entity => !matchedEntityIds.has(entity.id)),
    unassignedPageSets: (project?.pageSets ?? []).filter(set => !matchedSetIds.has(set.id))
  }
}

/** 默认批量勾选：未生成 / 无页面 / Story 未覆盖的 Epic */
export function defaultEpicSelection(nodes) {
  return (Array.isArray(nodes) ? nodes : []).filter(item => item.needsWork).map(item => item.node.id)
}

/** 目标 Epic 里已确认、生成会重新打开的项（与后端 epicGenerationImpact 同口径） */
export function affectedConfirmedForEpic(project, node) {
  const stats = epicStatsOf(project, node)
  const primary = stats.primary
  const refs = new Set(epicRefList(node))
  // MF-DRMP-5：受影响实体 = refs 命中，或 primary 页面绑定（不要求 refs）
  const primaryEntityIds = new Set((primary?.pages ?? []).map(page => page.entityId).filter(Boolean))
  const entities = (project?.entities ?? []).filter(
    entity => (entity.requirementRefs ?? []).some(ref => refs.has(ref)) || primaryEntityIds.has(entity.id)
  )
  return {
    entities: entities
      .filter(entity => entity.status === 'confirmed')
      .map(entity => ({ id: entity.id, name: entity.name })),
    pageSets: primary && primary.status === 'confirmed' ? [{ id: primary.id, title: primary.title }] : [],
    // MF-DRMP-3：页面集即使还是 draft，其中已确认的 page 也会被替换，必须提示/重开
    pages: (primary?.pages ?? [])
      .filter(page => page.status === 'confirmed')
      .map(page => ({ id: page.id, title: page.title, pageSetId: primary?.id ?? page.pageSetId }))
  }
}

/** 多个 Epic 的受影响 confirmed 汇总（批量确认框展示） */
export function affectedConfirmedSummary(project, nodes) {
  const entities = new Map()
  const pageSets = new Map()
  const pages = new Map()
  for (const item of Array.isArray(nodes) ? nodes : []) {
    const node = item?.node ?? item
    const impact = affectedConfirmedForEpic(project, node)
    for (const entry of impact.entities) entities.set(entry.id, entry)
    for (const entry of impact.pageSets) pageSets.set(entry.id, entry)
    for (const entry of impact.pages) pages.set(entry.id, entry)
  }
  const list = [
    ...Array.from(entities.values()).map(entry => `实体「${entry.name}」已确认`),
    ...Array.from(pageSets.values()).map(entry => `页面集「${entry.title}」已确认`),
    ...Array.from(pages.values()).map(entry => `页面「${entry.title}」已确认`)
  ]
  return {
    entities: Array.from(entities.values()),
    pageSets: Array.from(pageSets.values()),
    pages: Array.from(pages.values()),
    items: list,
    count: list.length
  }
}

/** 批量生成队列（纯状态；组件顺序执行） */
export function createEpicBatch(items) {
  return (Array.isArray(items) ? items : []).map(item => ({
    epicId: typeof item === 'string' ? item : item.epicId,
    title: typeof item === 'string' ? '' : item.title || '',
    status: 'pending',
    error: '',
    entitiesAdded: 0,
    entitiesUpdated: 0,
    pages: 0,
    reopened: []
  }))
}

export function updateEpicBatch(items, epicId, patch) {
  return (Array.isArray(items) ? items : []).map(item =>
    item.epicId === epicId ? { ...item, ...patch } : item
  )
}

/** 下一个待执行项的索引（-1 = 没有） */
export function nextPendingIndex(items) {
  return (Array.isArray(items) ? items : []).findIndex(item => item.status === 'pending')
}

/** 停止剩余：pending → skipped（当前 running 不变） */
export function skipPending(items) {
  return (Array.isArray(items) ? items : []).map(item =>
    item.status === 'pending' ? { ...item, status: 'skipped' } : item
  )
}

/** 失败项重试：failed → pending（返回新数组；没有失败项时原样） */
export function retryFailed(items) {
  return (Array.isArray(items) ? items : []).map(item =>
    item.status === 'failed' ? { ...item, status: 'pending', error: '' } : item
  )
}

export function retryOne(items, epicId) {
  return (Array.isArray(items) ? items : []).map(item =>
    item.epicId === epicId && item.status === 'failed' ? { ...item, status: 'pending', error: '' } : item
  )
}

export function epicBatchSummary(items) {
  const list = Array.isArray(items) ? items : []
  const count = status => list.filter(item => item.status === status).length
  return {
    total: list.length,
    pending: count('pending'),
    running: count('running'),
    success: count('success'),
    failed: count('failed'),
    skipped: count('skipped'),
    finished: list.length > 0 && list.every(item => ['success', 'failed', 'skipped'].includes(item.status))
  }
}

export const EPIC_STATUS_LABELS = {
  none: '未生成',
  draft: '草稿',
  confirmed: '已确认',
  stale: '需同步'
}

export function epicStatusLabel(status) {
  return EPIC_STATUS_LABELS[status] ?? status ?? ''
}

export const EPIC_BATCH_STATUS_LABELS = {
  pending: '等待',
  running: '生成中',
  success: '成功',
  failed: '失败',
  skipped: '跳过'
}

export function epicBatchStatusLabel(status) {
  return EPIC_BATCH_STATUS_LABELS[status] ?? status ?? ''
}
