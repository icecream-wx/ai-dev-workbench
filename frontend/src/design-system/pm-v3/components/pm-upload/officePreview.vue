<template>
  <div id="vabOnlyOffice"></div>
</template>

<script>
export default {
  name: 'VabOnlyOffice',
  props: {
    option: { type: Object, default: () => ({}) },
  },
  data() {
    return {
      doctype: '',
      docEditor: null,
    }
  },
  beforeUnmount() {
    if (this.docEditor !== null) {
      this.docEditor.destroyEditor()
      this.docEditor = null
    }
  },
  watch: {
    option: {
      handler(n) {
        this.setEditor(n)
        this.doctype = this.getFileType(n.fileType)
      },
      deep: true,
    },
  },
  mounted() {
    if (this.option.url) {
      this.setEditor(this.option)
    }
  },
  methods: {
    async setEditor(option) {
      if (this.docEditor !== null) {
        this.docEditor.destroyEditor()
        this.docEditor = null
      }
      this.doctype = this.getFileType(option.fileType)
      const config = {
        document: {
          fileType: option.fileType,
          key: option.key || '',
          title: option.title,
          permissions: {
            edit: option.isEdit,
            print: option.isPrint,
            download: false,
          },
          url: option.url,
        },
        type: option.type,
        documentType: this.doctype,
        editorConfig: {
          callbackUrl: option.editUrl,
          lang: option.lang,
          customization: {
            help: false,
            autosave: false,
            chat: false,
            comments: false,
            hideRightMenu: false,
            plugins: false,
          },
          user: { id: option.user.id, name: option.user.name },
          mode: option.model ? option.model : 'edit',
        },
        width: '100%',
        height: '100%',
        token: option.token || '',
      }
      this.docEditor = new DocsAPI.DocEditor('vabOnlyOffice', config)
    },
    getFileType(fileType) {
      const fileTypesDoc = ['doc', 'docm', 'docx', 'dot', 'dotm', 'dotx', 'epub', 'fodt', 'htm', 'html', 'mht', 'odt', 'ott', 'pdf', 'rtf', 'txt', 'djvu', 'xps']
      const fileTypesCsv = ['csv', 'fods', 'ods', 'ots', 'xls', 'xlsm', 'xlsx', 'xlt', 'xltm', 'xltx']
      const fileTypesPPt = ['fodp', 'odp', 'otp', 'pot', 'potm', 'potx', 'pps', 'ppsm', 'ppsx', 'ppt', 'pptm', 'pptx']
      if (fileTypesDoc.includes(fileType)) return 'text'
      if (fileTypesCsv.includes(fileType)) return 'spreadsheet'
      if (fileTypesPPt.includes(fileType)) return 'presentation'
      return ''
    },
  },
}
</script>
