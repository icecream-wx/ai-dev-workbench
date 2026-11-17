/**
 * 设计 → 开发交接包规模识别 + 建议分阶段（I-09b-1 / U6）
 *
 * 纯函数，无 IO：从 DesignHandoffBundle + 文本字节数确定性计算规模，
 * 并在命中阈值时派生阶段草案。不调用模型，不读写数据库。
 *
 * U7-1：草案同时带稳定 `key`（base / epic:<EPIC-ID> / other / pageSets:<PS-CODE> / all），
 * 写入 `manifest.phases` 供开发阶段按需生成；`04-PLAN.md` 渲染不使用 key。
 * 阶段标题只使用外部稳定编号（EPIC/STORY/PS/PAGE），不出现工作台内部 ID。
 */
import type {
  DesignHandoffBundle,
  DesignHandoffPageSet,
  DesignHandoffScale,
  DesignHandoffScaleCounts,
  DesignHandoffScaleTrigger
} from './design-types'

/** 触发阈值（任一命中即视为大交接包） */
export const HANDOFF_SCALE_THRESHOLDS = {
  stories: 10,
  pages: 12,
  textBytes: 102400
} as const

export type DesignHandoffPhaseKind = 'base' | 'module' | 'epic' | 'other' | 'pageSets' | 'all'

export interface DesignHandoffPhaseDraft {
  /**
   * 稳定阶段 key（U7-1 / M6b）：
   * - `base` / `other` / `all`
   * - `module:<MOD-KEY>`（模块里程碑，不单独开会话）
   * - `epic:<EPIC-ID>`
   * - `other:<MOD-KEY>` / `pageSets:<MOD-KEY>:<PS-CODE>` / `all:<MOD-KEY>`（模块内）
   */
  key: string
  kind: DesignHandoffPhaseKind
  title: string
  goal: string
  storyIds: string[]
  pageSetCodes: string[]
  pageCodes: string[]
  note?: string
  /** M6b：模块归属（应用级 base/other/all 为 undefined） */
  moduleId?: string
  moduleKey?: string
  /** M6b：父模块 key（模块内 Epic/other/pageSets/all） */
  parentKey?: string
}

/** 无 Epic 时按页面集分组，每组 2—3 个（取 3） */
const PAGE_SET_GROUP_SIZE = 3

function countsOf(bundle: DesignHandoffBundle): DesignHandoffScaleCounts {
  const input = bundle.requirements.input
  let fields = 0
  let relations = 0
  for (const entity of bundle.entities) {
    fields += entity.fields.length
    relations += entity.relations.length
  }
  let pages = 0
  let prototypes = 0
  for (const set of bundle.pageSets) {
    pages += set.pages.length
    prototypes += set.pages.filter(page => Boolean(page.prototypePath)).length
  }
  return {
    scenes: input.scenes.length,
    epics: input.epics.length,
    stories: input.stories.length,
    entities: bundle.entities.length,
    fields,
    relations,
    pageSets: bundle.pageSets.length,
    pages,
    prototypes
  }
}

function addUnique(target: string[], values: string[]): void {
  for (const value of values) {
    if (!target.includes(value)) target.push(value)
  }
}

function storyIdsOfSets(sets: DesignHandoffPageSet[]): string[] {
  const ids: string[] = []
  for (const set of sets) addUnique(ids, set.storyIds)
  return ids
}

/** 阶段草案派生（仅在命中阈值时调用）；单模块保持 U7 平铺结构（零回归） */
function deriveFlatPhases(bundle: DesignHandoffBundle): DesignHandoffPhaseDraft[] {
  const epics = bundle.requirements.input.epics
  const phases: DesignHandoffPhaseDraft[] = [
    {
      key: 'base',
      kind: 'base',
      title: '数据模型与基础框架',
      goal: '建表/调整实体，打通 App Shell、导航与公共组件',
      storyIds: [],
      pageSetCodes: [],
      pageCodes: [],
      note: '参考 `02-DATA-MODEL.md` / `schema.sql`；先完成应用壳、导航与公共组件'
    }
  ]

  if (epics.length) {
    const epicIds = new Set(epics.map(epic => epic.id))
    for (const epic of epics) {
      const sets = bundle.pageSets.filter(set => set.epicId === epic.id)
      const pageSetCodes: string[] = []
      const pageCodes: string[] = []
      for (const set of sets) {
        pageSetCodes.push(set.code)
        pageCodes.push(...set.pages.map(page => page.code))
      }
      const draft: DesignHandoffPhaseDraft = {
        key: `epic:${epic.id}`,
        kind: 'epic',
        title: `${epic.id} ${epic.title}`,
        goal: epic.goal || epic.title,
        storyIds: epic.stories.map(story => story.id),
        pageSetCodes,
        pageCodes
      }
      if (!sets.length) draft.note = '无页面集；按 Story 实现接口/后端能力'
      phases.push(draft)
    }

    // 未归属当前 Epic 的页面集（含 epicId=null 或引用不存在的 Epic）
    const unassigned = bundle.pageSets.filter(set => !set.epicId || !epicIds.has(set.epicId))
    if (unassigned.length) {
      const pageSetCodes: string[] = []
      const pageCodes: string[] = []
      for (const set of unassigned) {
        pageSetCodes.push(set.code)
        pageCodes.push(...set.pages.map(page => page.code))
      }
      phases.push({
        key: 'other',
        kind: 'other',
        title: '其他页面与收尾',
        goal: '完成未归属 Epic 的页面集与整体收尾',
        storyIds: storyIdsOfSets(unassigned),
        pageSetCodes,
        pageCodes,
        note: '未归属 Epic 的页面集；完成收尾与整体验收'
      })
    }
    return phases
  }

  if (bundle.pageSets.length) {
    for (let index = 0; index < bundle.pageSets.length; index += PAGE_SET_GROUP_SIZE) {
      const group = bundle.pageSets.slice(index, index + PAGE_SET_GROUP_SIZE)
      const first = group[0]
      const pageSetCodes: string[] = []
      const pageCodes: string[] = []
      for (const set of group) {
        pageSetCodes.push(set.code)
        pageCodes.push(...set.pages.map(page => page.code))
      }
      const draft: DesignHandoffPhaseDraft = {
        key: `pageSets:${first.code}`,
        kind: 'pageSets',
        title: group.length > 1 ? `${first.code} ${first.title}等 ${group.length} 个页面集` : `${first.code} ${first.title}`,
        goal: `实现 ${pageSetCodes.join('、')} 的列表/表单/详情主流程`,
        storyIds: storyIdsOfSets(group),
        pageSetCodes,
        pageCodes
      }
      if (group.length === 1 && first.description) draft.note = first.description
      phases.push(draft)
    }
    return phases
  }

  phases.push({
    key: 'all',
    kind: 'all',
    title: '全量实现',
    goal: '按交接包全量实现数据模型、页面与验收',
    storyIds: bundle.requirements.input.stories.map(story => story.id),
    pageSetCodes: [],
    pageCodes: [],
    note: '交接包未包含 Epic/页面集；按 `01-REQUIREMENTS.md` / `03-PAGES.md` 全量实现'
  })
  return phases
}

/**
 * M6b：多模块两层阶段（模块里程碑 → 模块内 Epic/other/pageSets/all）。
 * 模块阶段只做分组/里程碑（不单独开会话、不调模型摘要）；`phaseCount` 只统计可执行阶段。
 */
function deriveModulePhases(bundle: DesignHandoffBundle): DesignHandoffPhaseDraft[] {
  const phases: DesignHandoffPhaseDraft[] = [
    {
      key: 'base',
      kind: 'base',
      title: '数据模型与基础框架',
      goal: '建表/调整实体，打通 App Shell、导航与公共组件',
      storyIds: [],
      pageSetCodes: [],
      pageCodes: [],
      note: '参考 `02-DATA-MODEL.md` / `schema.sql`；先完成应用壳、导航与公共组件'
    }
  ]

  for (const module of bundle.modules) {
    const input = module.requirements.input
    const moduleKey = module.key
    const moduleBase: Pick<DesignHandoffPhaseDraft, 'moduleId' | 'moduleKey' | 'parentKey'> = {
      moduleId: module.id,
      moduleKey,
      parentKey: moduleKey
    }
    const allPageSetCodes: string[] = []
    const allPageCodes: string[] = []
    for (const set of module.pageSets) {
      allPageSetCodes.push(set.code)
      allPageCodes.push(...set.pages.map(page => page.code))
    }

    // 模块里程碑：聚合模块内全部 Story/页面集/页面，不单独开会话
    phases.push({
      key: `module:${moduleKey}`,
      kind: 'module',
      title: `${moduleKey} ${module.title}`,
      goal: `模块「${module.title}」：完成该模块需求与页面（分组/里程碑，不单独开会话）`,
      storyIds: input.stories.map(story => story.id),
      pageSetCodes: allPageSetCodes,
      pageCodes: allPageCodes,
      note: `模块里程碑：${input.epics.length} 个 Epic / ${input.stories.length} Story / ${allPageCodes.length} 页面`,
      moduleId: module.id,
      moduleKey
    })

    const epicIds = new Set(input.epics.map(epic => epic.id))
    for (const epic of input.epics) {
      const sets = module.pageSets.filter(set => set.epicId === epic.id)
      const pageSetCodes: string[] = []
      const pageCodes: string[] = []
      for (const set of sets) {
        pageSetCodes.push(set.code)
        pageCodes.push(...set.pages.map(page => page.code))
      }
      const draft: DesignHandoffPhaseDraft = {
        key: `epic:${epic.id}`,
        kind: 'epic',
        title: `${epic.id} ${epic.title}`,
        goal: epic.goal || epic.title,
        storyIds: epic.stories.map(story => story.id),
        pageSetCodes,
        pageCodes,
        ...moduleBase
      }
      if (!sets.length) draft.note = '无页面集；按 Story 实现接口/后端能力'
      phases.push(draft)
    }

    const unassigned = module.pageSets.filter(set => !set.epicId || !epicIds.has(set.epicId))

    if (!input.epics.length) {
      if (module.pageSets.length) {
        // 无 Epic：模块内按页面集分组（每 3 个一组），key 带模块前缀保证唯一
        for (let index = 0; index < module.pageSets.length; index += PAGE_SET_GROUP_SIZE) {
          const group = module.pageSets.slice(index, index + PAGE_SET_GROUP_SIZE)
          const first = group[0]
          const pageSetCodes: string[] = []
          const pageCodes: string[] = []
          for (const set of group) {
            pageSetCodes.push(set.code)
            pageCodes.push(...set.pages.map(page => page.code))
          }
          const draft: DesignHandoffPhaseDraft = {
            key: `pageSets:${moduleKey}:${first.code}`,
            kind: 'pageSets',
            title:
              group.length > 1
                ? `${moduleKey} ${first.code} ${first.title}等 ${group.length} 个页面集`
                : `${moduleKey} ${first.code} ${first.title}`,
            goal: `实现 ${pageSetCodes.join('、')} 的列表/表单/详情主流程`,
            storyIds: storyIdsOfSets(group),
            pageSetCodes,
            pageCodes,
            ...moduleBase
          }
          if (group.length === 1 && first.description) draft.note = first.description
          phases.push(draft)
        }
      } else {
        phases.push({
          key: `all:${moduleKey}`,
          kind: 'all',
          title: `${moduleKey} 全量实现`,
          goal: '按该模块交接文档全量实现数据模型、页面与验收',
          storyIds: input.stories.map(story => story.id),
          pageSetCodes: [],
          pageCodes: [],
          note: '模块无 Epic/页面集；按 `01-REQUIREMENTS.md` / `03-PAGES.md` 全量实现',
          ...moduleBase
        })
      }
      continue
    }

    if (unassigned.length) {
      const pageSetCodes: string[] = []
      const pageCodes: string[] = []
      for (const set of unassigned) {
        pageSetCodes.push(set.code)
        pageCodes.push(...set.pages.map(page => page.code))
      }
      phases.push({
        key: `other:${moduleKey}`,
        kind: 'other',
        title: `${moduleKey} 其他页面与收尾`,
        goal: '完成该模块未归属 Epic 的页面集与整体收尾',
        storyIds: storyIdsOfSets(unassigned),
        pageSetCodes,
        pageCodes,
        note: '模块内未归属 Epic 的页面集；完成收尾与整体验收',
        ...moduleBase
      })
    }
  }
  return phases
}

function derivePhases(bundle: DesignHandoffBundle): DesignHandoffPhaseDraft[] {
  const moduleCount = Array.isArray(bundle.modules) ? bundle.modules.length : 0
  return moduleCount > 1 ? deriveModulePhases(bundle) : deriveFlatPhases(bundle)
}

/**
 * 规模评估：`textBytes` 由调用方用“建议章节渲染前”的文本测量传入（避免循环）。
 * normal 时不派生阶段（phaseCount=0、derivedFrom='none'）。
 */
export function assessHandoffScale(
  bundle: DesignHandoffBundle,
  textBytes: number
): { scale: DesignHandoffScale; phases: DesignHandoffPhaseDraft[] } {
  const counts = countsOf(bundle)
  const thresholds = {
    stories: HANDOFF_SCALE_THRESHOLDS.stories,
    pages: HANDOFF_SCALE_THRESHOLDS.pages,
    textBytes: HANDOFF_SCALE_THRESHOLDS.textBytes
  }
  const bytes = Number.isFinite(textBytes) && textBytes > 0 ? Math.trunc(textBytes) : 0
  const triggers: DesignHandoffScaleTrigger[] = []
  if (counts.stories >= thresholds.stories) {
    triggers.push({ metric: 'stories', value: counts.stories, threshold: thresholds.stories })
  }
  if (counts.pages >= thresholds.pages) {
    triggers.push({ metric: 'pages', value: counts.pages, threshold: thresholds.pages })
  }
  if (bytes >= thresholds.textBytes) {
    triggers.push({ metric: 'textBytes', value: bytes, threshold: thresholds.textBytes })
  }

  const suggested = triggers.length > 0
  if (!suggested) {
    return {
      scale: {
        level: 'normal',
        suggested: false,
        counts,
        textBytes: bytes,
        thresholds,
        triggers,
        phaseCount: 0,
        modulePhaseCount: 0,
        derivedFrom: 'none'
      },
      phases: []
    }
  }

  const phases = derivePhases(bundle)
  const executable = phases.filter(phase => phase.kind !== 'module')
  const modulePhaseCount = phases.length - executable.length
  const derivedFrom = counts.epics > 0 ? 'epics' : counts.pageSets > 0 ? 'pageSets' : 'none'
  return {
    scale: {
      level: 'large',
      suggested: true,
      counts,
      textBytes: bytes,
      thresholds,
      triggers,
      phaseCount: executable.length,
      modulePhaseCount,
      derivedFrom
    },
    phases
  }
}

/** `/1024` 向上取整的 KB 文本（与前端标签口径一致；仅用于文档） */
export function handoffScaleKb(textBytes: number): number {
  const bytes = Number.isFinite(textBytes) && textBytes > 0 ? textBytes : 0
  return Math.ceil(bytes / 1024)
}

/** 规模摘要：`12 Story / 14 页面 / 123 KB` */
export function handoffScaleSummary(scale: DesignHandoffScale): string {
  return `${scale.counts.stories} Story / ${scale.counts.pages} 页面 / ${handoffScaleKb(scale.textBytes)} KB`
}

/** 命中项摘要：`Story ≥ 10、页面 ≥ 12、文本 ≥ 100 KB` */
export function handoffScaleTriggerText(scale: DesignHandoffScale): string {
  return scale.triggers
    .map(trigger => {
      if (trigger.metric === 'stories') return `Story ≥ ${trigger.threshold}`
      if (trigger.metric === 'pages') return `页面 ≥ ${trigger.threshold}`
      return `文本 ≥ ${Math.round(trigger.threshold / 1024)} KB`
    })
    .join('、')
}
