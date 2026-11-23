<template>
  <div ref="pmSearch" class="pm-search-wrapper">
    <el-form @submit.prevent>
      <el-input
        v-if="
          activeProps.length === 0 ||
          (activeProps.length === 1 && activeProps[0].code === defaultProp)
        "
        ref="searchInput"
        v-model="queryDefaultProp"
        :placeholder="($attrs.placeholder as string) || '搜索...'"
        @keypress.enter="emitSearch"
        @focus="visible = true"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <div v-else class="search-tags" @click="visible = true">
        <div class="search-tags__icon">
          <el-icon><Search /></el-icon>
        </div>
        <div class="search-tags__content" ref="tagsContainer">
          <el-tag
            v-for="prop in visibleTags"
            :key="prop.code"
            :disable-transitions="true"
            size="small"
            class="search-tag"
          >
            <span class="search-tag__text">
              <span v-if="getPropTitle(prop)" class="search-tag__label">{{ getPropTitle(prop) }}：</span>
              <span class="search-tag__value"><ValueText :titles="titles" :data="prop" /></span>
            </span>
            <el-icon class="search-tag__close" @click.stop="removeProp(prop)"><CircleClose /></el-icon>
          </el-tag>
          <el-popover
            v-if="extraCount > 0"
            placement="bottom"
            trigger="hover"
            popper-class="pm-search-tags-more-popover"
            :width="360"
          >
            <template #reference>
              <span class="search-tags__more" @click.stop>+{{ extraCount }} 项</span>
            </template>
            <div class="pm-search-tags-popover-body">
              <div
                v-for="prop in hiddenTags"
                :key="prop.code"
                class="pm-search-tags-popover-item"
              >
                <span class="pm-search-tags-popover-item__text">
                  <span v-if="getPropTitle(prop)" class="pm-search-tags-popover-item__label">{{ getPropTitle(prop) }}：</span>
                  <span class="pm-search-tags-popover-item__value"><ValueText :titles="titles" :data="prop" /></span>
                </span>
                <el-icon class="pm-search-tags-popover-item__close" @click.stop="removeProp(prop)"><CircleClose /></el-icon>
              </div>
            </div>
          </el-popover>
        </div>
        <div class="search-tags__clear" @click.stop="clear">
          <el-icon><CircleClose /></el-icon>
        </div>
      </div>
    </el-form>
    <!-- v-show 常驻 DOM（v2 同款）：收起时也要让 #body slot 的条件字段完成注册，
         否则 mounted 采集不到 fields，默认值 tag 首屏不显示（EOS-11251 追加） -->
    <!-- Teleport 到 body：避免祖先元素 transform 导致 fixed 定位错位（缩放后面板漂移） -->
    <Teleport to="body">
      <div v-show="visible" ref="dropdownRef" class="pm-search-dropdown" :style="dropdownStyle">
      <div class="pm-search-dropdown__header">
        <span>高级搜索</span>
        <el-icon class="pm-search-dropdown__close" @click="visible = false"><Close /></el-icon>
      </div>
      <el-form
        ref="searchForm"
        class="view-form"
        label-width="90px"
        label-position="top"
        :model="localQuery"
        @submit.prevent
        @keyup.enter="doEnter"
      >
        <div class="body">
          <slot name="body" />
        </div>
      </el-form>
      <div class="pm-search-actions">
        <el-button type="primary" @click="seniorSearch">搜索</el-button>
        <el-button @click="clear">重置</el-button>
      </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick, onBeforeUnmount, onMounted, useAttrs } from 'vue'
import { get, set, cloneDeep } from 'lodash'
import type { PropValue } from './types'
import ValueText from './valueText.vue'
import { Close, Search, CircleClose } from '@element-plus/icons-vue'

/**
 * 搜索组件，带搜索按钮的搜索输入框，支持搜索回调、清空和快捷键触发
 */
defineOptions({ name: 'PmSearchPc' })

const props = withDefaults(defineProps<{
  query?: Record<string, any>
  defaultProp?: string
}>(), {
  query: () => ({}),
  defaultProp: 'name',
})

const emit = defineEmits<{
  'update:query': [val: Record<string, any>]
  search: []
}>()

const $attrs = useAttrs()

const searchForm = ref<any>(null)
const pmSearch = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)

const visible = ref(false)
const inputVal = ref('')
const localQuery = reactive<Record<string, any>>({})
const searchQuery = ref<Record<string, any> | null>(null)
const titles = reactive<Record<string, any>>({})
const cachedPropKeys = ref<string[]>([])
const dropdownStyle = ref<Record<string, string>>({})
const searchInput = ref(null)

watch(() => props.query, (val) => {
  if (!val || Object.keys(val).length === 0) {
    for (const key of Object.keys(localQuery)) {
      delete localQuery[key]
    }
  } else {
    for (const key of Object.keys(val)) {
      localQuery[key] = cloneDeep(val[key])
    }
    for (const key of Object.keys(localQuery)) {
      if (!(key in val)) {
        delete localQuery[key]
      }
    }
  }
  inputVal.value = get(val, props.defaultProp) ?? ''
  if (!visible.value) {
    searchQuery.value = val ? cloneDeep(val) : null
  }
}, { immediate: true, deep: true })

watch(visible, (val) => {
  if (val) {
    nextTick(() => {
      updatePosition()
      initOptions()
      buildFormItem()
      // 打开面板即采集各条件的标题/选项/选中值文案，否则收起态的
      // 条件 tag（ValueText）在首次搜索前拿到空 titles 渲染成空胶囊
      initOptions()
    })
    document.addEventListener('mousedown', onDocClick)
  } else {
    document.removeEventListener('mousedown', onDocClick)
  }
})

const activeProps = computed(() => {
  if (!searchQuery.value) return []
  return cachedPropKeys.value
    .filter((key) => {
      const value = get(searchQuery.value, key)
      if (Array.isArray(value)) {
        return value.filter((v) => v).length > 0
      }
      return value && key !== 'limit' && key !== 'offset'
    })
    .map((key) => ({
      code: key,
      value: get(searchQuery.value, key),
    }))
})

const tagsContainer = ref<HTMLElement | null>(null)
const visibleLimit = ref(Infinity)

function refreshVisibleLimit() {
  const el = tagsContainer.value
  if (!el || activeProps.value.length === 0) return
  const gap = 4
  const tags = Array.from(el.querySelectorAll('.search-tag')) as HTMLElement[]
  if (tags.length === 0) return

  const moreEl = el.querySelector('.search-tags__more') as HTMLElement | null
  const moreWidth = moreEl ? moreEl.offsetWidth + gap : 50

  const available = el.clientWidth - moreWidth
  let used = 0
  let fit = 0
  for (const tag of tags) {
    used += tag.offsetWidth + gap
    if (used > available) break
    fit++
  }

  visibleLimit.value = Math.max(1, fit)
}

watch(activeProps, () => {
  visibleLimit.value = Infinity
  nextTick(refreshVisibleLimit)
}, { deep: true })

onMounted(() => {
  nextTick(refreshVisibleLimit)
  const ro = new ResizeObserver(() => {
    refreshVisibleLimit()
    updatePosition()
  })
  if (pmSearch.value) ro.observe(pmSearch.value)
  onBeforeUnmount(() => ro.disconnect())
  window.addEventListener('resize', updatePosition)
  // 滚动时实时校正位置（capture 捕获任意容器内滚动），避免缩放/滚动后错位
  window.addEventListener('scroll', updatePosition, true)
  // v2 mounted 即构建收起态条件 tag（buildFormItem+initOptions）；
  // 只在打开面板时采集会导致默认值 tag 首屏不显示（EOS-11251 追加）
  nextTick(() => {
    buildFormItem()
    initOptions()
  })
})

const visibleTags = computed(() => activeProps.value.slice(0, visibleLimit.value))

const hiddenTags = computed(() => activeProps.value.slice(visibleLimit.value))

const extraCount = computed(() => hiddenTags.value.length)

const queryDefaultProp = computed({
  get: () => inputVal.value,
  set: (val: string) => {
    inputVal.value = val
    const key = props.defaultProp
    localQuery[key] = val
    // 输入时同步父级 v-model，避免仅在回车后才更新查询条件。
    emit('update:query', cloneDeep(localQuery))
  },
})

function updatePosition() {
  if (!pmSearch.value || !visible.value) return
  const rect = pmSearch.value.getBoundingClientRect()
  // Teleport 到 body 后需要压过所在弹窗的遮罩层级，取最近的 overlay z-index +1
  const overlay = pmSearch.value.closest('.el-overlay, .el-drawer') as HTMLElement | null
  let overlayZ = overlay ? parseInt(getComputedStyle(overlay).zIndex, 10) : NaN
  if (!Number.isFinite(overlayZ)) {
    // .el-dialog/.el-drawer 自身无 z-index，再向上找带层级的容器
    const box = pmSearch.value.closest('.el-dialog, .el-drawer') as HTMLElement | null
    overlayZ = box ? parseInt(getComputedStyle(box).zIndex, 10) : NaN
  }
  const zIndex = Number.isFinite(overlayZ) ? overlayZ + 1 : 2000
  dropdownStyle.value = {
    position: 'fixed',
    left: rect.left + 'px',
    top: rect.bottom + 4 + 'px',
    width: rect.width + 'px',
    zIndex: String(zIndex),
  }
}

function onDocClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!pmSearch.value) return
  const dropdown = dropdownRef.value
  if (pmSearch.value.contains(target)) return
  if (dropdown && dropdown.contains(target)) return
  let node = target
  while (node && node !== document.body) {
    if (node.classList && (
      node.classList.contains('el-popper') ||
      node.classList.contains('el-select-dropdown') ||
      node.classList.contains('el-picker-panel') ||
      node.classList.contains('el-overlay')
    )) return
    node = node.parentElement!
  }
  visible.value = false
}

function buildFormItem() {
  if (!searchForm.value) return
  cachedPropKeys.value = (searchForm.value.fields || [])
    .map((fi: any) => fi.prop)
    .filter(Boolean)
}

function getPropTitle(prop: PropValue) {
  const title = get(titles, prop.code)
  return title ? title.label : ''
}

function getFormItems() {
  return searchForm.value?.fields || []
}

function initOptions() {
  const formItems = getFormItems()
  // EP2 的 el-form fields 上下文不暴露 $el（element-ui 有），按注册顺序对齐
  // DOM 里的 .el-form-item 作为兜底，否则取不到选中值文案
  const root = (searchForm.value as any)?.$el as HTMLElement | null
  const domItems = root ? (Array.from(root.querySelectorAll('.el-form-item')) as HTMLElement[]) : []
  formItems.forEach((fi: any, idx: number) => {
    if (!fi.prop) return
    const entry: Record<string, any> = {
      label: fi.label,
      options: {},
      innerText: null,
    }
    const formElement = (fi.$el ?? domItems[idx]) as HTMLElement | null
    if (formElement) {
      const datePicker = formElement.querySelector('.el-date-editor')
      if (datePicker) {
        entry.type = 'date'
        titles[fi.prop] = entry
        return
      }

      const selectEl = formElement.querySelector('.el-select')
      if (selectEl) {
        const selectedItems = selectEl.querySelectorAll('.el-select__selected-item')
        if (selectedItems.length > 0) {
          entry.innerText = Array.from(selectedItems)
            .map((item) => (item as HTMLElement).innerText.trim())
            .filter(Boolean)
            .join(',')
          titles[fi.prop] = entry
          return
        }
      }

      const selectOptions = formElement.querySelectorAll('.el-option')
      if (selectOptions.length > 0) {
        selectOptions.forEach((option) => {
          const value = option.getAttribute('value')
          const label = option.querySelector('.el-option__label')?.innerHTML || ''
          if (value !== null) {
            entry.options[value] = label
          }
        })
      }

      const radios = formElement.querySelectorAll('.el-radio, .el-checkbox')
      if (radios.length > 0) {
        radios.forEach((radio) => {
          const input = radio.querySelector('input')
          const value = input?.value
          const label = radio.querySelector('.el-radio__label, .el-checkbox__label')?.innerHTML || ''
          if (value) {
            entry.options[value] = label
          }
        })
      }
    }
    titles[fi.prop] = entry
  })
}

function seniorSearch() {
  searchQuery.value = cloneDeep(localQuery)
  initOptions()
  visible.value = false
  emit('update:query', cloneDeep(localQuery))
  emit('search')
}

function emitSearch() {
  emit('update:query', cloneDeep(localQuery))
  emit('search')
  // 收起面板，避免搜索后还停留在高级搜索面板
  visible.value = false
  searchInput.value?.blur()
  
}

function doEnter() {
  seniorSearch()
}

function resetSearchForm() {
  searchForm.value?.resetFields()
  initOptions()
}

function removeProp(prop: PropValue) {
  const query = cloneDeep(localQuery)
  set(query, prop.code, null)
  set(searchQuery.value as any, prop.code, null)
  if (prop.code === props.defaultProp) {
    inputVal.value = ''
  }
  emit('update:query', query)
  emit('search')
}

function clear() {
  const cleared = cloneDeep(localQuery)
  for (const key of Object.keys(cleared)) {
    if (key !== 'limit' && key !== 'offset') {
      cleared[key] = Array.isArray(cleared[key]) ? [] : null
    }
  }
  for (const key of Object.keys(localQuery)) {
    if (key !== 'limit' && key !== 'offset') {
      localQuery[key] = Array.isArray(localQuery[key]) ? [] : null
    }
  }
  inputVal.value = ''
  searchQuery.value = cloneDeep(cleared)
  emit('update:query', cleared)
  emit('search')
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition, true)
  document.removeEventListener('mousedown', onDocClick)
})
</script>

<style lang="scss" scoped>
.pm-search-wrapper {
  position: relative;
  display: inline-block;
  width: 100%;
}

.ellipsis {
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  word-break: break-all;
}

.search-tags {
  cursor: pointer;
  display: flex;
  align-items: center;
  height: 32px;
  width: 100%;
  border: 1px solid #dcdfe6;
  border-radius: var(--el-border-radius-base);
  background: #fff;
  transition: border-color 0.2s;
  overflow: hidden;

  &:hover {
    border-color: #c0c4cc;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    flex-shrink: 0;
    color: #a8abb2;
  }

  &__content {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    padding: 2px 4px;
    margin-right: 12px;
  }

  &__clear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    flex-shrink: 0;
    color: #c0c4cc;
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: #909399;
    }
  }

  &__more {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    padding: 0 8px;
    height: 22px;
    font-size: 12px;
    color: var(--primary-color);
    background: var(--bgActive);
    border-radius: 4px;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.2s;

    &:hover {
      background: #d9ecff;
    }
  }
}

.search-tag {
  max-width: 200px;
  border-radius: var(--el-border-radius-base);
  min-width: 0;

  :deep(.el-tag__content) {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    width: 100%;
  }

  &__text {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    flex-shrink: 1;
    overflow: hidden;
  }

  &__label {
    color: #909399;
    flex-shrink: 0;
    white-space: nowrap;
  }

  &__value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: auto;
    max-width: 50px;
  }

  &__close {
    margin-left: 4px;
    cursor: pointer;
    color: #909399;
    vertical-align: middle;
    flex-shrink: 0;
    transition: color 0.2s;

    &:hover {
      color: #409eff;
    }
  }
}

.pm-search-dropdown {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  padding: 0;
  position: fixed;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid #f0f2f5;
    font-size: 13px;
    font-weight: 600;
    color: #303133;
  }

  &__close {
    cursor: pointer;
    color: #909399;
    transition: color 0.2s;

    &:hover {
      color: #409eff;
    }
  }
}

.pm-search-actions {
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px;
  border-top: 1px solid #f0f2f5;
}

:deep(.el-input .el-input__prefix) {
  line-height: 32px;
  cursor: pointer;
}

.body {
  max-height: 500px;
  padding: 12px 16px 0;
  overflow-y: auto;
}

:deep(.el-form-item__label) {
  font-size: 13px;
  padding-bottom: 0 !important;
  margin-bottom: 8px !important;
}

:deep(.view-form) {
  .el-form-item {
    margin-bottom: 16px;
  }
}
</style>

<style lang="scss">
.pm-search-tags-more-popover {
  padding: 8px 0 !important;

  .pm-search-tags-popover-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 240px;
    overflow-y: auto;
    padding: 0 12px;
  }

  .pm-search-tags-popover-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    font-size: 12px;
    border-radius: 4px;
    transition: background 0.2s;

    &:hover {
      background: #f5f7fa;
    }

    &__text {
      display: flex;
      align-items: center;
      min-width: 0;
      flex: 1;
    }

    &__label {
      color: #909399;
      white-space: nowrap;
      flex-shrink: 0;
    }

    &__value {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }

    &__close {
      margin-left: auto;
      cursor: pointer;
      color: #c0c4cc;
      flex-shrink: 0;
      transition: color 0.2s;

      &:hover {
        color: #409eff;
      }
    }
  }
}
</style>
<!-- Modified by AI on 2026-09-28 17:07:04 -->
