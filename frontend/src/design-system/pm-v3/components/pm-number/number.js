import Decimal from 'decimal.js'
import { ref, computed, watch, nextTick, onMounted, getCurrentInstance } from 'vue'
import { getLowCodePreferenceObject } from '../../utils/util'

export function useNumber(props, emit) {
  const instance = getCurrentInstance()
  const localValue = ref(null)
  const isLeave = ref(true)
  const isFocused = ref(false)
  const numberRef = ref(null)

  const attrs = computed(() => instance?.proxy?.$attrs || {})

  const formatNullValue = computed(() => {
    const preferenceObject = getLowCodePreferenceObject(instance?.proxy)
    return preferenceObject?.formConf?.formatNullValue || ''
  })

  const disabledOrReadonly = computed(() => !!attrs.value?.readonly || !!attrs.value?.disabled)

  const fixShow = computed(() => {
    if (attrs.value?.disabled || attrs.value?.readonly) {
      const newValue = props.modelValue ? props.modelValue * 1 : props.modelValue
      if (!newValue) {
        if (newValue === 0) {
          return !(props.zeroSetting && ['noshow', 'custom'].includes(props.zeroSetting))
        }
        return false
      }
      return true
    }
    return true
  })

  const numberPrecision = (value, n) => {
    if (value || value === 0) {
      const number = new Decimal(value)
      let result = ''
      if (number.isFinite()) {
        result = number.toDP(n, Decimal.ROUND_HALF_UP)
      } else {
        result = new Decimal('NaN')
      }
      result = result.toFixed(n)
      const rs = result.indexOf('.')
      if (n !== 0 && rs < 0) {
        result += '.'
      }
      for (let i = result.length - result.indexOf('.'); i <= n; i++) {
        result += '0'
      }
      return result
    }
    return null
  }

  const thousandBitSign = (num) => {
    if (!num && num !== 0) return null
    const str = num.toString()
    const hasNegativeSign = str.startsWith('-')
    const numStr = hasNegativeSign ? str.slice(1) : str
    const parts = numStr.split('.')
    let integerPart = parts[0]
    const decimalPart = parts.length > 1 ? '.' + parts[1] : ''
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return `${hasNegativeSign ? '-' : ''}${integerPart}${decimalPart}`
  }

  const million = (num) => {
    if (!num && num !== 0) return null
    const str = num.toString()
    const hasNegativeSign = str.startsWith('-')
    const numStr = hasNegativeSign ? str.slice(1) : str
    const parts = numStr.split('.')
    let integerPart = parts[0]
    const decimalPart = parts.length > 1 ? '.' + parts[1] : ''
    integerPart = integerPart.replace(/\B(?=(\d{4})+(?!\d))/g, ',')
    return `${hasNegativeSign ? '-' : ''}${integerPart}${decimalPart}`
  }

  const delFormatSetting = (num) => {
    if (num === null || (num + '').trim() === '') return null
    if (typeof num !== 'number') {
      num = num.replace(/,/gi, '')
    }
    return num && (num + '').split('.')[0].length > 15 ? num : num * 1
  }

  const toChangeValue = (val) => {
    if (props.PositiveColor || props.minusColor) {
      const inputEl = numberRef.value?.$refs?.input
      if (inputEl) {
        if (val >= 0 || (val && val.indexOf('-') === -1)) {
          inputEl.style = `color: ${props.PositiveColor} !important;`
        } else {
          inputEl.style = `color: ${props.minusColor} !important;`
        }
      }
    }
    let newValue = val
    if (newValue && (props.formatSetting === 'thousand' || props.formatSetting === 'million')) {
      newValue = delFormatSetting(newValue)
    }
    newValue = newValue || newValue === 0 ? (newValue && (newValue + '').split('.')[0].length > 15 ? newValue : newValue * 1) : null
    emit('update:modelValue', newValue)
  }

  const dealNumber = (value) => {
    let newValue = value
    if (props.formatSetting === 'thousand' || props.formatSetting === 'million') {
      newValue = delFormatSetting(newValue)
    }
    if (props.precision || props.precision === 0) {
      newValue = numberPrecision(newValue, props.precision * 1)
    }
    if (props.formatSetting === 'million') {
      newValue = million(newValue)
    }
    if (props.formatSetting === 'thousand') {
      newValue = thousandBitSign(newValue)
    }
    localValue.value = newValue
    toChangeValue(localValue.value)
  }

  const EditFunc = (type) => {
    if (type === 'blur') {
      isFocused.value = false
    } else {
      isFocused.value = true
    }
    isLeave.value = !isLeave.value
    if (isLeave.value) {
      dealNumber(localValue.value)
    } else {
      localValue.value = delFormatSetting(localValue.value)
    }
  }

  const handleClear = () => {
    localValue.value = ''
    emit('update:modelValue', '')
  }

  watch(() => props.modelValue, (val) => {
    if (val || val == 0) {
      if (disabledOrReadonly.value && val == 0 && props.zeroSetting && ['noshow', 'custom'].includes(props.zeroSetting)) {
        localValue.value = props.zeroSetting === 'noshow' ? null : props.zeroSettingCustom
      } else {
        let newValue = val
        if (typeof newValue === 'number') {
          newValue = newValue + ''
        }
        if (isLeave.value) {
          newValue = newValue.replace(/[^0-9.,-]/g, '')
          dealNumber(newValue)
        }
      }
    } else {
      if (disabledOrReadonly.value) {
        localValue.value = props.nullSetting === 'custom' ? props.nullSettingCustom : formatNullValue.value
      } else {
        localValue.value = null
        emit('update:modelValue', null)
      }
    }
  }, { immediate: true })

  onMounted(() => {
    nextTick(() => {
      if (disabledOrReadonly.value && !(props.modelValue || props.modelValue == 0)) {
        localValue.value = props.nullSetting === 'custom' ? props.nullSettingCustom : formatNullValue.value
      }
    })
  })

  return {
    localValue,
    isLeave,
    isFocused,
    numberRef,
    fixShow,
    disabledOrReadonly,
    EditFunc,
    handleClear,
    dealNumber,
    delFormatSetting,
  }
}
