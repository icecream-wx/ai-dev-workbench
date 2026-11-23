import { createRouter, createWebHashHistory } from 'vue-router'
import AppIndex from '@/views/AppIndex.vue'
import GoodsList from '@/views/goods/GoodsList.vue'

/**
 * 最小路由：占位入口 + MOD-001 商品管理。
 * 新增/编辑弹窗在商品列表内打开（GoodsForm.vue），不单独占路由；
 * 也可由宿主菜单直接挂载 build/mfp.config.js 暴露的 ./goods-list。
 */
const routes = [
  {
    path: '/',
    name: 'index',
    component: AppIndex,
  },
  {
    path: '/goods',
    name: 'goods-list',
    component: GoodsList,
    meta: { title: '商品管理', module: 'MOD-001' },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
