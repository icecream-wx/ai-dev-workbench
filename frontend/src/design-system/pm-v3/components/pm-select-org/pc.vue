<template>
  <div class="select-main" :class="{ whiteSpaceNormal: isLineWrap }">
    <div v-if="mode === 'edit'">
      <null-value v-if="!modelValue && (disabled || readonly)" :disabled="disabled" :readonly="readonly" />
      <template v-else>
        <div v-if="!navigationTree" class="select-wrapper">
          <el-popover
            v-if="showMode !== 'button'"
            :visible="popoverVisible"
            placement="bottom-start"
            :width="popoverWidth"
            trigger="click"
            @update:visible="popoverVisible = $event"
          >
            <template #reference>
              <el-input
                ref="inputRef"
                :model-value="displayText"
                :placeholder="placeholder"
                :disabled="disabled"
                :readonly="true"
                style="width: 100%;"
              >
                <template #prefix>
                  <el-icon class="prefix-icon"><OfficeBuilding /></el-icon>
                </template>
                <template #suffix>
                  <el-icon v-if="modelValue && !disabled && !readonly" class="clear-icon" :class="{ 'clear-icon-with-btn': showDialogBtn }" @click.stop="clearValue"><CircleClose /></el-icon>
                </template>
              </el-input>
            </template>
            <SelectPanel
              v-if="popoverVisible"
              :multiple="isMultiple"
              :showCode="showCode"
              currentType="org"
              :selectTypes="types"
              :tenantId="tenantId"
              :modelValue="selectedItems"
              :queryDisableOrg="queryDisableOrg"
              @select="handleSelect"
            />
          </el-popover>
          <el-button
            v-if="showMode === 'all' && !(disabled || readonly)"
            :icon="Search"
            class="input_btn"
            type="text"
            @click="openDialog"
          />
          <el-button
            v-if="showMode === 'button'"
            :type="type"
            :disabled="disabled || readonly"
            @click="openDialog"
          >
            {{ buttonText }}
          </el-button>
        </div>
        <NavigationTree v-if="navigationTree" @change="navigationTreeChange" :title="title" :showCode="showCode" currentType="org" />
      </template>
    </div>
    <span v-else-if="selected">{{ viewSelectedLabel }}</span>
    <span v-else>
      <template v-if="$attrs.isHighlight">
        <span v-if="!modelValue">{{ formatNullValue }}</span>
        <span v-else v-for="val in showContentList" :key="val" class="highlight-tag">{{ val }}</span>
      </template>
      <template v-else>{{ showContent || formatNullValue }}</template>
    </span>

    <DetailDialog
      v-if="dialogVisible"
      v-model="selectedItems"
      v-model:visible="dialogVisible"
      :multiple="isMultiple"
      :showCode="showCode"
      currentType="org"
      :selectTypes="types"
      :tenantId="tenantId"
      title="选择机构"
      @confirm="handleConfirm"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { cloneDeep, isArray } from 'lodash'
import { Search, CircleClose, ArrowDown, OfficeBuilding } from '@element-plus/icons-vue'
import { useSelectModel, getValIsEmpty } from '../../composables/useSelectModel'
import { useFormatNullValue } from '../../composables/useFormatNullValue'
import NullValue from '../pm-null-value/pc.vue'
import SelectPanel from '../pm-select-user/select-panel.vue'
import DetailDialog from '../pm-select-user/detail.vue'
import NavigationTree from '../pm-select-user/navigationTree.vue'

/**
 * 组织选择器组件，从后端查询组织架构数据并展示为树形下拉选择
 */
const props = defineProps({
  modelValue: { default: null },
  isEntityAllSearch: { type: Boolean, default: false },
  isOnlyLeafCanSelected: { type: Boolean, default: false },
  props: { type: Object, default: () => ({ multiple: false }) },
  multiple: { type: Boolean, default: false },
  placeholder: { type: String, default: '请输入...' },
  readonly: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  clearable: { type: Boolean, default: false },
  showMode: { type: String, default: 'all' },
  dimension: { type: String, default: 'def_dimension' },
  showCode: { type: Boolean, default: false },
  tenantId: { type: String, default: '' },
  buttonText: { type: String, default: '' },
  selectTypes: { type: Array, default: () => [] },
  separator: { type: String, default: ',' },
  mode: { type: String, default: 'edit' },
  type: { type: String, default: 'primary' },
  navigationTree: { type: Boolean, default: false },
  title: { type: String, default: '' },
  queryDisableOrg: { type: Boolean, default: false },
  isAllMode: { type: Boolean, default: false },
  linkSeparator: { type: String, default: '/' },
  isBindCode: { type: Boolean, default: false },
  icon: { type: String, default: '' },
  isHighlight: { type: Boolean, default: false },
  size: { type: String, default: 'mini' },
  bfpParticipant: { type: String, default: '' },
  selected: { default: undefined },
})

const emit = defineEmits([
  'update:modelValue', 'update:selected', 'update:bfpParticipant',
  'selectedSuccess', 'change', 'allowSelect',
])

const { getOrgsByIds } = useSelectModel()
const { formatNullValue } = useFormatNullValue()

const selectedItems = ref([])
const dialogVisible = ref(false)
const popoverVisible = ref(false)
const popoverWidth = ref(360)
const inputRef = ref(null)
const isLineWrap = ref(false)

const isMultiple = computed(() => props.props?.multiple || props.multiple)
const showDialogBtn = computed(() => props.showMode === 'all' && !props.disabled && !props.readonly)

const types = computed(() => {
  if (!props.selectTypes?.length) {
    return [{ id: 'org', label: '机构', rangeMode: 'dimension', rangeData: { dimensionCode: props.dimension || 'def_dimension' } }]
  }
  return cloneDeep(props.selectTypes)
})

const showContent = computed(() => showContentList.value.join(props.separator))

const showContentList = computed(() => {
  if (isArray(props.selected)) {
    return props.selected.map(item => item.name + (props.showCode ? ' (' + item.code + ')' : ''))
  }
  return props.selected?.name ? [props.selected.name + (props.showCode ? ' (' + props.selected.code + ')' : '')] : []
})

const displayText = computed(() => {
  if (isMultiple.value) {
    return selectedItems.value.map(i => i.name + (props.showCode ? ' (' + i.code + ')' : '')).join(', ')
  }
  const item = selectedItems.value?.[0]
  return item ? item.name + (props.showCode ? ' (' + item.code + ')' : '') : ''
})

const viewSelectedLabel = computed(() => {
  if (props.selected == null) return ''
  if (isMultiple.value && Array.isArray(props.selected)) {
    return props.selected.map(item => item.name || '').filter(Boolean).join('、')
  }
  return props.selected?.name || ''
})

watch(() => props.modelValue, async (val) => {
  if (!val) {
    selectedItems.value = []
  } else {
    let resp = []
    if (getValIsEmpty(props.selected, val)) {
      const query = props.isBindCode ? { codes: val } : { ids: val }
      resp = await getOrgsByIds(query) || []
    } else {
      resp = Array.isArray(props.selected) ? props.selected : props.selected ? [props.selected] : []
    }
    selectedItems.value = isMultiple.value ? resp : resp.slice(0, 1)
    emit('update:selected', resp.length === 1 ? resp[0] : resp)
  }
  emit('change', val)
}, { immediate: true })

function clearValue() { emitValue([]) }
function handleSelect(items) { popoverVisible.value = false; emitValue(items) }
function handleConfirm(items) { emitValue(items) }

function emitValue(items) {
  const bindProperty = props.isBindCode ? 'code' : 'id'
  if (isMultiple.value) {
    emit('update:modelValue', items.map(i => i[bindProperty]).join(props.separator) || '')
  } else {
    emit('update:modelValue', items?.[0]?.[bindProperty] || '')
  }
  emit('update:selected', isMultiple.value ? items : items[0] || null)
  emit('selectedSuccess', items)
}

function openDialog() { dialogVisible.value = true }
function navigationTreeChange(arr) {
  const bindProperty = props.isBindCode ? 'code' : 'id'
  emit('update:modelValue', arr?.[bindProperty] || '')
}

onMounted(() => {
  if (inputRef.value?.$el) {
    popoverWidth.value = Math.max(inputRef.value.$el.offsetWidth, 300)
  }
})
</script>

<style lang="scss" scoped>
.select-main { position: relative; display: inline; }
.whiteSpaceNormal { display: inline-block !important; white-space: normal; margin: 10px 0; }
.select-wrapper { display: inline-flex; align-items: center; width: 100%; position: relative; }
.input_btn { position: absolute; right: 4px; top: -1px; color: #c0c4cc !important; &:hover { color: #909399 !important; } }
.prefix-icon { color: #c0c4cc; }
.clear-icon { cursor: pointer; margin-right: 4px; }
.clear-icon-with-btn { margin-right: 32px; }
.highlight-tag { background: #f4f4f5; color: rgb(144,147,153); border-radius: 15px; padding: 2px 10px; margin-right: 3px; white-space: nowrap; }
</style>
<!-- Modified by AI on 2026-08-04 10:02:17 -->
