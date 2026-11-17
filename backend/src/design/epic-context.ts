/**
 * D-RMP：设计输入中的 Epic/场景节点（按 Epic 生成实体/页面集的唯一入口）
 *
 * - 正常设计输入：节点来自 `input.epics`（id = EPIC-xxx，页面集 epicId = EPIC-xxx）；
 * - fallback（设计输入没有 Epic）：节点来自 `input.scenes`（id = SCENE-xxx，页面集 epicId = null + sceneKey = SCENE-xxx）；
 * - 未归属 Story（`epicId === null`）归到 fallback 场景节点下，用于覆盖度/生成引用。
 */
import type { DesignInputStory, DesignPageSet, DesignProjectPayload } from './types'

export interface DesignEpicNode {
  /** EPIC-xxx 或 SCENE-xxx（fallback） */
  id: string
  title: string
  goal: string
  priority: string
  sceneId: string | null
  /** true = fallback 场景节点（页面集 epicId=null、sceneKey=SCENE-xxx） */
  isScene: boolean
  stories: DesignInputStory[]
}

/** 从设计输入解析 Epic/场景节点；不存在返回 null（不报错，由调用方决定 404/空态） */
export function findEpicNode(project: DesignProjectPayload, epicId: string): DesignEpicNode | null {
  const input = project.input
  const key = String(epicId ?? '').trim().toUpperCase()
  if (!input || !key) return null
  const epic = input.epics.find(item => item.id === key)
  if (epic) {
    return {
      id: epic.id,
      title: epic.title,
      goal: epic.goal,
      priority: epic.priority,
      sceneId: epic.sceneId,
      isScene: false,
      stories: epic.stories
    }
  }
  // 只有完全 fallback（没有任何 Epic）时才允许用场景节点，避免把 SCENE 当成 Epic 的替代
  if (input.epics.length) return null
  const scene = input.scenes.find(item => item.id === key)
  if (!scene) return null
  return {
    id: scene.id,
    title: scene.title,
    goal: scene.description,
    priority: '',
    sceneId: scene.id,
    isScene: true,
    stories: input.stories.filter(story => !story.epicId)
  }
}

/** 节点覆盖的需求稳定 ID（epic/scene + 其 Stories） */
export function epicRefsOf(node: DesignEpicNode): string[] {
  return Array.from(new Set([node.id, ...node.stories.map(story => story.id)]))
}

/** 页面集是否属于该节点：Epic 用 epicId；fallback 场景用 epicId=null + sceneKey */
export function pageSetBelongsToEpic(
  set: Pick<DesignPageSet, 'epicId' | 'sceneKey'>,
  node: DesignEpicNode
): boolean {
  if (node.isScene) return !set.epicId && set.sceneKey === node.id
  return set.epicId === node.id
}
