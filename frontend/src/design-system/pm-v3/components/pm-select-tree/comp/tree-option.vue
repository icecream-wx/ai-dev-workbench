<template>
  <span class="custom-tree-node" >
    <slot v-if="optionTemplateIsEnable" :data="data" :labelField="labelField" :settings="settings" :isJSON="isJSON" />
    <span v-else :id="currentKey + data[labelField]">
      <i v-if="!isJSON && (data.fieldIcon ? data[data.fieldIcon] : data.iconClass)" :class="data.fieldIcon ? data[data.fieldIcon] : data.iconClass" />
      <i v-else-if="isJSON && (settings.JsonPanel.fieldIcon ? data[settings.JsonPanel.fieldIcon] : settings.JsonPanel.iconClass)" :class="settings.JsonPanel.fieldIcon ? data[settings.JsonPanel.fieldIcon] : settings.JsonPanel.iconClass" />
      {{ data.label || data[labelField]  }}
    </span>
    <span v-if="!(isEntityData && !isStaticTreeSearch) && isTreeMode">
      <i
        class="el-icon-aim mr-10 icon-aim"
        v-if="node.level === 1 && isAddTrackPosition && filterEntityText"
        @click.stop="()=>$emit('handleClickSetPosition', data)"
      />
    </span>
  </span>
</template>

<script>
import common from '../common'
export default {
  mixins: [common],
  props: {
    data: {
      default: null,
    },
    currentKey: {
      default: '',
    },
    node: {
      default: null,
    },
    filterEntityText: {
      default: '',
    },
    settings: {
      type: Object,
      default: () => ({}),
    },
    optionTemplateIsEnable: {
      type: Boolean,
      default: true,
    },
  },
  methods: {
    
  },
}
</script>

<style lang="scss" scoped>
.custom-tree-node {
  display: flex;
  justify-content: space-between;
  width: 100%;
  .icon-aim {
    font-size: 14px;
  }
}
</style>
