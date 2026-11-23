import { getCurrentInstance } from 'vue'
import localStore, { localStore as localStoreBase } from '../utils/sessionStore'

let _cachedProxy = null

function getGlobalConfig() {
  try {
    return localStore.get('globalConfig')
      || localStoreBase.get('globalConfig')
      || window.globalConfig
      || {}
  } catch (e) {
    try {
      return window.globalConfig || {}
    } catch (e2) {
      return {}
    }
  }
}

export function cacheInstance() {
  const inst = getCurrentInstance()
  // 只缓存确实带 dispatchProxy 的代理，避免污染共享缓存
  if (inst?.proxy?.dispatchProxy) {
    _cachedProxy = inst.proxy
  }
}

function getControllers(instance = null) {
  // 处理传入的是选项式API的proxy实例（this）的情况
  let inst = instance || getCurrentInstance()
  // 如果是proxy实例，取内部实例
  if (inst && inst._) inst = inst._
  const globalConfig = getGlobalConfig()
  return inst?.appContext?.config?.globalProperties?.Controllers
    || inst?.proxy?.Bus?.ElementMapping
    || inst?.proxy?.$root?.Controllers
    || globalConfig.Controllers
    || {}
}

// 沿父组件链向上查找带 dispatchProxy 的实例（兼容 v2 BaseVue 挂在页面组件上的模式）
// teleport 的弹窗组件树不变，$parent 链仍可达宿主页面组件
function findDispatchProxyUpward(startProxy) {
  let p = startProxy
  let depth = 0
  while (p && depth < 30) {
    try {
      if (p.dispatchProxy) return p
      p = p.$parent
    } catch (e) {
      break
    }
    depth++
  }
  return null
}

function resolveDispatchProxy() {
  if (_cachedProxy?.dispatchProxy) return _cachedProxy
  const inst = getCurrentInstance()
  const liveProxy = inst?.proxy
  if (liveProxy?.dispatchProxy) {
    _cachedProxy = liveProxy
    return liveProxy
  }
  const found = findDispatchProxyUpward(liveProxy || _cachedProxy)
  if (found) {
    _cachedProxy = found
    return found
  }
  const root = liveProxy?.$root || _cachedProxy?.$root
  if (root?.dispatchProxy) {
    _cachedProxy = root
    return root
  }
  return null
}

export function useDispatchProxy(instance = null) {
  if (instance) {
    // 传入的是选项式API的实例this
    const p = instance._ ? instance.proxy : instance
    if (p?.dispatchProxy) {
      _cachedProxy = p
    }
  } else {
    cacheInstance()  // 在 setup 阶段调用一次，缓存实例 proxy
  }

  const dispatchProxy = async (controllerMethod, params) => {
    if (!controllerMethod) {
      console.warn('[useDispatchProxy] Controller method is undefined')
      return { error: true }
    }
    const proxy = resolveDispatchProxy()
    if (proxy) {
      return proxy.dispatchProxy(controllerMethod, params)
    }
    // 走平台 globalConfig 注入的请求通道（与 pm-upload 等 mixin 一致）
    const globalConfig = getGlobalConfig()
    if (globalConfig.dispatchProxy) {
      const dispatch = globalConfig.dispatchProxy(getCurrentInstance()?.proxy || _cachedProxy)
      if (typeof dispatch === 'function') {
        return dispatch(controllerMethod, params)
      }
    }
    console.warn('[useDispatchProxy] dispatchProxy not found on instance', {
      hasCachedProxy: !!_cachedProxy,
      hasGlobalConfig: !!globalConfig.dispatchProxy,
      controllerMethod: controllerMethod?.name || String(controllerMethod),
    })
    return { error: true }
  }

  return { dispatchProxy }
}

export function useControllers(instance = null) {
  return getControllers(instance)
}
