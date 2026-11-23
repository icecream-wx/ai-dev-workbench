<template>
  <pm-dialog
    ref="dialog"
    append-to-body
    v-model="innerVisible"
    :title="title"
    v-bind="$attrs"
    :fullscreen="isFullscreen"
    :close-on-click-modal="false"
    :show-footer="showFooter"
    @update:fullscreen="val => isFullscreen = val"
  >
    <div :class="bodyClass">
      <slot name="form" />
    </div>
    <template v-if="showFooter" #footer>
      <el-button type="plain" @click="cancel">取消</el-button>
      <el-button v-if="submitable" type="primary" :loading="loading" @click="submit">提交</el-button>
    </template>
  </pm-dialog>
</template>

<script>
import { defineComponent } from 'vue'
import PmDialog from '../pm-dialog/pc.vue'

/**
 * 表单弹窗组件，集成表单的弹窗，支持表单提交、校验和重置
 */
export default defineComponent({
  name: 'PmFormDialog',
  components: { PmDialog },
  emits: ['update:dialogVisible', 'update:modelValue', 'cancel'],
  props: {
    dialogVisible: { type: Boolean, default: false },
    modelValue: { type: Boolean, default: undefined },
    okText: { type: String, default: null },
    cancelText: { type: String, default: null },
    submitable: { type: Boolean, default: true },
    title: { type: String, default: '' },
    loading: { type: Boolean, default: false },
    bodyClass: { type: String, default: null },
    formType: { type: String, default: 'form' },
    showFooter: { type: Boolean, default: true },
    inline: { type: Boolean, default: false },
    fullscreen: { type: Boolean, default: false },
  },
  data() {
    return {
      isFullscreen: this.fullscreen,
    }
  },
  computed: {
    innerVisible: {
      get() {
        return this.dialogVisible
      },
      set(val) {
        this.$emit('update:dialogVisible', val)
      },
    },
  },
  watch: {
    innerVisible(val) {
      if (!val) {
        this.cancel()
      }
    },
    fullscreen(val) {
      this.isFullscreen = val
    },
  },
  methods: {
    cancel() {
      this.$emit('update:dialogVisible', false)
      this.$emit('cancel')
    },
    async submit() {
      if (this.$attrs.onSubmit) {
        this.$emit('submit')
      } else if (this.formType === 'form') {
        const comp = this.getFormSlotComp()
        if (!comp) return
        if (this.inline) {
          comp.validate(async valid => {
            if (valid) {
              if (this.$parent.validateResolve) {
                if (await this.$parent.validateResolve.call(this.$parent, null)) {
                  this.cancel()
                }
              }
            } else {
              this.$parent.validateReject && this.$parent.validateReject.call(this.$parent, null)
            }
          })
        } else {
          if (comp.$refs?.[comp.formRef]) {
            comp.$refs[comp.formRef].validate(async valid => {
              if (valid) {
                if (comp.validateResolve) {
                  if (await comp.validateResolve.call(comp, null)) {
                    this.cancel()
                  }
                }
              } else {
                comp.validateReject && comp.validateReject.call(comp, null)
              }
            })
          }
        }
      } else {
        const comp = this.getFormSlotComp()
        if (this.inline) {
          if (this.$parent.callback && (await this.$parent.callback())) {
            this.cancel()
          }
        } else {
          if (comp?.callback && (await comp.callback())) {
            this.cancel()
          }
        }
      }
    },
    getFormSlotComp() {
      try {
        return this.findSlotComp(this.$.subTree)
      } catch (e) {
        return null
      }
    },
    findSlotComp(vnode) {
      if (!vnode) return null
      if (vnode.component?.proxy) {
        const proxy = vnode.component.proxy
        if (proxy.formRef || proxy.callback || proxy.validate) {
          return proxy
        }
      }
      if (vnode.component?.subTree) {
        const result = this.findSlotComp(vnode.component.subTree)
        if (result) return result
      }
      if (Array.isArray(vnode.children)) {
        for (const child of vnode.children) {
          const result = this.findSlotComp(child)
          if (result) return result
        }
      }
      return null
    },
    getRootForm() {
      return this.getFormSlotComp()
    },
    show() {
      this.$refs.dialog?.show()
    },
    hidden() {
      this.$refs.dialog?.hidden()
    },
  },
})
</script>

<style lang="scss" scoped>
:deep(.el-dialog__body) {
  padding: 0px !important;
}
</style>
