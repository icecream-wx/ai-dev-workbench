<template>
  <el-dialog
    :model-value="modelValue"
    title="模型设置"
    width="min(560px, calc(100vw - 32px))"
    class="rg-settings-dialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="appearance">
      <div class="appearance-head">
        <span class="appearance-title">外观</span>
        <span class="appearance-hint">深浅色与顶栏按钮同步，选择会保存在本机</span>
      </div>
      <div class="segmented" role="group" aria-label="外观主题">
        <button
          type="button"
          :class="['segment', { on: settingsStore.theme === 'light' }]"
          :aria-pressed="settingsStore.theme === 'light'"
          @click="settingsStore.setTheme('light')"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="3.2" />
            <path d="M8 1.4v1.7M8 12.9v1.7M1.4 8h1.7M12.9 8h1.7M3.3 3.3l1.2 1.2M11.5 11.5l1.2 1.2M12.7 3.3l-1.2 1.2M4.5 11.5l-1.2 1.2" />
          </svg>
          浅色
        </button>
        <button
          type="button"
          :class="['segment', { on: settingsStore.theme === 'dark' }]"
          :aria-pressed="settingsStore.theme === 'dark'"
          @click="settingsStore.setTheme('dark')"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M13.2 9.8A5.6 5.6 0 0 1 6.2 2.8a5.7 5.7 0 1 0 7 7Z" />
          </svg>
          深色
        </button>
      </div>
    </div>

    <div class="runtime-row">
      <span :class="['dot', settingsStore.runtimeReady ? 'ok' : 'idle']" />
      <span>
        opencode：
        {{ settingsStore.runtimeReady ? `已连接 ${settingsStore.runtimeVersion ?? ''}` : '未启动' }}
      </span>
      <el-button link type="primary" :loading="settingsStore.loadingModels" @click="refresh">刷新模型</el-button>
    </div>

    <el-form label-width="90px">
      <el-form-item label="当前阶段">
        <el-tag type="info">{{ stageLabel }}</el-tag>
      </el-form-item>
      <el-form-item label="模型">
        <el-select
          v-model="selected"
          filterable
          clearable
          style="width: 100%"
          placeholder="使用默认模型（跟随 opencode CLI）"
          :loading="settingsStore.loadingModels"
        >
          <el-option
            v-for="model in options"
            :key="`${model.providerID}/${model.modelID}`"
            :label="`${model.name}（${model.providerID}/${model.modelID}）`"
            :value="`${model.providerID}/${model.modelID}`"
          />
        </el-select>
      </el-form-item>
    </el-form>

    <p v-if="settingsStore.modelError" class="error">{{ settingsStore.modelError }}</p>
    <p class="tip">
      模型/provider 由 opencode 自身配置管理，工作台不保存 API Key。选择会保存到当前应用与阶段；留空时默认跟随 opencode CLI 最近使用的模型（其次才是 opencode 默认模型）。
    </p>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from './store'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

const settingsStore = useSettingsStore()
const selected = ref('')
const saving = ref(false)

const options = computed(() => settingsStore.models.filter(model => model.enabled !== false))
const stageLabel = computed(() => {
  if (typeof window === 'undefined') return '需求'
  const hash = window.location.hash
  if (/#\/apps\/[^/]+\/design/.test(hash)) return '设计'
  if (/#\/apps\/[^/]+\/development/.test(hash)) return '开发'
  return '需求'
})

async function refresh(): Promise<void> {
  await settingsStore.loadModels()
}

watch(
  () => props.modelValue,
  async open => {
    if (!open) return
    await settingsStore.loadModels()
    await settingsStore.refreshStageModel()
    selected.value = settingsStore.settings.model
  }
)

async function onSave(): Promise<void> {
  saving.value = true
  try {
    await settingsStore.saveModel(selected.value)
    ElMessage.success(selected.value ? '模型已保存' : '已改为使用默认模型')
    emit('update:modelValue', false)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.appearance {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 10px 12px;
  margin: 0 0 14px;
  border: 1px solid var(--rg-border);
  border-radius: var(--rg-radius);
  background: var(--rg-surface-2);
}
.appearance-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.appearance-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rg-text);
}
.appearance-hint {
  font-size: 11px;
  color: var(--rg-text-3);
}
.segmented {
  display: inline-flex;
  gap: 3px;
  padding: 3px;
  border-radius: 8px;
  background: var(--rg-fill);
  border: 1px solid var(--rg-border);
}
.segment {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 28px;
  border: none;
  border-radius: 6px;
  padding: 4px 12px;
  background: transparent;
  color: var(--rg-text-2);
  font-size: 12px;
  cursor: pointer;
}
.segment svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.segment:hover {
  color: var(--rg-text);
}
.segment.on {
  background: var(--rg-surface);
  color: var(--rg-text);
  font-weight: 600;
  box-shadow: var(--rg-shadow-1);
}
.runtime-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 16px;
  font-size: 12.5px;
  color: var(--rg-text-2);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--rg-text-3);
}
.dot.ok {
  background: var(--rg-ok);
}
.tip {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.65;
  color: var(--rg-text-3);
}
.error {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--rg-danger);
  background: var(--rg-danger-soft);
  border: 1px solid var(--rg-danger-border);
  border-radius: 8px;
  padding: 8px 10px;
}
@media (max-width: 640px) {
  .appearance {
    flex-direction: column;
    align-items: flex-start;
  }
  .segmented {
    width: 100%;
  }
  .segment {
    flex: 1;
    justify-content: center;
  }
}
</style>
