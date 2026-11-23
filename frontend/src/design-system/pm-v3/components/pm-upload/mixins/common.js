import Util from '../util.js'
export default {
  props: {
    previewServices: {
      type: Array,
      default: () => [],
    },
    controlAction: {
      type: Boolean,
      default: true,
    },
    isTextWrap: {
      type: Boolean,
      default: true,
    },
  },
  computed: {
    isCollapseUploadText() {
      return !this.isTextWrap
    },
  },
  methods: {
    // 按扩展名匹配启用的服务，优先级数值越小越优先。
    getPreviewServiceByFileName(fileName) {
      if (!Array.isArray(this.previewServices) || !this.previewServices.length) {
        return null
      }
      const fileExt = this.getFileExtension(fileName)
      if (!fileExt) {
        return null
      }
      const services = this.previewServices
        .filter(item => item && item.enabled !== false)
        .map(item => ({
          ...item,
          extensions: Array.isArray(item.extensions)
            ? item.extensions
            : String(item.extensions || '').split(',').map(ext => ext.trim()).filter(Boolean),
        }))
        .filter(item => item.extensions.some(ext => this.normalizeExtension(ext) === fileExt))
        .sort((a, b) => Number(a.priority) - Number(b.priority))
      return services[0] || null
    },
    // 提取附件扩展名。
    getFileExtension(fileName) {
      const name = String(fileName || '')
      const lastDotIndex = name.lastIndexOf('.')
      if (lastDotIndex === -1) {
        return ''
      }
      return this.normalizeExtension(name.slice(lastDotIndex + 1))
    },
    // 统一扩展名的点号、空格和大小写。
    normalizeExtension(ext) {
      return String(ext || '').trim().replace(/^\./, '').toLowerCase()
    },
    // 普通附件使用临时地址，OSS 附件使用签名地址。
    async getPreviewFileUrl() {
      if (this.isOss) {
        return this.getOssPreviewUrl()
      }
      return this.getTempFileUrlApi(this.currentFile)
    },
    // 凭证过期时先刷新，再生成一小时有效的预览地址。
    async getOssPreviewUrl() {
      if (this.isCredentialsExpired()) {
        this.newClient = await this.getOssClient()
      }
      return this.newClient.signatureUrl(this.currentFile.fileName, { expires: 3600 })
    },
    getObjectIsEmpty(obj) {
      if (Array.isArray(obj) && obj.length) return false
      if (typeof obj === 'object' && obj) {
        const { fileId } = obj
        return !fileId
      }
      return true
    },
    getIsShowDelete(file) {
      let flag = true
      this.$emit('allowDelete', {
        file,
        callback: isAllow => { flag = isAllow },
      })
      return this.controlAction && flag
    },
    async getFileIsAllowUpload(file) {
      let flag = true
      const ext = await this.getImageInfo(file)
      this.$emit('beforeUpload', {
        file,
        ext,
        callback: newCondition => { flag = newCondition },
      })
      return flag
    },
    async getImageInfo(file) {
      if (!Util.isImage(file.type)) return file
      return new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = function(event) {
          const txt = event.target.result
          const img = document.createElement('img')
          img.src = txt
          img.onload = function() {
            resolve({ ...file, width: img.width, height: img.height })
          }
        }
        reader.readAsDataURL(file)
      })
    },
  },
}
// Modified by AI on 2026-10-29 17:04:34
