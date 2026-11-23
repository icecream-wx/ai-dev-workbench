<template>
  <div>
    <div v-html="svgContent" v-if="currentFileType === 'svg'"></div>
    <component
      v-else-if="previewUrl && vueOfficeType && !officeServerUrl"
      :key="previewUrl"
      :is="currentFileType"
      :src="previewUrl"
      :options="options"
      :source="previewUrl"
      :style="currentStyle"
      @rendered="renderedHandler"
      @error="errorHandler"
    />
    <div style="height: 100vh" v-else-if="officeServerUrl">
      <OfficePreview :option="officePreviewOptions" v-if="officePreviewOptions" />
    </div>
  </div>
</template>

<script>
import textPreview from './textPreview.vue'
import axios from 'axios'
import { localStore } from '../../utils/sessionStore'
import OfficePreview from './officePreview.vue'
import loadScript from '../../utils/loadScript'
import { getUrlParam } from '../../utils/url'
export default {
  components: {
    VueOfficeDocx: () => import('@vue-office/docx'),
    VueOfficeExcel: () => import('@vue-office/excel'),
    VueOfficePdf: () => { return Promise.resolve({ template: '<div>PDF预览</div>' }) },
    textPreview,
    OfficePreview,
  },
  props: ['query'],
  data() {
    return {
      officePreviewOptions: null,
      svgContent: '',
      options: {
        xls: false,
        minColLength: 0,
        minRowLength: 0,
        widthOffset: 10,
        heightOffset: 10,
        beforeTransformData: workbookData => workbookData,
        transformData: workbookData => workbookData,
      },
    }
  },
  async created() {
    await this.loadScriptOffice()
    this.initOfficePreviewOptions()
  },
  computed: {
    isMobile() {
      const { fullPath } = this.$route
      return fullPath.indexOf('heigh-view') !== -1
    },
    officeServerUrl() {
      const { previewType, previewServerUrl } = this.query || this.$route.query
      const { officeServerUrl } = localStore.get('globalConfig') || {}
      if (this.currentFileType === 'ElImage') return ''
      return officeServerUrl || (previewType === 'OnlyOffice' && previewServerUrl)
    },
    vueOfficeType() {
      const query = this.query || this.$route.query
      const nameList = (decodeURIComponent(query.fileName) + '').toLowerCase().split('.')
      const endName = (nameList[nameList.length - 1] + '').toLowerCase()
      return ['txt', 'docx', 'xlsx', 'pdf', 'jpg', 'png', 'jpeg', 'svg'].indexOf(endName) !== -1
    },
    allOrigin() {
      const origin = window.location.origin
      const { subdomains } = localStore.get('globalConfig') || {}
      return `${origin}${subdomains || ''}`
    },
    previewUrl() {
      const { previewUrl } = { ...this.$route.query, ...this.query }
      let realUrl = decodeURIComponent(previewUrl)
      if (realUrl.indexOf('http') !== -1) {
        const ticket = getUrlParam('attachmentTicket', realUrl)
        realUrl = realUrl.replace(ticket, encodeURIComponent(ticket))
        return realUrl
      }
      return `${this.allOrigin}${decodeURIComponent(previewUrl)}`
    },
    currentStyle() {
      if (this.currentFileType === 'ElImage') {
        return { width: 'auto', height: 'auto' }
      }
      return { height: '100vh' }
    },
    currentFileType() {
      const query = { ...this.$route.query, ...this.query }
      const name = (decodeURIComponent(query.fileName) + '').toLowerCase()
      if (name.endsWith('docx')) return 'VueOfficeDocx'
      if (name.endsWith('xlsx') || name.endsWith('xls')) return 'VueOfficeExcel'
      if (name.endsWith('pdf')) return 'VueOfficePdf'
      if (name.endsWith('svg')) {
        this.downloadSvg(this.previewUrl)
        return 'svg'
      }
      if (name.endsWith('jpg') || name.endsWith('jpeg') || name.endsWith('png')) return 'ElImage'
      if (name.endsWith('txt') || name.endsWith('text')) return 'textPreview'
      return null
    },
  },
  methods: {
    async loadScriptOffice() {
      this.officePreviewOptions = null
      if (this.officeServerUrl) {
        return new Promise(resolve => {
          if (window.DocsAPI) { resolve(); return }
          loadScript(`${this.officeServerUrl}/web-apps/apps/api/documents/api.js`, () => {
            resolve()
          })
        })
      }
    },
    initOfficePreviewOptions() {
      if (this.previewUrl) {
        const query = { ...this.$route.query, ...this.query }
        const { fileName = '' } = query || {}
        const nameList = (decodeURIComponent(fileName) + '').toLowerCase().split('.')
        const endName = (nameList[nameList.length - 1] + '').toLowerCase()
        this.officePreviewOptions = {
          url: this.previewUrl,
          isEdit: false,
          fileType: endName,
          title: fileName,
          type: this.isMobile ? 'mobile' : 'pc',
          lang: 'zh-CN',
          isPrint: false,
          model: 'view',
          user: { id: '', name: '' },
        }
      }
    },
    async downloadSvg(url) {
      const res = await axios.get(url)
      this.svgContent = res.data
    },
    renderedHandler() {},
    errorHandler(err) {
      console.log('err:', err)
    },
  },
}
</script>
