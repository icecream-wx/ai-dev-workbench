import { computed, isRef, type Ref } from 'vue'

/**
 * 将 reactive 或 ref 对象包装为 v-model 安全的 computed。
 * 
 * v-model:query="query" 展开为 @update:query="query = $event"，
 * 若 query 是 reactive proxy 则直接替换引用导致响应式断裂。
 * 
 * 此 composable 根据 source 类型做正确操作：
 * - reactive → Object.assign 原地合并，引用不变
 * - ref → 直接替换 ref.value（Vue 自动 reactive 包裹）
 * 
 * @example
 * ```ts
 * // reactive（最常见场景）
 * const query = reactive({ name: '', code: '' })
 * const queryModel = useMergeModel(query)
 * 
 * // ref（原生 v-model 本就可用，此 composable 同样兼容）
 * const query = ref({ name: '', code: '' })
 * const queryModel = useMergeModel(query)
 * ```
 * 
 * ```html
 * <!-- 一句 v-model，无需手动 @update:query -->
 * <PmSearch v-model:query="queryModel" />
 * ```
 */
export function useMergeModel<T extends Record<string, any>>(source: T | Ref<T>) {
  return computed({
    get: () => source,
    set: (val) => {
      if (val && typeof val === 'object') {
        if (isRef(source)) {
          ;(source as Ref<T>).value = val as T
        } else {
          Object.assign(source, val)
        }
      }
    }
  })
}
