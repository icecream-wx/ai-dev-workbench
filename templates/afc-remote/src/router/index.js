import { createRouter, createWebHashHistory } from 'vue-router'
import AppIndex from '@/views/AppIndex.vue'

/**
 * 最小路由：只保留占位入口。
 * 开发实现页面后，在 docs/design/<MOD>/ui-check.md 记录“设计页 → 路由 → 蓝图”，
 * 再把新页面挂到这里（或由宿主菜单直接挂载暴露的组件）。
 */
const routes = [
  {
    path: '/',
    name: 'index',
    component: AppIndex,
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
