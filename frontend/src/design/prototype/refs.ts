import type { SpecEntity } from './spec-types'

/**
 * 设计阶段原型的实体引用解析。
 *
 * 原型只渲染当前页面的实体（`PrototypeCanvas` 直接传入 SpecEntity）；设计阶段
 * 跨实体引用不做实体查找（保持旧行为）。
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

/** 跨实体查找：设计阶段不做实体查找，恒为空（关系子表/跨点图表因此不渲染） */
export function findEntityInModule(_moduleId: string, _entityId: string): SpecEntity | undefined {
  return undefined
}
