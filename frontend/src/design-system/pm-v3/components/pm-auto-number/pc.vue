<template>
  <null-value v-if="!modelValue && ($attrs.disabled || $attrs.readonly)" v-bind="$attrs"/>
  <el-input
    v-else
    style="display: block; width: 100%"
    v-bind="$attrs"
    :model-value="modelValue"
  >
  </el-input>
</template>
<script setup>
import { ref, getCurrentInstance, onMounted, nextTick } from 'vue'
import { useDispatchProxy, useControllers } from '../../composables/useDispatchProxy'
import { findComponentUpward } from '../../utils/util'
import NullValue from '../pm-null-value/pc.vue'

/**
 * 自动编号组件，自动生成并展示编号，支持前缀、后缀、日期格式等配置
 */
const props = defineProps({
  modelValue: {
    default: null,
  },
  mode: {
    default: 'edit', // 编辑模式和 edit， 展示模式 view
  },
  vModel: {
    default: '',
  },
  generateTime: {
    default: 'save',
  },
  entityName: {
    default: '',
  },
  formData: {
    default: '',
  },
})

const emit = defineEmits(['update:modelValue'])

const { dispatchProxy } = useDispatchProxy()
const Controllers = useControllers()
const instance = getCurrentInstance()

async function init() {
  const parentComp = findComponentUpward(instance)
  const formData = parentComp && parentComp.formData || props.formData
  const entityName = parentComp && parentComp.entityName || props.entityName
  const pkField = parentComp && parentComp.pkField || ''
  if (!formData || !entityName || !pkField) {
    return
  }
  if(formData && formData[pkField]) {
    return
  }
  const params = {
    entityName: entityName,
    propertyName: props.vModel,
  }
  const ruleProp = `__${props.vModel}_Number_Rules`
  if (
    props.vModel &&
    formData.hasOwnProperty(ruleProp) &&
    Object.keys(formData[ruleProp]).length >= 1
  ) {
    const { data } = await dispatchProxy(
      Controllers.LowcodeModelController.generateNumber,
      {
        params,
        payload: {
          model: formData,
        },
      }
    )
    if (data) {
      emit('update:modelValue', data)
    }
  }
}

onMounted(() => {
  nextTick(()=>{
    if (props?.generateTime === 'enterPage' && !props.modelValue) {
      init()
    }
  })
})
</script>
