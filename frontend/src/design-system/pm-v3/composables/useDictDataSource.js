import { ref, watch, onMounted, onBeforeUnmount, getCurrentInstance } from 'vue'
import { cloneDeep, has } from 'lodash'
import { useDispatchProxy, useControllers } from './useDispatchProxy'
import { findAppName, getQueryVariable } from '../utils/util'

/**
 * 字典数据源 composable
 *
 * 通过 dictTypeCode 从后端 DictEntryController 加载字典条目并归一化为选项列表，
 * 供 pm-select-dict 的 pc / mobile 两端复用，保证数据逻辑一致。
 *
 * 数据映射：label ← item.name, value ← item.code, color ← item.extend
 * props 需包含：dictTypeCode / parentCode / disableWhenParentEmpty / multiple / selected
 */
export function useDictDataSource(props, emit) {
  const options = ref([])
  const loading = ref(false)
  /** 是否已从后端加载过完整字典数据（用于 selected 回显时延迟加载） */
  const dataLoaded = ref(false)
  const cacheMap = new Map()
  const CACHE_MAX = 200
  /** dispatchProxy 的 response.end 清理句柄，组件卸载时需解除避免内存泄漏 */
  let endHandler = null

  const { dispatchProxy } = useDispatchProxy()
  const Controllers = useControllers()

  /** 获取当前应用的 appName：URL 参数优先，其次组件树上溯 */
  function getAppName() {
    return getQueryVariable('appName') || findAppName(getCurrentInstance()?.proxy)
  }

  function getCacheKey() {
    return JSON.stringify({
      dictTypeCode: props.dictTypeCode,
      parentCode: props.parentCode,
      appName: getAppName(),
    })
  }

  function setCache(key, data) {
    if (cacheMap.size >= CACHE_MAX) {
      const firstKey = cacheMap.keys().next().value
      cacheMap.delete(firstKey)
    }
    cacheMap.set(key, data)
  }

  /** 判断父级字典编码是否为空 */
  function isParentCodeEmpty(pc) {
    return !pc || pc === '' || pc === 'null' || pc === 'undefined'
  }

  /** 将 selected 对象规范化为 option 格式，兼容 { value, label } 或字典原始条目 { code, name, extend } */
  function toOption(item) {
    if (!item || typeof item !== 'object') return null
    const value = item.value !== undefined && item.value !== null ? item.value : item.code
    const label = item.label !== undefined && item.label !== null ? item.label : item.name
    if (value === undefined || value === null) return null
    return {
      label,
      value,
      color: item.color ?? item.extend,
      disabled: item.disabled,
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

  /**
   * 从后端加载字典数据
   * 调用 DictEntryController.queryDictEntrysByCriteria，
   * 按 dictTypeCode + parentCode 过滤，sortBy 升序排列。
   */
  async function fetchDictData() {
    if (!props.dictTypeCode) {
      options.value = []
      return
    }
    // disableWhenParentEmpty 且无 parentCode 时不请求数据
    if (props.disableWhenParentEmpty && isParentCodeEmpty(props.parentCode)) {
      options.value = []
      return
    }

    const key = getCacheKey()
    if (cacheMap.has(key)) {
      options.value = cacheMap.get(key)
      dataLoaded.value = true
      return
    }

    loading.value = true
    try {
      const response = dispatchProxy(
        Controllers.DictEntryController.queryDictEntrysByCriteria,
        {
          dictTypeCode: props.dictTypeCode,
          parentCode: props.parentCode || undefined,
          pageSize: 0,
          pageIndex: 0,
          orderFields: 'sortBy',
          orderDirection: 'ASC',
          __apiPrefix: '/' + (getAppName() || 'afc'),
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
              label: item.name,
              value: item.code,
              color: item.extend,
              disabled: item.disabled,
              _data: cloneDeep(item),
            }))
          : []
        options.value = mapped
        setCache(key, mapped)
        dataLoaded.value = true
      }
    } catch (e) {
      console.error('[PmSelectDict] fetch dict error:', e)
      options.value = []
    } finally {
      loading.value = false
    }
  }

  /** 清空选项并标记未加载，供 dictTypeCode / parentCode 变化时复用 */
  function reset() {
    options.value = []
    dataLoaded.value = false
  }

  /** dictTypeCode 变化时重新加载选项 */
  watch(() => props.dictTypeCode, () => {
    reset()
    fetchDictData()
  })
  /** parentCode 变化时清空选中值并重新加载选项（支持联动） */
  watch(() => props.parentCode, (pc) => {
    reset()
    emit('update:modelValue', props.multiple ? [] : null)
    if (props.disableWhenParentEmpty && isParentCodeEmpty(pc)) return
    fetchDictData()
  })

  /** 组件卸载时清理 dispatchProxy 的 end 回调，防止内存泄漏 */
  onBeforeUnmount(() => {
    if (endHandler) {
      endHandler()
      endHandler = null
    }
  })

  /** 挂载时：有 selected 回显则用 selected 直接回显，暂不请求；否则首次加载字典数据 */
  onMounted(() => {
    if (seedOptionsFromSelected()) {
      dataLoaded.value = false
    } else {
      fetchDictData()
    }
  })

  return { options, loading, dataLoaded, fetchDictData, reset }
}
