<template>
  <el-dialog
    v-model="dialogVisible"
    v-bind="$attrs"
    :title="title"
    :append-to-body="appendToBody"
    :close-on-click-modal="closeOnClickModal"
    :show-close="showClose"
    :fullscreen="effectiveFullscreen"
    :align-center="true"
    :draggable="draggable && !effectiveFullscreen"
    :before-close="handleBeforeClose"
    :trap-focus="trapFocus"
    @closed="closed"
    @open="onOpen"
  >
    <template #header>
      <div ref="headerRef">
        <slot name="title">
          <span>{{ title }}</span>
        </slot>
        <button
          v-if="fullscreen !== 'disable' && showFullScreenButton"
          type="button"
          class="pm-dialog__fullscreen-btn"
          :title="effectiveFullscreen ? '退出全屏' : '全屏'"
          @click.stop="switchFullscreen"
          @mousedown.stop
          @dragstart.prevent
        >
          <slot name="icon">
            <el-icon>
              <ScaleToOriginal v-if="effectiveFullscreen" />
              <FullScreen v-else />
            </el-icon>
          </slot>
        </button>
      </div>
    </template>
    <div class="pm-dialog__body" :style="bodyStyle">
      <slot />
    </div>
    <div v-if="showFooter" class="el-dialog__footer dialog-footer" :style="footerStyle">
      <slot name="footer" />
    </div>
  </el-dialog>
</template>

<script>
import { defineComponent } from 'vue'
import { FullScreen, ScaleToOriginal } from '@element-plus/icons-vue'

/**
 * 弹窗组件，增强的 el-dialog，支持全屏切换、拖拽、最大化等高级功能
 */
export default defineComponent({
  name: 'PmDialog',
  components: { FullScreen, ScaleToOriginal },
  emits: ['update:modelValue', 'update:visible', 'update:fullscreen', 'confirm-close'],
  props: {
    modelValue: { type: Boolean, default: false },
    visible: { type: Boolean, default: undefined },
    title: { type: String, default: '' },
    appendToBody: { type: Boolean, default: true },
    closeOnClickModal: { type: Boolean, default: false },
    draggable: { type: Boolean, default: true },
    fullscreen: { type: [Boolean, String], default: false },
    footerHeight: { type: Number, default: 60 },
    showFooter: { type: Boolean, default: true },
    showFullScreenButton: { type: Boolean, default: true },
    showClose: { type: Boolean, default: true },
    // 关闭守卫：返回 false / Promise<false> 时阻止用户关闭（X、ESC、遮罩）
    beforeClose: { type: Function, default: undefined },
    // 脏数据标记：为 true 且未提供 beforeClose 时，用户关闭会触发 confirm-close 事件并拦截
    dirty: { type: Boolean, default: false },
    // 是否启用焦点陷阱（打开时聚焦弹窗内、Tab 限制在弹窗内、关闭后归还焦点）
    trapFocus: { type: Boolean, default: true },
    testId: { type: String, default: '' },
  },
  data() {
    return {
      isFullscreen: this.fullscreen === true,
      headerHeight: 24,
      _resizeObserver: null,
    }
  },
  computed: {
    dialogVisible: {
      get() {
        return this.visible !== undefined ? this.visible : this.modelValue
      },
      set(val) {
        this.$emit('update:modelValue', val)
        this.$emit('update:visible', val)
      },
    },
    effectiveFullscreen() {
      return this.fullscreen === 'disable' ? false : this.isFullscreen
    },
    bodyStyle() {
      if (this.effectiveFullscreen) {
        // 顶部留白(对话框上内边距16) + header 内容(headerHeight) + header 下内边距16
        // + footer 固定高度 + 对话框下内边距16 = headerHeight + footerHeight + 32
        return {
          height: `calc(100vh - ${this.headerHeight + this.footerHeight + 32}px)`,
          overflowY: 'auto',
        }
      }
      return {
        maxHeight: `calc(100vh - ${this.showFooter ? this.footerHeight + 200 : 200}px)`,
      }
    },
    footerStyle() {
      if (this.effectiveFullscreen) {
        return {
          position: 'fixed',
          bottom: '0',
          left: '0',
          right: '0',
          zIndex: '3000',
          height: `${this.footerHeight}px`,
          background: 'var(--el-bg-color, #fff)',
          borderTop: '1px solid var(--el-border-color-lighter, #ebeef5)',
          paddingLeft: '16px',
          paddingRight: '16px',
        }
      }
      return { height: `${this.footerHeight}px` }
    },
  },
  watch: {
    fullscreen(val) {
      this.isFullscreen = val === true
    },
    effectiveFullscreen() {
      this.$nextTick(this.setupHeaderMeasure)
    },
  },
  methods: {
    show() {
      this.dialogVisible = true
    },
    hidden() {
      this.dialogVisible = false
    },
    // 用户关闭（X / ESC / 遮罩）时触发；done(true) 取消关闭
    handleBeforeClose(done) {
      const proceed = () => done()
      const cancel = () => done(true)
      if (typeof this.beforeClose === 'function') {
        Promise.resolve(this.beforeClose())
          .then((res) => (res === false ? cancel() : proceed()))
          .catch(() => cancel())
        return
      }
      if (this.dirty) {
        this.$emit('confirm-close')
        cancel()
        return
      }
      proceed()
    },
    onOpen() {
      this.$nextTick(this.setupHeaderMeasure)
    },
    // 用 ResizeObserver 持续监测 header 高度，标题换行/字体缩放时动态重算 body 高度
    setupHeaderMeasure() {
      const el = this.$refs.headerRef
      if (!el) return
      this.headerHeight = el.offsetHeight
      if (this._resizeObserver) this._resizeObserver.disconnect()
      if (typeof ResizeObserver !== 'undefined') {
        this._resizeObserver = new ResizeObserver(() => {
          if (this.$refs.headerRef) this.headerHeight = this.$refs.headerRef.offsetHeight
        })
        this._resizeObserver.observe(el)
      }
    },
    disconnectObserver() {
      if (this._resizeObserver) {
        this._resizeObserver.disconnect()
        this._resizeObserver = null
      }
    },
    switchFullscreen() {
      if (this.fullscreen === 'disable') return
      this.isFullscreen = !this.isFullscreen
      this.$emit('update:fullscreen', this.isFullscreen)
    },
    onOpen() {
      this.$nextTick(this.measureHeader)
    },
    measureHeader() {
      const el = this.$refs.headerRef
      if (el) this.headerHeight = el.offsetHeight
    },
    closed() {
      this.disconnectObserver()
      if (this.fullscreen !== 'disable' && this.isFullscreen) {
        this.isFullscreen = false
        this.$emit('update:fullscreen', false)
      }
    },
    beforeUnmount() {
      this.disconnectObserver()
    },
  },
})
</script>

<style scoped lang="scss">
.pm-dialog__fullscreen-btn {
  position: absolute;
  top: 15px;
  right: 45px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--el-color-info, #909399);
  font-size: 16px;
  line-height: 1;

  &:hover {
    color: var(--el-color-primary, #409eff);
  }

  .el-icon {
    font-size: 18px;
  }
}
/* 普通模式：保持原有块级排版与 body 内部滚动 */
:deep(.el-dialog__body) {
  padding-bottom: 0;
}
.pm-dialog__body {
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 0;
}
.dialog-footer {
  box-sizing: border-box;
}
:deep(.el-dialog.is-fullscreen) {
  left: 0 !important;
}
:deep(.is-fullscreen) {
  left: 0 !important;
  top: 0 !important;
}
</style>
