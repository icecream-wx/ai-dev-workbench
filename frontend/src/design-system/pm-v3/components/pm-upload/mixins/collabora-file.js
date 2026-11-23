import { isLogicApp } from '../../../utils/util'
import bus from '../../../common/bus'
import { localStore } from '../../../utils/sessionStore'

export default {
  props: {
    showEdit: { type: Boolean, default: false },
    editFileType: { default: '.doc,.docx,.xls,.xlsx,.ppt,.pptx' },
  },
  computed: {
    dispatchProxy() {
      const globalConfig = localStore.get('globalConfig')
      if (globalConfig && globalConfig.dispatchProxy) {
        return globalConfig.dispatchProxy(this)
      }
      return this.dispatch
    },
  },
  data() {
    return {}
  },
  created() {},
  beforeUnmount() {},
  methods: {
    getEditFileTypes() {
      const fileTypes = Array.isArray(this.editFileType)
        ? this.editFileType
        : `${this.editFileType || ''}`.split(',')
      return fileTypes.map(item => item.trim().toLowerCase()).filter(Boolean)
    },
    getEditFileLimitSize() {
      return 50 * 1024 * 1024
    },
    getAttachmentByFileId(fileId) {
      const fileList = Array.isArray(this.valueObject)
        ? this.valueObject
        : Array.isArray(this.entityModel)
        ? this.entityModel
        : []
      return fileList.find(item => `${item.fileId}` === `${fileId}`) || null
    },
    showEditUnsupportedMessage() {
      this.showUnsupportedMessage('不支持在线编辑，请下载到本地编辑')
    },
    showPreviewUnsupportedMessage() {
      this.showUnsupportedMessage('不支持在线预览')
    },
    showUnsupportedMessage(message) {
      if (typeof ElMessage !== 'undefined' && ElMessage.warning) {
        ElMessage.warning(message)
        return
      }
      window.alert(message)
    },
    isOfficeFile(fileName = '') {
      if (!fileName) return false
      const normalizedFileName = `${fileName}`.trim().toLowerCase()
      const previewFileTypes = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']
      return previewFileTypes.some(fileType => normalizedFileName.endsWith(fileType))
    },
    isEditableFile(fileName = '') {
      if (this.mixEditable !== true || !this.showEdit || !fileName) return false
      const normalizedFileName = `${fileName}`.trim().toLowerCase()
      return this.getEditFileTypes().some(fileType => normalizedFileName.endsWith(fileType))
    },
    async openFile(fileId, mode, isMobile = false) {
      try {
        const attachment = this.getAttachmentByFileId(fileId)
        if (mode === 'edit' && (
          !attachment ||
          !this.isEditableFile(attachment.fileName) ||
          Number(attachment.fileSize || 0) > this.getEditFileLimitSize()
        )) {
          this.showEditUnsupportedMessage()
          return
        }
        if (mode === 'view' && (!attachment || !this.isOfficeFile(attachment.fileName))) {
          this.showPreviewUnsupportedMessage()
          return
        }
        const appName = this.getAppCode()
        const params = {
          fileId,
          mode,
          appName: isLogicApp(this, appName) ? 'afc' : appName,
        }
        const globalConfig = localStore.get('globalConfig')
        const Controllers = globalConfig && globalConfig.Controllers
        if (Controllers && Controllers.LowcodeModelController) {
          const res = await this.dispatchProxy(
            Controllers.LowcodeModelController.getWopiCoolUrl,
            params,
          )
          if (res && !res.error && res.data) {
            if (isMobile) {
              bus.emit('preview-attachment-collabora', {
                fileId,
                fileName: attachment.fileName,
                previewUrl: res.data,
              })
              return
            }
            window.open(res.data)
          }
        }
      } catch (error) {
        console.error('打开文件失败:', error)
        if (mode === 'edit') this.showEditUnsupportedMessage()
        else if (mode === 'view') this.showPreviewUnsupportedMessage()
      }
    },
  },
}
