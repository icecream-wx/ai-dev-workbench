const hasDOM = typeof document !== 'undefined'

export const on = (function() {
  if (hasDOM && document.addEventListener) {
    return function(element, event, handler, useCapture = false) {
      if (element && event && handler) {
        element.addEventListener(event, handler, useCapture)
      }
    }
  }
  return function() {}
})()

export const off = (function() {
  if (hasDOM && document.removeEventListener) {
    return function(element, event, handler, useCapture = false) {
      if (element && event) {
        element.removeEventListener(event, handler, useCapture)
      }
    }
  }
  return function() {}
})()
