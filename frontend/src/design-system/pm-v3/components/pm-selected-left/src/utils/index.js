export const optionsSerialize = (options) => {
  if (typeof options === 'object' && options) {
    const { codes, isBindCode, ...rest } = options
    if (codes) {
      delete rest.ids
      return { codes, ...rest }
    }
    if (isBindCode) {
      delete rest.ids
      return { ...rest, codes: options.ids || options.codes }
    }
    return options
  }
  return {}
}

export const getValIsEmpty = (val, id) => {
  if (val) {
    if (Array.isArray(val)) return val.length === 0
    if (typeof val === 'object' && Object.keys(val).length >= 2 && val.hasOwnProperty('id') && val.hasOwnProperty('name') && !val.id && !val.name) return true
    if (typeof val === 'object' && val) {
      if (id && (val.id === id || val.code === id)) return false
      return true
    }
    return false
  }
  return true
}
