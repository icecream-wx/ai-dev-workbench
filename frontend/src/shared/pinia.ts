// Pinia 环境兜底：
// 作为 MF 远程模块挂载时，宿主应用可能未安装 Pinia；此模块在导入时确保存在活跃 Pinia 实例。
import { createPinia, getActivePinia, setActivePinia } from 'pinia'

if (!getActivePinia()) {
  setActivePinia(createPinia())
}

export {}
