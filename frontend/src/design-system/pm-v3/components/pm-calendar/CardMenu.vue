<!-- 卡片记录右键菜单 -->
<template>
  <div
    v-show="show"
    class="card-menu"
    @click="onClickMenuItem"
  >
    <div 
      v-for="btn in rowConfig.buttons"
      :key="btn.id"
      :id="`dispatch:row:${btn.id}`"
      :class="`
        ${btn.id === 'delete' ? 'remove' : btn.id} 
        card-menu-item 
        ${disabledAttr(btn) ? 'disabled' : 'enabled'} 
        ${showAttr(btn)? 'show' : 'hidden'}`
      "
      :type="btn.type || 'default'" 
      :icon="btn.icon || ''"
    >{{ btn.showName || btn.showName === undefined ? btn.name : '' }}</div>
  </div>
      <!-- v-permission="btn.permissionCode || ''" -->
</template>

<script>
import { getElementsByClassName } from "./utils";

export default {
  name: "cardMenu",
  components: {},
  props: {
    cardMenuVisible: {
      type: Boolean,
      default: false,
    },
    rowConfig: {
      type: Object,
      default: () => ({}),
    },
    formData: {
      type: Object,
      default: () => ({}),
    },
    mergeReadonly: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      mouseListening: false,
    };
  },
  filters: {},
  computed: {
    show: {
      get() {
        return this.cardMenuVisible
      },
      set(val) {
        this.$emit("update:cardMenuVisible", val);
      },
    },
  },
  watch: {},
  created() {},
  mounted() {
    this.addListener();
  },
  beforeUnmount() {
    this.removeListener();
  },
  methods: {
    showAttr(btn) {
      if(!this.formData) return true
      const hasIfControlCode = btn.ifControl && btn.ifControlCode
      if(!hasIfControlCode) return btn.readonlyControl ? !this.mergeReadonly : true
      const showFn = new Function('formData', `return ${btn.ifControlCode}`)
      return showFn(this.formData)
    },
    disabledAttr(btn) {
      if(!this.formData) return false
      const hasControlCode = btn.disableControl && btn.disableControlCode
      if(!hasControlCode) return false
      const disabledFn = new Function('formData', `return ${btn.disableControlCode}`)
      return disabledFn(this.formData)
    },
    closeTitleMenu() {
      this.$emit('closeMenu');
    },
    onClickMenuItem(e) {
      const isDisabled = e.target.classList.contains('disabled')
      if(isDisabled) return
      const btnClass = e.target.classList[0]
      this.$emit('operRecord', { operType: btnClass });
      this.closeTitleMenu() 
    },
    mousewheelListener() {
      this.closeTitleMenu()
    },
    // 点击鼠标时, 判断点击位置是否落在菜单上, 不在菜单范围内则关闭菜单
    mouseDownListener(e) {
      let el = e.target;
      const menus = getElementsByClassName('card-menu');
      while (!menus.find(m => m === el) && el.parentElement) {
        el = el.parentElement;
      }
      if (!menus.find(m => m === el)) {
        this.closeTitleMenu()
      }
    },
    mouseClickListener(e) {
      let el = e.target;
      const menus = getElementsByClassName('card-menu');
      while (!menus.find(m => m === el) && el.parentElement) {
        el = el.parentElement;
      }
      if (!menus.find(m => m === el)) {
        this.closeTitleMenu()
      }
    },
    addListener() {
      if (!this.mouseListening) {
        document.addEventListener("click", this.mouseClickListener);
        document.addEventListener("mousedown", this.mouseDownListener);
        document.addEventListener("mousewheel", this.mousewheelListener);
        this.mouseListening = true;
      }
    },
    removeListener() {
      if (this.mouseListening) {
        document.removeEventListener("click", this.mouseClickListener);
        document.removeEventListener("mousedown", this.mouseDownListener);
        document.removeEventListener("mousewheel", this.mousewheelListener);
        this.mouseListening = false;
      }
    },
  },
};
</script>

<style scoped lang="scss">
.card-menu {
  position: fixed;
  z-index: 9999;
  top: 0;
  left: 0;
  border: 1px solid #EBEEF5;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  .card-menu-item {
    padding: 0 10px;
    line-height: 24px;
    font-size: 12px;
    font-weight: 400;
    color: #606266;
    background-color: #fff;
    cursor: pointer;
    text-align: center;
    &.disabled {
      color: #999;
      cursor: not-allowed;
    }
    &.enabled:hover {
      background-color: #ecf5ff;
      color: #66b1ff;
      outline: 1px solid rgb(140, 197, 255)!important;
    }
    &.show {
      display: block;
    }
    &.hidden {
      display: none;
    }
    .icon {
      margin: 0 8px;
    }
    .insert-num {
      display: inline-block;
      width: 34px;
      :deep(.el-input__inner) {
        padding: 0 8px;
      }
    }
  }
}
</style>
