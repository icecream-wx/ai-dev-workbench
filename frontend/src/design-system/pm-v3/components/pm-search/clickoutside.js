function isInsidePopper(el) {
  let node = el
  while (node && node !== document.body) {
    if (node.classList && (
      node.classList.contains('el-popper') ||
      node.classList.contains('el-overlay') ||
      node.classList.contains('el-select-dropdown') ||
      node.classList.contains('el-picker-panel') ||
      node.classList.contains('el-dialog') ||
      node.classList.contains('pm-search-popper')
    )) {
      return true
    }
    node = node.parentElement
  }
  return false
}

export default {
  beforeMount(el, binding) {
    const documentHandler = (e) => {
      if (el.contains(e.target)) return
      if (isInsidePopper(e.target)) return
      binding.value(e)
    }
    el.__vueClickOutside__ = documentHandler
    document.addEventListener('click', documentHandler)
  },
  unmounted(el) {
    document.removeEventListener('click', el.__vueClickOutside__)
    delete el.__vueClickOutside__
  }
}
