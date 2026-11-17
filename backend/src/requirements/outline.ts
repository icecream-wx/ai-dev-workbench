/**
 * 需求结构化（H1）：Scene / Epic / Story 稳定 ID + Markdown 双向渲染
 *
 * 约定：
 * - `scenes` 章节保存 Scene；`epics` 章节保存 Epic + Story；
 * - 结构化数据是这些章节的权威来源，Markdown 由结构确定性渲染；
 * - 稳定 ID `SCENE-001 / EPIC-001 / STORY-001`：编辑标题不改 ID，新增分配下一个编号，
 *   删除标记 archived（保留 ID 记录，不参与渲染/交接）。
 * - 旧文档可用 `rebuildOutlineSection` 做确定性重建，用户可在结构编辑器里复核。
 */
import type {
  RequirementEpic,
  RequirementOutlineData,
  RequirementScene,
  RequirementStory
} from './types'

export type OutlineKind = 'scenes' | 'epics'

export interface OutlineWarning {
  code: string
  message: string
}

/** 解析阶段的内部字段：Story 归属于第几个 Epic（解析后再换成稳定 ID） */
interface ParsedStory extends RequirementStory {
  epicRef?: number
}

const SCENE_ID = /^SCENE-(\d{1,6})(?:\s+|$)/i
const EPIC_ID = /^EPIC-(\d{1,6})(?:\s+|$)/i
const STORY_ID = /^STORY-(\d{1,6})(?:\s+|$)/i

const EPIC_META = /^(目标|优先级|场景|负责人|状态)\s*[：:]\s*(.*)$/
const ACCEPTANCE_HEAD = /^验收(标准|要点|条件)\s*[：:]?\s*$/
const ACCEPTANCE_ITEM = /^验收\s*[：:]\s*(.*)$/

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function padId(prefix: string, number: number): string {
  return `${prefix}-${String(number).padStart(3, '0')}`
}

function matchId(pattern: RegExp, raw: string): string | null {
  const found = pattern.exec(raw.trim())
  if (!found) return null
  const prefix = pattern === SCENE_ID ? 'SCENE' : pattern === EPIC_ID ? 'EPIC' : 'STORY'
  return padId(prefix, Number(found[1]))
}

function idNumber(pattern: RegExp, id: string): number {
  const found = pattern.exec(id)
  return found ? Number(found[1]) : 0
}

/** 收集全部（含 archived）ID，避免重复分配 */
export function collectOutlineIds(dataList: Array<RequirementOutlineData | undefined | null>): Set<string> {
  const used = new Set<string>()
  for (const data of dataList) {
    if (!data) continue
    for (const scene of data.scenes ?? []) if (scene?.id) used.add(scene.id)
    for (const epic of data.epics ?? []) if (epic?.id) used.add(epic.id)
    for (const story of data.stories ?? []) if (story?.id) used.add(story.id)
  }
  return used
}

/** data_json → 结构化章节；非法/空返回 undefined（doc.ts 与本模块共用） */
export function parseSectionData(raw: string | null | undefined): RequirementOutlineData | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return undefined
    const data: RequirementOutlineData = {
      scenes: Array.isArray(parsed.scenes) ? (parsed.scenes as RequirementOutlineData['scenes']) : [],
      epics: Array.isArray(parsed.epics) ? (parsed.epics as RequirementOutlineData['epics']) : [],
      stories: Array.isArray(parsed.stories) ? (parsed.stories as RequirementOutlineData['stories']) : []
    }
    if (!data.scenes.length && !data.epics.length && !data.stories.length) return undefined
    return data
  } catch {
    return undefined
  }
}

export function nextOutlineId(prefix: 'SCENE' | 'EPIC' | 'STORY', used: Set<string>): string {
  const pattern = prefix === 'SCENE' ? SCENE_ID : prefix === 'EPIC' ? EPIC_ID : STORY_ID
  let max = 0
  for (const id of used) max = Math.max(max, idNumber(pattern, id))
  let number = max + 1
  let candidate = padId(prefix, number)
  while (used.has(candidate)) {
    number += 1
    candidate = padId(prefix, number)
  }
  used.add(candidate)
  return candidate
}

export function emptyOutline(): RequirementOutlineData {
  return { scenes: [], epics: [], stories: [] }
}

/** 合并多个章节的数据；同 ID 只保留一次 */
export function mergeOutline(
  dataList: Array<RequirementOutlineData | undefined | null>,
  includeArchived = false
): RequirementOutlineData {
  const seen = new Set<string>()
  const result = emptyOutline()
  const push = <T extends { id: string; archived?: boolean }>(target: T[], item: T): void => {
    if (!item?.id || seen.has(item.id)) return
    if (!includeArchived && item.archived) return
    seen.add(item.id)
    target.push(item)
  }
  for (const data of dataList) {
    if (!data) continue
    for (const scene of data.scenes ?? []) push(result.scenes, scene)
    for (const epic of data.epics ?? []) push(result.epics, epic)
    for (const story of data.stories ?? []) push(result.stories, story)
  }
  result.scenes.sort((a, b) => a.position - b.position)
  result.epics.sort((a, b) => a.position - b.position)
  result.stories.sort((a, b) => a.position - b.position)
  return result
}

function stringList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map(item => {
        if (typeof item === 'string') return item.trim()
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>
          const candidate = record.text ?? record.label ?? record.name ?? record.value
          return typeof candidate === 'string' ? candidate.trim() : ''
        }
        return ''
      })
      .filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw
      .split('\n')
      .map(line => line.replace(/^\s*(?:[-*+]|\d+\.)\s*/, '').replace(/^验收\s*[：:]\s*/, '').trim())
      .filter(Boolean)
  }
  return []
}

function asOutlineKind(value: unknown): OutlineKind {
  return value === 'scenes' ? 'scenes' : 'epics'
}

/** Epic 目标：字符串原样保留；字符串数组 join 成换行；其他类型忽略（模型偶尔返回数组/对象） */
function goalText(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim()
  if (Array.isArray(raw)) {
    return raw
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

function rawItemList(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
}

function findTitleMatch<T extends { id: string; title: string; archived?: boolean }>(lists: T[][], title: string): T | undefined {
  const key = normalizeTitle(title)
  for (const list of lists) {
    const found = list.find(item => !item.archived && normalizeTitle(item.title) === key)
    if (found) return found
  }
  return undefined
}

interface NormalizeOptions {
  kind: OutlineKind
  /** 当前章节旧数据（用于判断哪些条目被删除 → archived） */
  previous?: RequirementOutlineData | null
  /** 本模块范围（用于引用校验与同标题沿用 ID） */
  global: RequirementOutlineData
  /**
   * 全应用占用集合（跨所有模块、含归档）：**只用于分配编号时跳过已占用 ID**，
   * 不参与同标题匹配（否则模块 B 的同名 Story 会继承模块 A 的 ID）。
   * 本模块 `global`/`previous` 里的 ID 不算“被其它模块占用”。
   */
  reservedIds?: Set<string>
}

/** 本模块自有 ID 之外的占用集合（M2：跨模块唯一） */
function foreignReserved(
  ownIds: Set<string>,
  reservedIds: Set<string> | undefined
): Set<string> | null {
  if (!reservedIds) return null
  const foreign = new Set<string>()
  for (const id of reservedIds) if (!ownIds.has(id)) foreign.add(id)
  return foreign.size ? foreign : null
}


/**
 * 归一化用户/模型提交的结构化章节：
 * - 有 id 且类型匹配 → 保留（标题可改）；
 * - 无 id → 按标题匹配旧条目沿用 ID，否则分配新 ID；
 * - 引用不存在 → 置空 + warning；
 * - 旧章节里消失的条目 → archived（保留 ID）；
 * - 返回该章节的数据 + 合并后的全局 outline。
 */
export function normalizeOutlineSection(
  raw: unknown,
  options: NormalizeOptions
): { data: RequirementOutlineData; global: RequirementOutlineData; warnings: OutlineWarning[] } {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const warnings: OutlineWarning[] = []
  const ownIds = collectOutlineIds([options.global, options.previous])
  const used = new Set(ownIds)
  if (options.reservedIds) for (const id of options.reservedIds) used.add(id)
  const foreign = foreignReserved(ownIds, options.reservedIds)
  /** 显式 raw id 只有“不属于其它模块”时才可沿用（§9.3） */
  const acceptedRawId = (id: string | null): string | null => (id && !foreign?.has(id) ? id : null)
  const previous = options.previous ?? emptyOutline()
  const global = mergeOutline([options.global], false)
  const next = emptyOutline()
  const assigned = new Set<string>()

  const sceneTitles = [global.scenes, previous.scenes]
  const epicTitles = [global.epics, previous.epics, next.epics]
  const storyTitles = [global.stories, previous.stories, next.stories]

  const scenesRaw = options.kind === 'scenes' ? rawItemList(input.scenes) : []
  scenesRaw.forEach((item, index) => {
    const title = asString(item.title)
    if (!title) {
      warnings.push({ code: 'scene-title', message: `第 ${index + 1} 个场景缺少标题，已忽略` })
      return
    }
    const rawId = asString(item.id)
    const matchedId = acceptedRawId(rawId ? matchId(SCENE_ID, rawId) : null) ?? findTitleMatch(sceneTitles, title)?.id ?? null
    const id = matchedId && !assigned.has(matchedId) ? matchedId : nextOutlineId('SCENE', used)
    assigned.add(id)
    used.add(id)
    next.scenes.push({
      id,
      title,
      description: asString(item.description),
      position: index,
      ...(item.archived === true ? { archived: true } : {})
    })
  })

  const epicsRaw = options.kind === 'epics' ? rawItemList(input.epics) : []
  const epicIdByIndex: string[] = []
  epicsRaw.forEach((item, index) => {
    const title = asString(item.title)
    if (!title) {
      warnings.push({ code: 'epic-title', message: `第 ${index + 1} 个 Epic 缺少标题，已忽略` })
      return
    }
    const rawId = asString(item.id)
    const matchedId = acceptedRawId(rawId ? matchId(EPIC_ID, rawId) : null) ?? findTitleMatch(epicTitles, title)?.id ?? null
    const id = matchedId && !assigned.has(matchedId) ? matchedId : nextOutlineId('EPIC', used)
    assigned.add(id)
    used.add(id)
    epicIdByIndex[index] = id
    const rawScene = asString(item.sceneId)
    const sceneId = rawScene && global.scenes.some(scene => scene.id === rawScene && !scene.archived) ? rawScene : null
    if (rawScene && !sceneId) warnings.push({ code: 'epic-scene', message: `${id}「${title}」引用的场景不存在：${rawScene}` })
    next.epics.push({
      id,
      title,
      goal: goalText(item.goal),
      priority: asString(item.priority),
      sceneId,
      position: index,
      ...(item.archived === true ? { archived: true } : {})
    })
  })

  const storiesRaw = options.kind === 'epics' ? rawItemList(input.stories) : []
  // 去重键：顶层 stories[] 与 Epic 内嵌 stories 同时出现时只保留一条（顶层优先）。
  // raw id 全局去重（同一 STORY id 只留一条）；标题只在同一 Epic 内去重——
  // 不同 Epic 可以合法拥有同名 Story（如都有“查看列表”），不能被误删。
  const storyKeys = new Set<string>()
  const storyKeyOf = (item: Record<string, unknown>, title: string, epicKey: string): string[] => {
    const keys: string[] = []
    const rawId = asString(item.id)
    if (rawId) keys.push(`id:${rawId}`)
    if (title) keys.push(`title:${epicKey}:${normalizeTitle(title)}`)
    return keys
  }
  const addStory = (item: Record<string, unknown>, defaultEpicId: string | null): void => {
    const title = asString(item.title)
    if (!title) {
      warnings.push({ code: 'story-title', message: `第 ${next.stories.length + 1} 个 Story 缺少标题，已忽略` })
      return
    }
    const rawEpic = asString(item.epicId)
    const effectiveEpic = rawEpic || defaultEpicId || ''
    const keys = storyKeyOf(item, title, effectiveEpic)
    if (keys.some(key => storyKeys.has(key))) return
    keys.forEach(key => storyKeys.add(key))
    const rawId = asString(item.id)
    const matchedId = acceptedRawId(rawId ? matchId(STORY_ID, rawId) : null) ?? findTitleMatch(storyTitles, title)?.id ?? null
    const id = matchedId && !assigned.has(matchedId) ? matchedId : nextOutlineId('STORY', used)
    assigned.add(id)
    used.add(id)
    const epicId = rawEpic && next.epics.some(epic => epic.id === rawEpic && !epic.archived)
      ? rawEpic
      : rawEpic && global.epics.some(epic => epic.id === rawEpic && !epic.archived)
        ? rawEpic
        : !rawEpic && defaultEpicId
          ? defaultEpicId
          : !rawEpic && next.epics.length === 1
            ? next.epics[0].id
            : null
    if (rawEpic && !epicId) warnings.push({ code: 'story-epic', message: `${id}「${title}」引用的 Epic 不存在：${rawEpic}` })
    next.stories.push({
      id,
      epicId,
      title,
      description: asString(item.description),
      acceptance: stringList(item.acceptance),
      priority: asString(item.priority),
      ...(asString(item.status) ? { status: asString(item.status) } : {}),
      position: next.stories.length,
      ...(item.archived === true ? { archived: true } : {})
    })
  }

  // 顶层 stories[] 优先，避免与 Epic 内嵌 stories 重复
  storiesRaw.forEach(item => addStory(item, null))
  if (options.kind === 'epics') {
    epicsRaw.forEach((item, index) => {
      if (item.archived === true) return
      const epicId = epicIdByIndex[index]
      if (!epicId) return
      for (const key of ['stories', 'userStories', 'user_stories']) {
        for (const child of rawItemList(item[key])) addStory(child, epicId)
      }
    })
  }

  // 删除项归档：保留稳定 ID，不参与渲染/交接
  const archiveMissing = <T extends { id: string; position: number }>(prev: T[], kept: T[]): T[] => {
    const keptIds = new Set(kept.map(item => item.id))
    return prev
      .filter(item => !keptIds.has(item.id))
      .map((item, index) => ({ ...item, archived: true, position: kept.length + index }))
  }
  if (options.kind === 'scenes') next.scenes.push(...archiveMissing(previous.scenes, next.scenes))
  if (options.kind === 'epics') {
    next.epics.push(...archiveMissing(previous.epics, next.epics))
    next.stories.push(...archiveMissing(previous.stories, next.stories))
  }
  next.scenes = next.scenes.map((item, index) => ({ ...item, position: index }))
  next.epics = next.epics.map((item, index) => ({ ...item, position: index }))
  next.stories = next.stories.map((item, index) => ({ ...item, position: index }))

  // #1.2 兜底提示（不阻塞）：Epic 没有 Story 时提示补故事/重新生成
  if (options.kind === 'epics') {
    for (const epic of next.epics.filter(item => !item.archived)) {
      if (!next.stories.some(story => !story.archived && story.epicId === epic.id)) {
        warnings.push({ code: 'epic-no-story', message: `${epic.id}「${epic.title}」没有 Story；请补充或让 AI 重新生成` })
      }
    }
  }

  return { data: next, global: mergeOutline([global, next], true), warnings }
}

function cleanHeadingTitle(raw: string): string {
  return raw
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\s*(?:Epic|Feature|Story|User\s*Story|场景|业务场景)\s*[0-9一二三四五六七八九十百]*\s*[：:、.\-]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleFromIdLine(line: string, pattern: RegExp): { id: string | null; title: string } {
  const trimmed = line.trim()
  const direct = pattern.exec(trimmed)
  if (direct) {
    const id = matchId(pattern, trimmed)
    const rest = trimmed.slice(direct[0].length).replace(/^[\s：:、.\-]+/, '')
    return { id, title: cleanHeadingTitle(rest) }
  }
  return { id: null, title: cleanHeadingTitle(trimmed) }
}

function stripListMarker(line: string): string {
  return line.replace(/^\s*(?:[-*+]|\d+\.)\s+/, '').trim()
}

/**
 * 确定性解析 Markdown → 结构化章节（用于旧文档重建/源码模式保存）。
 * 只做启发式解析，结果必须让用户在结构化编辑器里复核。
 */
export function parseOutlineMarkdown(kind: OutlineKind, markdown: string): RequirementOutlineData {
  const lines = String(markdown ?? '').replace(/\r\n/g, '\n').split('\n')
  const data = emptyOutline()
  let inFence = false

  if (kind === 'scenes') {
    let current: RequirementScene | null = null
    for (const line of lines) {
      if (/^\s*```/.test(line)) inFence = !inFence
      if (!inFence) {
        const heading = /^###\s+(.+?)\s*$/.exec(line)
        const bold = /^\s*[-*+]\s+\*\*(.+?)\*\*/.exec(line)
        const source = heading ? heading[1] : bold ? bold[1] : ''
        if (source) {
          const parsed = titleFromIdLine(source, SCENE_ID)
          if (!parsed.title) continue
          current = { id: parsed.id ?? '', title: parsed.title, description: '', position: data.scenes.length }
          data.scenes.push(current)
          continue
        }
      }
      if (current) {
        const text = stripListMarker(line)
        if (text) current.description = [current.description, text].filter(Boolean).join(' ').slice(0, 800)
      }
    }
    if (!data.scenes.length) {
      const text = lines.map(stripListMarker).filter(Boolean)
      if (text.length) {
        data.scenes.push({
          id: '',
          title: text[0].slice(0, 60),
          description: text.slice(1).join(' ').slice(0, 800),
          position: 0
        })
      }
    }
    return data
  }

  let epic: RequirementEpic | null = null
  let epicRef = -1
  let story: ParsedStory | null = null
  let acceptanceMode = false
  let epicBody: string[] = []

  const flushEpicBody = (): void => {
    if (!epic) return
    const body = epicBody.map(item => item.trim()).filter(Boolean)
    if (body.length) {
      const goalIndex = body.findIndex(item => /^目标\s*[：:]/.test(item))
      if (goalIndex >= 0) {
        const first = body[goalIndex].replace(/^目标\s*[：:]\s*/, '')
        // 目标支持多行：紧随其后的非元信息行算目标续行（#1.1 多行目标可回环）
        const continuation: string[] = []
        for (const line of body.slice(goalIndex + 1)) {
          if (EPIC_META.test(line)) break
          continuation.push(line)
        }
        epic.goal = [first, ...continuation].filter(Boolean).join('\n')
      } else {
        epic.goal = body[0]
      }
    }
    epicBody = []
  }

  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence
    if (!inFence) {
      const h3 = /^###\s+(.+?)\s*$/.exec(line)
      if (h3) {
        flushEpicBody()
        const parsed = titleFromIdLine(h3[1], EPIC_ID)
        if (!parsed.title) continue
        epic = { id: parsed.id ?? '', title: parsed.title, goal: '', priority: '', sceneId: null, position: data.epics.length }
        data.epics.push(epic)
        epicRef = data.epics.length - 1
        story = null
        acceptanceMode = false
        continue
      }
      const h4 = /^####\s+(.+?)\s*$/.exec(line)
      if (h4) {
        flushEpicBody()
        const parsed = titleFromIdLine(h4[1], STORY_ID)
        if (!parsed.title) continue
        story = {
          id: parsed.id ?? '',
          epicId: epic?.id ?? null,
          title: parsed.title,
          description: '',
          acceptance: [],
          priority: '',
          position: data.stories.length,
          ...(epicRef >= 0 ? { epicRef } : {})
        }
        data.stories.push(story)
        acceptanceMode = false
        continue
      }
    }
    const text = stripListMarker(line)
    if (!text) continue
    if (epic && !story) {
      const meta = EPIC_META.exec(text)
      if (meta) {
        const value = meta[2].trim()
        if (meta[1] === '目标') epic.goal = value
        else if (meta[1] === '优先级') epic.priority = value
        else if (meta[1] === '场景') epic.sceneId = matchId(SCENE_ID, value.split(/\s+/)[0] ?? '')
        continue
      }
      epicBody.push(text)
      continue
    }
    if (story) {
      if (ACCEPTANCE_HEAD.test(text)) {
        acceptanceMode = true
        continue
      }
      const acceptance = ACCEPTANCE_ITEM.exec(text)
      if (acceptance) {
        const value = acceptance[1].trim()
        if (value) story.acceptance.push(value)
        acceptanceMode = false
        continue
      }
      const priority = /^优先级\s*[：:]\s*(.*)$/.exec(text)
      if (priority) {
        story.priority = priority[1].trim()
        continue
      }
      if (acceptanceMode) {
        story.acceptance.push(text)
        continue
      }
      story.description = [story.description, text].filter(Boolean).join(' ').slice(0, 800)
      continue
    }
    if (!epic) {
      // 没有 ### Epic 标题：把顶层列表项当作 Epic + 同名 Story（遗留文档兜底）
      const parsed = titleFromIdLine(text, EPIC_ID)
      if (!parsed.title) continue
      epic = { id: parsed.id ?? '', title: parsed.title, goal: text, priority: '', sceneId: null, position: data.epics.length }
      data.epics.push(epic)
      epicRef = data.epics.length - 1
      const fallbackStory: ParsedStory = {
        id: '',
        epicId: epic.id || null,
        title: parsed.title,
        description: text,
        acceptance: [],
        priority: '',
        position: data.stories.length,
        epicRef
      }
      data.stories.push(fallbackStory)
    }
  }
  flushEpicBody()
  return data
}

/**
 * 重建结构化章节：解析 Markdown → 沿用/分配稳定 ID → 归档消失项 → 渲染回规范 Markdown。
 */
export function rebuildOutlineSection(
  kind: OutlineKind,
  markdown: string,
  previous: RequirementOutlineData | null,
  global: RequirementOutlineData,
  reservedIds?: Set<string>
): { data: RequirementOutlineData; global: RequirementOutlineData; warnings: OutlineWarning[] } {
  const parsed = parseOutlineMarkdown(kind, markdown)
  const ownIds = collectOutlineIds([global, previous])
  const used = new Set(ownIds)
  if (reservedIds) for (const id of reservedIds) used.add(id)
  const foreign = foreignReserved(ownIds, reservedIds)
  const globalEpics = mergeOutline([global]).epics
  const prevEpics = previous?.epics ?? []
  const epicIdByIndex: string[] = []

  parsed.epics.forEach((epic, index) => {
    const rawId = matchId(EPIC_ID, epic.id)
    const usableRaw = rawId && !foreign?.has(rawId) ? rawId : null
    const matchedId = usableRaw ?? findTitleMatch([globalEpics, prevEpics], epic.title)?.id ?? null
    const id = matchedId ?? nextOutlineId('EPIC', used)
    used.add(id)
    epicIdByIndex[index] = id
    epic.id = id
  })

  if (kind === 'epics') {
    const stories = parsed.stories as ParsedStory[]
    for (const item of stories) {
      if (item.epicRef !== undefined && epicIdByIndex[item.epicRef]) {
        item.epicId = epicIdByIndex[item.epicRef]
      } else if (item.epicId) {
        item.epicId = matchId(EPIC_ID, item.epicId)
      }
    }
  }

  return normalizeOutlineSection(parsed, { kind, previous, global, reservedIds })
}

/** 章节 Markdown 确定性渲染（含稳定 ID 小标签） */
export function renderOutlineMarkdown(kind: OutlineKind, data: RequirementOutlineData): string {
  const parts: string[] = []
  if (kind === 'scenes') {
    for (const scene of data.scenes.filter(item => !item.archived)) {
      parts.push(`### ${scene.id} ${scene.title}`)
      if (scene.description.trim()) parts.push(scene.description.trim())
    }
    return parts.join('\n\n')
  }

  const epics = data.epics.filter(item => !item.archived)
  const stories = data.stories.filter(item => !item.archived)
  const renderStory = (story: RequirementStory): string[] => {
    const body = [`#### ${story.id} ${story.title}`]
    if (story.description.trim()) body.push(story.description.trim())
    if (story.priority.trim()) body.push(`优先级：${story.priority.trim()}`)
    if (story.acceptance.length) {
      body.push(['验收标准：', ...story.acceptance.map(item => `- ${item}`)].join('\n'))
    }
    return body
  }

  for (const epic of epics) {
    parts.push(`### ${epic.id} ${epic.title}`)
    const meta: string[] = []
    if (epic.goal.trim()) meta.push(`目标：${epic.goal.trim()}`)
    if (epic.priority.trim()) meta.push(`优先级：${epic.priority.trim()}`)
    if (epic.sceneId) meta.push(`场景：${epic.sceneId}`)
    if (meta.length) parts.push(meta.join('\n'))
    for (const story of stories.filter(item => item.epicId === epic.id)) parts.push(...renderStory(story))
  }
  for (const story of stories.filter(item => !item.epicId)) parts.push(...renderStory(story))
  return parts.join('\n\n')
}

export function isStructuredKind(kind: unknown): kind is OutlineKind {
  return kind === 'scenes' || kind === 'epics'
}

export function outlineKindOf(kind: unknown): OutlineKind | null {
  return isStructuredKind(kind) ? asOutlineKind(kind) : null
}
