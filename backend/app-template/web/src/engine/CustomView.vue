<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { resolvePlugin } from '../plugins'

/** custom 页面：加载 web/plugins/<page-id>.vue（智能体产出，Vite HMR 生效）；未实现时展示任务提示 */
const props = defineProps({ page: { type: Object, required: true } })

const pluginComp = computed(() => {
  const loader = resolvePlugin(props.page.id)
  return loader ? defineAsyncComponent(loader) : null
})
</script>

<template>
  <div class="pg">
    <div class="pg-head">
      <div>
        <h2 class="pg-title">{{ page.title }}</h2>
        <div class="pg-sub">自定义页面 · 由插件实现</div>
      </div>
    </div>
    <component :is="pluginComp" v-if="pluginComp" :page="page" :manifest="page.__manifest" />
    <div v-else class="plugin-missing">
      <div class="pm-title">该页面类型为 custom，需要插件实现</div>
      <div class="pm-file">web/plugins/{{ page.id }}.vue</div>
      <div class="pm-hint">在开发视图向智能体下达指令，按插件契约实现本页面；保存后 Vite HMR 自动加载。</div>
    </div>
  </div>
</template>

<style scoped>
.pg { max-width: 1280px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
.pg-head { display: flex; align-items: center; justify-content: space-between; }
.pg-title { font-size: 17px; font-weight: 700; margin: 0; color: #1c2233; }
.pg-sub { font-size: 12px; color: #8b91a5; margin-top: 3px; }
.plugin-missing { background: #fff; border: 1px dashed #c9cedd; border-radius: 10px; padding: 48px 24px; text-align: center; }
.pm-file {
  display: inline-block; margin: 14px 0; font-family: Consolas, monospace; font-size: 12.5px;
  background: #f4f5fa; border: 1px solid #e4e7ef; border-radius: 6px; padding: 6px 14px; color: #5b5bd6;
}
.pm-hint { color: #8b91a5; font-size: 12.5px; }
</style>
