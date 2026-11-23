import { getCurrentInstance } from 'vue'
import { getLowCodePreferenceObject } from '../utils/util'

export function useFormatNullValue() {
  const inst = getCurrentInstance()
  const preferenceObject = getLowCodePreferenceObject(inst?.proxy)
  const formatNullValue = preferenceObject?.formConf?.formatNullValue || ''
  return { formatNullValue }
}
