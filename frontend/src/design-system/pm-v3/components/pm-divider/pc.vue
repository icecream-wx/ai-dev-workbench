<template>
  <div class="pm-divider">
    <template v-if="componentProxy && divideType === 'custom'">
      <component :is="componentProxy" :id="randomId" v-bind="$attrs" @doFold="doFold" :isFold="isFold" />
    </template>
    <template v-else>
      <template v-if="optionTemplateIsEnable">
        <slot />
      </template>
      <template v-else>
        <el-divider v-if="divideType === 'line'" :content-position="contentPosition" :direction="direction">
          <span :id="randomId">
            <pm-icon v-if="icon" :value="icon" :style="{color: iconColor}" />
            <span class="anchor" :style="{color: titleColor}">{{ titleText }}</span>
          </span>
        </el-divider>
        <div v-else class="divide-bar" :style="{ '--contentPosition': contentPosition }">
          <span></span>
          <div :id="randomId" :style="{color: titleColor}">
            <pm-icon v-if="icon" :value="icon" :style="{color: iconColor}" />
            <div class="anchor" style="display: inline;">{{ titleText }}</div>
          </div>
        </div>
      </template>
    </template>
    <div class="fold" :class="divideType" v-if="foldable">
      <el-button @click="doFold" type="text" :icon="`el-icon-arrow-${isFold?'up':'down'}`" />
    </div>
  </div>
</template>

<script setup>
import { ref, getCurrentInstance } from 'vue'

/**
 * 分割线组件，带文字和字段映射的分割线，支持纵向和横向布局
 */
const props = defineProps({
  contentPosition: { type: String, default: 'center' },
  direction: { type: String, default: 'horizontal' },
  titleText: { type: String, default: '分割线' },
  divideType: { type: String, default: 'line' },
  componentProxy: { type: String, default: null },
  optionTemplateIsEnable: { type: Boolean, default: false },
  foldable: { type: Boolean, default: false },
  iconColor: { type: String, default: '' },
  titleColor: { type: String, default: '' },
  icon: { type: String, default: '' },
})

const randomId = ref('anchor' + (parseInt(Math.random() * 1000, 10) + 1))
const isFold = ref(false)
const instance = getCurrentInstance()

function getSiblings(element) {
  const siblings = []
  let sibling = element.parentNode.firstChild
  while (sibling) {
    if (sibling.nodeType === 1) {
      siblings.push(sibling)
    }
    sibling = sibling.nextSibling
  }
  return siblings
}

function getObjectsBetween(arr, obj1, obj2) {
  const index1 = arr.indexOf(obj1)
  const index2 = !obj2 ? arr.length : arr.indexOf(obj2)
  const result = []
  if (index1 !== -1 && index2 !== -1 && index1 < index2) {
    for (let i = index1 + 1; i < index2; i++) {
      result.push(arr[i])
    }
  }
  return result
}

function doFold() {
  isFold.value = !isFold.value
  const dividers = document.getElementsByClassName('pm-divider')
  let begin = instance.proxy.$el, end = null
  Array.prototype.map.call(dividers, (d, index) => {
    if (d === instance.proxy.$el) {
      end = (dividers.length > index + 1) ? dividers[index + 1] : null
    }
  })
  const siblings = getSiblings(begin.parentNode)
  const innerElements = getObjectsBetween(siblings, begin.parentNode, end?.parentNode)
  innerElements.forEach(el => {
    el.style.display = isFold.value ? 'none' : 'flex'
  })
}
</script>

<style lang="scss" scoped>
.pm-divider {
  width: 100%;
  position: relative;
  margin-bottom: 10px;
  .fold {
    position: absolute;
    right: 20px;
    top: 4px;
    &.line {
      top: 6px;
      .el-button {
        background-color: #fff;
      }
    }
  }
}
.divide-bar {
  position: relative;
  width: 100%;
  border: none;
  height: 40px;
  line-height: 40px;
  font-weight: 700;
  color: #999999;
  text-align: var(--contentPosition);
  background-color: #f5f5f5;
  overflow-x: hidden;
  margin-top: 0 !important;
  margin-bottom: 18px !important;
  span {
    position: absolute;
    left: 10px;
    border-left: 3px solid var(--tagBg);
    height: 20px;
    margin-top: 10px;
  }
  div {
    position: absolute;
    left: 20px;
    width: 95%;
    text-align: var(--contentPosition);
  }
}
</style>
