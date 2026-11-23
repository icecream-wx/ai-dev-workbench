import mitt from 'mitt'
const bus = mitt()

// 兼容$once方法
bus.$once = (event, handler) => {
  const onceHandler = (...args) => {
    handler(...args)
    bus.off(event, onceHandler)
  }
  bus.on(event, onceHandler)
}

export default bus