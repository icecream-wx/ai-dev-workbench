import type { SpecEntity } from './spec-types'

/**
 * 设计阶段原型的实体引用解析。
 *
 * 原型只渲染当前页面的实体（`PrototypeCanvas` 直接传入 SpecEntity），跨模块
 * `moduleId:entityId` 引用在设计阶段没有模块工作区可查——抽取前经旧 workspace
 * store 查询 `moduleId = 'design'` 同样恒为空。这里保持同样的行为：
 * 外部引用只解析出 moduleId/entityId，不做实体查找。
 */
function isExternalRef(target: string): boolean {
  return typeof target === 'string' && target.includes(':')
}

export interface ParsedEntityRef {
  moduleId: string | null
  entityId: string
}

export function parseEntityRef(target: string): ParsedEntityRef {
  if (!isExternalRef(target)) return { moduleId: null, entityId: target }
  const index = target.indexOf(':')
  return { moduleId: target.slice(0, index), entityId: target.slice(index + 1) }
}

/** 跨模块实体查找：设计阶段无模块工作区，恒为空（关系子表/跨点图表因此不渲染） */
export function findEntityInModule(_moduleId: string, _entityId: string): SpecEntity | undefined {
  return undefined
}
