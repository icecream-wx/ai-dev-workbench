var assignValue = require('lodash/_assignValue'),
  castPath = require('lodash/_castPath'),
  isIndex = require('lodash/_isIndex'),
  isObject = require('lodash/isObject'),
  toKey = require('lodash/_toKey')

function set(object, path, value, customizer) {
  if (!isObject(object)) {
    return object
  }
  path = castPath(path, object)

  var index = -1
  var length = path.length
  var lastIndex = length - 1
  var nested = object

  while (nested != null && ++index < length) {
    var key = toKey(path[index])
    var newValue = value

    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return object
    }

    if (index !== lastIndex) {
      var objValue = nested[key]
      newValue = customizer ? customizer(objValue, key, nested) : undefined
      if (newValue === undefined) {
        newValue = isObject(objValue)
          ? objValue
          : (isIndex(path[index + 1]) ? [] : {})
      }
    }
    nested[key] = newValue
    nested = nested[key]
  }
  return object
}
function $set(_this, object, path, value, customizer) {
  set(object, path, value, customizer)
}
export {
  $set, set
}
