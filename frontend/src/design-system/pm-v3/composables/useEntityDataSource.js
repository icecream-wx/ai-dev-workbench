import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { cloneDeep, get, has, set, debounce } from 'lodash'
import { useDispatchProxy, useControllers } from './useDispatchProxy'

/**
 * 实体数据源 composable
 *
 * 通过 entity 名称从后端 LowcodeModelController 查询实体数据并归一化为选项列表，
 * 供 pm-select-entity 的 pc / mobile 两端复用，保证数据逻辑一致。
 *
 * API：LowcodeModelController.queryWithPage
 * 数据映射：label ← get(item, labelField), value ← get(item, valueField)
 * props 需包含：entity / labelField / valueField / queryCondition / sortFields /
 *               sortField / sortAscending / disabledField / filterable / maxOptions / selected / multiple
 */
export function useEntityDataSource(props, emit) {
  const options = ref([])
  const loading = ref(false)
  /** 是否已从后端加载过完整数据（用于 selected 回显时延迟加载） */
  const dataLoaded = ref(false)
  const searchKey = ref('')
  const cacheMap = new Map()
  const CACHE_MAX = 200
  /** dispatchProxy 的 response.end 清理句柄，组件卸载时需解除避免内存泄漏 */
  let endHandler = null

  const { dispatchProxy } = useDispatchProxy()
  const Controllers = useControllers()

  /**
   * 构建排序参数
   * 格式：field1:asc,field2:desc
   */
  function buildOrderPropertyNames() {
    const { sortFields, sortField, sortAscending } = props
    if (Array.isArray(sortFields) && sortFields.length > 0) {
      return sortFields
        .filter(item => item && item.field)
        .map(item => `${item.field}:${item.order === 'desc' ? 'desc' : 'asc'}`)
        .join(',')
    }
    if (sortField) {
      return `${sortField}:${sortAscending ? 'asc' : 'desc'}`
    }
    return ''
  }

  /**
   * 构建查询条件
   * 过滤 propertyValue 为 "null" 的条件项，注入搜索关键词与排序
   */
  function buildCondition() {
    const { queryCondition } = props
    if (!queryCondition) {
      const orderPropertyNames = buildOrderPropertyNames()
      return orderPropertyNames ? { orderPropertyNames } : null
    }
    const curCondition = cloneDeep(queryCondition)
    const finalItems = get(curCondition, 'and.items', [])
      .filter(c => c.propertyValue !== 'null')
    const orItems = get(curCondition, 'or.items', [])
      .filter(c => c.propertyValue !== 'null')

    if (searchKey.value) {
      finalItems.push({
        op: '%like%',
        propertyName: props.labelField,
        propertyValue: searchKey.value,
      })
    }
    if (finalItems.length > 0) set(curCondition, 'and.items', finalItems)
    if (orItems.length > 0) set(curCondition, 'or.items', orItems)

    const orderPropertyNames = buildOrderPropertyNames()
    if (orderPropertyNames) set(curCondition, 'orderPropertyNames', orderPropertyNames)

    const hasItems = get(curCondition, 'and.items', []).length > 0
      || get(curCondition, 'or.items', []).length > 0
      || orderPropertyNames
    return hasItems ? curCondition : null
  }

  /** 获取 label 值，兼容 datasource.js getLabel 逻辑 */
  function getLabel(item) {
    const labelField = props.labelField
    if (labelField) {
      return get(item, labelField, get(item, 'label', ''))
    }
    return item.name || item.label || ''
  }

  /** 获取 value 值，兼容 datasource.js getValue 逻辑 */
  function getValue(item) {
    const valueField = props.valueField
    if (valueField) {
      return get(item, valueField, null)
    }
    if (item?.code !== undefined) return item.code
    if (item?.value !== undefined) return item.value
    if (item?.id !== undefined) return item.id
    return null
  }

  /** 将 selected 对象规范化为 option 格式，兼容 { value, label } 或实体原始记录 */
  function toOption(item) {
    if (!item || typeof item !== 'object') return null
    const value = get(item, props.valueField, item.value)
    const label = get(item, props.labelField, item.label)
    if (value === undefined || value === null) return null
    return {
      ...item,
      label,
      value,
      disabled: get(item, props.disabledField || 'disabled'),
      _data: item,
    }
  }

  /** 用 selected 对象回显选项列表；有有效 selected 返回 true，否则返回 false */
  function seedOptionsFromSelected() {
    const sel = props.selected
    const arr = props.multiple ? (Array.isArray(sel) ? sel : []) : (sel ? [sel] : [])
    const seeded = arr.map(toOption).filter(Boolean)
    if (seeded.length) {
      options.value = seeded
      return true
    }
    return false
  }

  function getCacheKey() {
    return JSON.stringify({
      entity: props.entity,
      queryCondition: props.queryCondition,
      sortFields: props.sortFields,
      sortField: props.sortField,
      sortAscending: props.sortAscending,
    })
  }

  function setCache(key, data) {
    if (cacheMap.size >= CACHE_MAX) {
      const firstKey = cacheMap.keys().next().value
      cacheMap.delete(firstKey)
    }
    cacheMap.set(key, data)
  }

  /**
   * 从后端查询实体数据
   */
  async function fetchEntityData() {
    if (!props.entity) {
      options.value = []
      return
    }

    if (!searchKey.value) {
      const key = getCacheKey()
      if (cacheMap.has(key)) {
        options.value = cacheMap.get(key)
        dataLoaded.value = true
        return
      }
    }

    loading.value = true
    try {
      const response = dispatchProxy(
        Controllers.LowcodeModelController.queryWithPage,
        {
          params: {
            entityName: props.entity,
            pageIndex: 0,
            pageSize: props.filterable ? props.maxOptions : -1,
          },
          payload: {
            condition: buildCondition(),
          },
        },
      )
      if (response?.end) {
        endHandler = () => { loading.value = false }
        response.end(endHandler)
      }
      const result = await response
      const data = has(result, 'error') ? result.data : result
      if (data) {
        const mapped = Array.isArray(data.data)
          ? data.data.map(item => ({
              label: getLabel(item),
              value: getValue(item),
              id: item.id,
              disabled: get(item, props.disabledField || 'disabled'),
              _data: cloneDeep(item),
            }))
          : []
        options.value = mapped
        if (!searchKey.value) {
          setCache(getCacheKey(), mapped)
          dataLoaded.value = true
        }
      }
    } catch (e) {
      console.error('[PmSelectEntity] fetch entity error:', e)
      options.value = []
    } finally {
      loading.value = false
    }
  }

  /** 防抖动态搜索 */
  const debouncedFetch = debounce(fetchEntityData, 300)

  /** 搜索关键词变化：有值时防抖动态查询，清空时重新加载全量 */
  function handleSearch(key) {
    searchKey.value = key
    if (key) {
      debouncedFetch()
    } else {
      fetchEntityData()
    }
  }

  /** 清空选项并标记未加载，供 entity / queryCondition / 排序参数变化时复用 */
  function reset() {
    options.value = []
    dataLoaded.value = false
  }

  watch(() => props.entity, () => { reset(); fetchEntityData() })
  watch(() => props.queryCondition, () => { reset(); fetchEntityData() }, { deep: true })
  watch(() => props.sortFields, () => { reset(); fetchEntityData() }, { deep: true })
  watch(() => [props.sortField, props.sortAscending], () => { reset(); fetchEntityData() })

  /** 组件卸载时清理 dispatchProxy 的 end 回调，防止内存泄漏 */
  onBeforeUnmount(() => {
    if (endHandler) {
      endHandler()
      endHandler = null
    }
  })

  /** 挂载时：有 selected 回显则用 selected 直接回显，暂不请求；否则首次加载实体数据 */
  onMounted(() => {
    if (seedOptionsFromSelected()) {
      dataLoaded.value = false
    } else {
      fetchEntityData()
    }
  })

  return { options, loading, dataLoaded, searchKey, fetchEntityData, handleSearch, reset }
}
