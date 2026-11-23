<template>
  <div class="select-main">
    <div v-if="mode === 'edit'">
      <null-value v-if="!modelValue && (disabled || readonly)" :disabled="disabled" :readonly="readonly" />
      <template v-else>
        <div class="select-wrapper">
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
                  <el-icon class="prefix-icon"><Medal /></el-icon>
                </template>
                <template #suffix>
                  <el-icon v-if="modelValue && !disabled && !readonly" class="clear-icon" @click.stop="clearValue"><CircleClose /></el-icon>
                </template>
              </el-input>
            </template>
            <SelectPanel
              v-if="popoverVisible"
              :multiple="isMultiple"
              :showCode="showCode"
              currentType="position"
              :selectTypes="types"
              :tenantId="tenantId"
              :modelValue="selectedItems"
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
        <NavigationTree v-if="navigationTree" @change="navigationTreeChange" :title="title" currentType="position" />
      </template>
    </div>
    <span v-else>{{ showContent || '' }}</span>

    <DetailDialog
      v-if="dialogVisible"
      v-model="selectedItems"
      v-model:visible="dialogVisible"
      :multiple="isMultiple"
      :showCode="showCode"
      currentType="position"
      :selectTypes="types"
      :tenantId="tenantId"
      title="选择岗位"
      @confirm="handleConfirm"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { Search, CircleClose, ArrowDown, Medal } from '@element-plus/icons-vue'
import { useSelectModel, getValIsEmpty } from '../../composables/useSelectModel'
import NullValue from '../pm-null-value/pc.vue'
import SelectPanel from '../pm-select-user/select-panel.vue'
import DetailDialog from '../pm-select-user/detail.vue'
import NavigationTree from '../pm-select-user/navigationTree.vue'

/**
 * 岗位选择器组件，从后端查询岗位数据并展示为下拉列表
 */
const props = defineProps({
  modelValue: { default: null },
  entityModel: { default: null },
  props: { type: Object, default: () => ({ multiple: false }) },
  multiple: { type: Boolean, default: false },
  placeholder: { type: String, default: '请输入...' },
  readonly: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  clearable: { type: Boolean, default: false },
  showMode: { type: String, default: 'input' },
  showCode: { type: Boolean, default: false },
  tenantId: { type: String, default: '' },
  buttonText: { type: String, default: '' },
  separator: { type: String, default: ',' },
  mode: { type: String, default: 'edit' },
  type: { type: String, default: 'primary' },
  navigationTree: { type: Boolean, default: false },
  title: { type: String, default: '' },
  size: { type: String, default: 'mini' },
})

const emit = defineEmits(['update:modelValue', 'update:entityModel', 'selectedSuccess', 'change'])

const { getPositionsByIds } = useSelectModel()

const selectedItems = ref([])
const dialogVisible = ref(false)
const popoverVisible = ref(false)
const popoverWidth = ref(360)
const inputRef = ref(null)

const isMultiple = computed(() => props.props?.multiple || props.multiple)
const types = ref([{ id: 'position', label: '岗位', rangeMode: 'positions', rangeData: null }])

const showContent = computed(() => {
  if (Array.isArray(props.entityModel)) {
    return props.entityModel.map(i => i.name).join(props.separator)
  }
  return props.entityModel?.name || ''
})

const displayText = computed(() => {
  if (isMultiple.value) return selectedItems.value.map(i => i.name).join(', ')
  return selectedItems.value?.[0]?.name || ''
})

watch(() => props.modelValue, async (val) => {
  if (!val) {
    selectedItems.value = []
  } else {
    let resp = []
    if (getValIsEmpty(props.entityModel, val)) {
      resp = await getPositionsByIds({ ids: val }) || []
    } else {
      resp = Array.isArray(props.entityModel) ? props.entityModel : props.entityModel ? [props.entityModel] : []
    }
    selectedItems.value = isMultiple.value ? resp : resp.slice(0, 1)
    emit('update:entityModel', resp.length === 1 ? resp[0] : resp)
  }
}, { immediate: true })

function clearValue() { emitValue([]) }
function handleSelect(items) { popoverVisible.value = false; emitValue(items) }
function handleConfirm(items) { emitValue(items) }

function emitValue(items) {
  if (isMultiple.value) {
    emit('update:modelValue', items.map(i => i.id).join(props.separator) || '')
  } else {
    emit('update:modelValue', items?.[0]?.id || '')
  }
  emit('update:entityModel', isMultiple.value ? items : items[0] || null)
  emit('selectedSuccess', items)
}

function openDialog() { dialogVisible.value = true }
function navigationTreeChange(arr) { emit('update:modelValue', arr?.id || '') }

onMounted(() => {
  if (inputRef.value?.$el) popoverWidth.value = Math.max(inputRef.value.$el.offsetWidth, 300)
})
</script>

<style lang="scss" scoped>
.select-main { position: relative; display: inline; }
.select-wrapper { display: inline-flex; align-items: center; width: 100%; position: relative; }
.input_btn { position: absolute; right: 4px; top: -1px; }
.prefix-icon { color: #c0c4cc; }
.clear-icon { cursor: pointer; margin-right: 4px; }
</style>
