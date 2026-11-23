import { computed, watch } from 'vue'

let _uid = 0

export function useSelectSelected(props, emit, optionsRef, valueField, labelField, multiple) {
  const uid = ++_uid
  let depth = 0

  const getValueField = () => (typeof valueField === 'function' ? valueField() : valueField)
  const getLabelField = () => (typeof labelField === 'function' ? labelField() : labelField)
  const isMultiple = () => (typeof multiple === 'function' ? multiple() : multiple)

  const selected = computed({
    get: () => props.selected,
    set: (val) => emit('update:selected', val),
  })

  function matchFromOptions(val) {
    if (val == null || val === '') return isMultiple() ? [] : {}
    const vf = getValueField()
    if (isMultiple() && Array.isArray(val)) {
      return val.map(v => {
        const o = optionsRef.value.find(o => o[vf] === v)
        return o ? o._data : o
      }).filter(Boolean)
    }
    const o = optionsRef.value.find(o => o[vf] === val)
    return o ? o._data : null
  }

  watch(() => props.modelValue, (val) => {
    depth++
    console.log('[useSelectSelected#%d] watch1 depth=%d val=%s', uid, depth, val)
    if (depth > 10) {
      console.error('[useSelectSelected#%d] 检测到循环，终止', uid)
      depth--
      return
    }
    selected.value = matchFromOptions(val)
    depth--
  })

  watch(optionsRef, (opts) => {
    depth++
    console.log('[useSelectSelected#%d] watch2 depth=%d opts.length=%d', uid, depth, opts.length)
    if (depth > 10) {
      console.error('[useSelectSelected#%d] 检测到循环，终止', uid)
      depth--
      return
    }
    if (opts.length > 0) {
      selected.value = matchFromOptions(props.modelValue)
    }
    depth--
  })

  const viewLabel = computed(() => {
    const sel = props.selected ?? selected.value
    if (sel == null) return ''
    const lf = getLabelField()
    if (Array.isArray(sel)) {
      return sel.map(item => item?.[lf]).filter(Boolean).join('、')
    }
    return sel?.[lf] || ''
  })

  function clearSelected() {
    selected.value = isMultiple() ? [] : {}
  }

  return { selected, viewLabel, clearSelected }
}
