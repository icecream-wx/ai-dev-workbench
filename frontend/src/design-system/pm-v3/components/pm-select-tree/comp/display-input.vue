<template>
  <span v-if="mode === 'view' && selected">{{ viewSelectedLabel }}</span>
  <div v-else>
    <div v-if="tagList.length" class="display-box" :class="mode === 'view' && 'view-display-box' || !multiple && isHighlight && 'single-display-box' || disabled && 'disabled-display-box'">
      <el-tooltip  placement="bottom" :disabled="mode === 'edit'" popper-class="custom-tips-box">
        <template #content>
          <span v-for="(tag) in tagList" :key="tag.value">
            {{tag.label}}&nbsp;<br/>
          </span>
        </template>
        <div class="custom-tag-box" v-if="isHighlight" :class="!multiple && 'single-custom-tag-box'">
          <el-tag v-for="tag in tagList" :key="tag.value" :closable="!!(multiple && mode==='edit' && !disabled)"  @close="handleClose(tag)">{{tag.label}}</el-tag>
        </div>
        <div class="custom-tag-box" :class="!multiple && 'single-custom-tag-box'" v-else>
          <span v-for="(tag, index) in tagList" :key="tag.value">{{tag.label}}{{index === tagList.length - 1 ? '' : ' '}} &nbsp;</span>
        </div>
      </el-tooltip>
    </div>
    <span v-else>
      <span v-if="mode === 'view'">{{formatNullValue }}</span>
    </span>
  </div>
</template>

<script>
import common from '../common'
import formatNullValue from "../../../components/mixins/formatNullValue.js";
export default {
  mixins: [common,formatNullValue],
  props: {
    cloneEntityModel: {
      default: null,
    },
    displayField: {
      default: '',
    },
    mode: {
      default: '',
    },
    isHighlight: {
      default: false,
    },
    multiple: {
      default: false,
    },
    disabled: {
      default: false,
    },
    separator: {
      default: '',
    },
    settings: {
      type: Object,
      default: () => ({}),
    },
    placeholder: {
      type: String,
      default: () => {
        return '请输入'
      },
    },
    selected: { default: undefined },
  },
  // watch: {
  //   cloneEntityModel: {
  //     immediate: true,
  //     handler(val) {
  //       if(this.isAllMode || !val) {
  //         this.tagList = []
  //       }
  //       const list = Array.isArray(val) && val.filter((item)=>item) || [val]
  //       if(this.isTreeMode) {
  //         this.tagList = this.getTreeModeTagList(list)
  //       } else {
  //         this.tagList = this.getCasTagList(list)
  //       }
  //     },
  //   },
  // },
  computed: {
    isShowDisplay() {
      
    },
    viewSelectedLabel() {
      if (this.selected == null) return ''
      if (Array.isArray(this.selected)) {
        return this.selected.map(item => item[this.labelField] || item.label || '').filter(Boolean).join('、')
      }
      return this.selected?.[this.labelField] || this.selected?.label || ''
    },
    tips() {
      return this.tagList.map((ele)=>{
        return ele.label
      }).join('<br/>')
    },
    tagList() {
      if(this.mode === 'view' && this.isAllMode && this.displayField) {
        return this.displayField && this.displayField.split('  ').map((ele)=>{
          return {
            label: ele,
            value: ele,
          }
        }) || []
      }
      if(!this.cloneEntityModel || (typeof this.cloneEntityModel === 'object' && !Array.isArray(this.cloneEntityModel) && this.cloneEntityModel.hasOwnProperty('id') && this.cloneEntityModel.hasOwnProperty('name') && !this.cloneEntityModel.id && !this.cloneEntityModel.name)) {
        return []
      }
      
      const list = Array.isArray(this.cloneEntityModel) && this.cloneEntityModel.filter((item)=>item) || [this.cloneEntityModel]
      if(this.isTreeMode) {
        return this.getTreeModeTagList(list)
      } else {
        return this.getCasTagList(list)
      }
    },
  },
  methods: {
    // 获取树形模式下tagList
    getTreeModeTagList(list) {
      if(!Array.isArray(list)) {
        return []
      }
      return list.map((item)=>{
        return {
          ...item,
          label: item && item[this.labelField] || item.label,
          value: item && item[this.valueField]
        }
      }).filter((item)=>item)
    },
    // 获取层级模式下的tagList
    getCasTagList(list) {
      if(!Array.isArray(list)) {
        return []
      }
      return list.map((item)=>{
        return {
          ...item,
          label: item && item[this.labelField] || item.label,
          value: item && item[this.valueField]
        }
      }).filter((item)=>item)
    },
    handleClose(tag) {
      const result = Array.isArray(this.cloneEntityModel) ? this.cloneEntityModel : [this.cloneEntityModel]
      const filterRes = result.filter((item)=>item[this.valueField] !== tag.value)
      this.$emit('selectTreeChange', filterRes)
    }
  }
}
</script>

<style lang="scss" scoped>
.custom-tag-box { 
  width: 100%;
  line-height: 20px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  background: #fff;
  border-radius: 15px;
  &.single-custom-tag-box {
    .el-tag {
      font-size: 15px;
    }
  }
  .el-tag {
    display: inline-flex;
    background: rgba(24, 144, 255, 0.15);
    color: rgb(24, 144, 255);
    border-radius: 15px;
    padding: 3px 6px;
    margin-right: 4px;
    align-items: center;
    white-space: nowrap;
    font-size: 15px;
    &:last-child {
      margin-right: 0;
    }
  }
}
.display-box {
  position: absolute;
  top: 4px;
  left: 1px;
  z-index: 2;
  height: 22px;
  align-items: center;
  padding-left: 5px;
  display: none;
  max-width: calc(100% - 30px);
  &.single-display-box {
    display: block;
  }
  &.view-display-box {
    max-width: 100%;
    position: relative;
    padding-left: 0;
    overflow: hidden;
    flex-wrap: nowrap;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: transparent;
    display: block;
    top: 0;
    left: 0;
    .custom-tag-box {
      width: 100%;
      height: 20px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      background: transparent;
      display: block;
    }
  }
  &.disabled-display-box {
    display: block;
    background: rgb(245, 245, 245);
    width: 100%;
    max-width: calc(100% - 5px);
    height: calc(100% - 5px);
    word-break: break-all;
    overflow: hidden;
    text-overflow: ellipsis;
    .custom-tag-box {
      padding-right: 10px;
      background: rgb(245, 245, 245);
    }
  }
  .input-box {
    flex: 1;
    // position: absolute;
  }
}

</style>