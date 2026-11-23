import { debounce } from 'lodash'

const BATCH_DOWNLOAD_THRESHOLD = 3

export default {
  props: {
    showDownlowdeAll: { default: true },
    downlowdeAllUrl: {
      default: (ids) => `/api/afc/attachments/actions/batch-download?attachmentIds=${ids}`,
    },
  },
  computed: {
    showBatchDownloadButton() {
      return this.getIsShowDownlowdeAll() && this.valueObject.length > 1
    },
  },
  data() {
    return {
      handleBatchDownloadClick: null,
      isBatchDownloading: false,
    }
  },
  created() {
    this.handleBatchDownloadClick = debounce(() => {
      this.confirmBatchDownload()
    }, 800, { leading: true, trailing: false })
  },
  beforeUnmount() {
    if (this.handleBatchDownloadClick && this.handleBatchDownloadClick.cancel) {
      this.handleBatchDownloadClick.cancel()
    }
  },
  methods: {
    async confirmBatchDownload() {
      if (!this.showBatchDownloadButton || this.isBatchDownloading) return
      const total = this.valueObject.length
      const isZipDownload = total > BATCH_DOWNLOAD_THRESHOLD
      const message = isZipDownload
        ? `当前共 ${total} 个附件，系统将自动压缩为ZIP包下载，是否继续？`
        : `是否确认下载全部 ${total} 个附件？`
      try {
        await this.batchDownloadConfirm(message)
        this.isBatchDownloading = true
        if (isZipDownload) {
          await this.downloadAttachmentsAsZip()
        } else {
          await this.downloadAttachmentsInParallel()
        }
      } catch (error) {
        console.error('全部下载失败:', error)
        if (error !== 'cancel' && error !== 'close') {
          this.notifyBatchDownloadError()
        }
      } finally {
        this.isBatchDownloading = false
      }
    },
    batchDownloadConfirm(message) {
      if (typeof ElMessageBox !== 'undefined' && ElMessageBox.confirm) {
        return ElMessageBox.confirm(message, '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning',
        })
      }
      return new Promise((resolve, reject) => {
        if (window.confirm(message)) resolve()
        else reject('cancel')
      })
    },
    notifyBatchDownloadError() {
      if (typeof ElMessage !== 'undefined') {
        ElMessage.error('全部下载失败')
        return
      }
      window.alert('全部下载失败')
    },
    async downloadAttachmentsInParallel() {
      await Promise.all(this.valueObject.map(attachment => this.downloadAttachment(attachment)))
    },
    async downloadAttachment(attachment) {
      if (!attachment) return
      if (this.isOss) {
        await this.downloadOssFile(attachment.fileName)
        return
      }
      this.triggerLinkDownload(this.getFileUrl(attachment.fileId) + this.headersParam, attachment.fileName)
    },
    async downloadAttachmentsAsZip() {
      const attachmentIds = this.valueObject.map(item => item.fileId).filter(Boolean)
      if (!attachmentIds.length) return
      const url = this.resolveBatchDownloadAction(attachmentIds)
      const fileName = this.buildFileName()
      this.triggerLinkDownload(url, fileName)
    },
    getBatchDownloadUrl(attachmentIds) {
      const ids = encodeURIComponent(attachmentIds.join(','))
      const url = typeof this.downlowdeAllUrl === 'function'
        ? this.downlowdeAllUrl(attachmentIds)
        : `/api/afc/attachments/actions/batch-download?attachmentIds=${ids}`
      if (url.startsWith('http://') || url.startsWith('https://')) return url
      return `${this.apiBase}${url}`
    },
    resolveBatchDownloadAction(attachmentIds) {
      const url = this.getBatchDownloadUrl(attachmentIds)
      const headersParam = this.headersParam.startsWith('?') ? this.headersParam.slice(1) : this.headersParam
      return `${url}&${headersParam}`
    },
    buildFileName() {
      const date = new Date()
      const pad = (value) => `${value}`.padStart(2, '0')
      const datePart = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
      const timePart = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
      return `附件合集_${datePart}${timePart}.zip`
    },
    triggerLinkDownload(url, fileName) {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName || ''
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    },
    getIsShowDownlowdeAll() {
      let flag = this.showDownlowdeAll
      this.$emit('allowDownlowdeAll', {
        fileList: this.valueObject,
        callback: isAllow => { flag = isAllow },
      })
      return flag
    },
  },
}
