import { findAppName, getQueryVariable } from '../../../utils/util'
import axios from 'axios'
import { localStore } from '../../../utils/sessionStore'
export default {
  computed: {
    dispatchProxy() {
      const globalConfig = localStore.get('globalConfig')
      if (globalConfig && globalConfig.dispatchProxy) {
        return globalConfig.dispatchProxy(this)
      }
      return this.dispatch
    },
    isExpress() {
      const globalConfig = localStore.get('globalConfig')
      return !!(globalConfig && globalConfig.isExpress)
    },
    prefix() {
      const globalConfig = localStore.get('globalConfig')
      if (globalConfig && globalConfig.apiPrefix && globalConfig.apiPrefix.path) {
        const path = globalConfig.apiPrefix.path
        return path.endsWith('/') ? path.slice(0, -1) : path
      }
      return ''
    },
    allOrigin() {
      const origin = window.location.origin
      const { subdomains } = localStore.get('globalConfig') || {}
      return `${origin}${subdomains || ''}`
    },
    isLogicApp() {
      const appInfo = localStore.get('appInfo')
      const appName = this.getAppCode()
      return !!(appInfo && appInfo[appName] && appInfo[appName].types === 'logic')
    },
    apiBase() {
      if (this.isLogicApp) return `${this.allOrigin}/afc`
      return `${this.allOrigin}${this.isExpress ? this.prefix : '/' + this.getAppCode()}`
    },
    urlPre() {
      return this.apiBase
    },
  },
  methods: {
    getFileUrl(fileId) {
      const url = typeof this.fileUrl === 'function'
        ? this.fileUrl(fileId)
        : `/api/lowcode/models/attachments/${fileId}/actions/download`
      if (this.isLogicApp) return `/afc${url}`
      return this.isExpress ? `${this.prefix}${url}` : url
    },
    getPreviewUrl(fileId) {
      const url = typeof this.previewUrl === 'function'
        ? this.previewUrl(fileId)
        : `/api/lowcode/models/attachments/${fileId}/actions/preview`
      if (this.isLogicApp) return `/afc${url}`
      return this.isExpress ? `${this.prefix}${url}` : url
    },
    getAppCode() {
      return getQueryVariable('appName') || findAppName(this)
    },
    async getFileInfo(fileId) {
      const globalConfig = localStore.get('globalConfig')
      const Controllers = globalConfig && globalConfig.Controllers
      if (Controllers && Controllers.LowcodeModelController) {
        const { data } = await this.dispatchProxy(Controllers.LowcodeModelController.getAttachments, {
          attachmentIds: fileId,
        })
        return data
      }
      const resp = await axios.get(`${this.apiBase}/api/lowcode/models/attachments/actions/query`, {
        params: { attachmentIds: fileId },
      })
      return resp.data
    },
    async getTempFileUrlApi(file) {
      const { fileId } = file
      const globalConfig = localStore.get('globalConfig')
      const Controllers = globalConfig && globalConfig.Controllers
      if (Controllers && Controllers.LowcodeModelController) {
        const resp = await this.dispatchProxy(Controllers.LowcodeModelController.getAttachmentToken, {
          attachmentId: fileId,
        })
        return `${this.apiBase}/api/lowcode/models/actions/third/download?attachmentTicket=${resp.data}`
      }
      const resp = await axios.get(`${this.apiBase}/api/lowcode/models/attachments/${fileId}/actions/download`)
      return resp.data
    },
    async removeFileApi(fileId) {
      const globalConfig = localStore.get('globalConfig')
      const Controllers = globalConfig && globalConfig.Controllers
      if (Controllers && Controllers.LowcodeModelController) {
        await this.dispatchProxy(Controllers.LowcodeModelController.removeAttachment, {
          attachmentId: fileId,
        })
        return
      }
      await axios.delete(`${this.apiBase}/api/lowcode/models/attachments/${fileId}/actions/delete`)
    },
    async customRemoveApi(url) {
      return axios.delete(url)
    },
    async getOssSTSTokenApi() {
      const url = `${this.apiBase}/api/lowcode/oss-auth/token`
      const res = await axios.get(url)
      return res.data
    },
    async addOssFileApi(data) {
      const url = `${this.apiBase}/api/lowcode/models/attachments/create`
      const res = await axios.post(url, data)
      return res.data
    },
    async getSvgApi(url) {
      const res = await axios.get(url)
      return res.data
    },
    uploadNormalFileApi(url, params, onUploadProgress) {
      const headers = { ...(this.headers || {}) }
      if (localStore.get('isShare')) {
        headers.Authorization = ''
        headers.shareSignature = localStore.get('shareSignature')
        headers.appName = localStore.get('appName')
      }
      return axios.post(url, params, { headers, onUploadProgress })
    },
  },
}
