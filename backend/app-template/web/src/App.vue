<template>
  <div v-if="store.manifest" class="app-shell">
    <aside class="app-side">
      <div class="app-brand">
        <span class="app-logo">应</span>
        <span class="app-title">{{ store.manifest.app?.name ?? '应用' }}</span>
      </div>
      <nav class="app-menu">
        <button
          v-for="p in menu"
          :key="p.id"
          type="button"
          :class="['app-menu-item', { on: store.current?.pageId === p.id }]"
          @click="store.openPage(p.id)"
        >{{ p.title }}</button>
      </nav>
      <div class="app-side-foot">运行时引擎 · manifest v{{ store.manifest.version }}</div>
    </aside>
    <main class="app-main">
      <component :is="pageComponent" :key="pageKey" v-bind="pageProps" />
    </main>
  </div>
  <div v-else class="app-loading">
    <el-icon class="is-loading"><Loading /></el-icon>
    <span>{{ store.manifestError || '应用加载中…' }}</span>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import { store, loadManifest, menuPages, pageOf } from './engine/store'
import ListView from './engine/ListView.vue'
import FormView from './engine/FormView.vue'
import DetailView from './engine/DetailView.vue'
import DashboardView from './engine/DashboardView.vue'
import CustomView from './engine/CustomView.vue'
import Placeholder from './engine/Placeholder.vue'
import { resolvePlugin } from './plugins'

const menu = computed(() => menuPages())
const page = computed(() => pageOf(store.current?.pageId))

const pageComponent = computed(() => {
  if (!page.value) return Placeholder
  if (store.current?.mode === 'edit' || store.current?.mode === 'create') return FormView
  if (store.current?.mode === 'detail') return DetailView
  switch (page.value.type) {
    case 'list': return ListView
    case 'form': return FormView
    case 'detail': return DetailView
    case 'dashboard': return DashboardView
    case 'custom': return resolvePlugin(page.value.id) ? CustomView : Placeholder
    default: return Placeholder
  }
})

const pageProps = computed(() => ({ page: page.value, mode: store.current?.mode ?? 'page', record: store.current?.record }))
const pageKey = computed(() => `${store.current?.pageId}-${store.current?.mode ?? 'page'}-${store.current?.record?.id ?? ''}`)

// manifest 轮询：codegen/智能体改清单后 3 秒内自动生效（菜单与页面热更新）
let timer = null
onMounted(() => {
  loadManifest()
  timer = setInterval(loadManifest, 3000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<style>
* { box-sizing: border-box; }
body { margin: 0; background: #f2f3f7; color: #262a33; font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; }
.app-shell { display: flex; height: 100vh; }
.app-side {
  width: 208px; flex-shrink: 0; display: flex; flex-direction: column;
  background: #1d2333; color: #cfd3e0;
}
.app-brand { display: flex; align-items: center; gap: 10px; padding: 16px 16px 14px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.app-logo {
  width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
  background: linear-gradient(140deg, #5b5bd6, #8a7bf7); color: #fff;
  font-size: 13px; font-weight: 600; display: flex; align-items: center; justify-content: center;
}
.app-title { font-size: 13.5px; font-weight: 600; color: #fff; line-height: 1.35; }
.app-menu { flex: 1; overflow-y: auto; padding: 10px 10px; display: flex; flex-direction: column; gap: 2px; }
.app-menu-item {
  border: none; background: transparent; color: #aab0c4; text-align: left;
  padding: 9px 12px; border-radius: 7px; font-size: 13px; cursor: pointer; transition: all 0.15s;
}
.app-menu-item:hover { color: #fff; background: rgba(255,255,255,0.06); }
.app-menu-item.on { color: #fff; background: rgba(122, 110, 255, 0.32); font-weight: 600; }
.app-side-foot { padding: 10px 16px; font-size: 10.5px; color: #6b7288; border-top: 1px solid rgba(255,255,255,0.08); }
.app-main { flex: 1; min-width: 0; overflow-y: auto; padding: 18px 22px; }
.app-loading { height: 100vh; display: flex; align-items: center; justify-content: center; gap: 8px; color: #909399; font-size: 13px; }
</style>
