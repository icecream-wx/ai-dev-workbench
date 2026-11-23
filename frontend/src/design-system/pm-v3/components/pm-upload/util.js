export default {
  isImage: fileType => {
    if (!fileType) fileType = ''
    fileType = fileType.toLowerCase()
    return /png|jpg|jpeg|svg|gif|bmp/.test(fileType)
  },
  isVideo: fileType => {
    if (!fileType) fileType = ''
    fileType = fileType.toLowerCase()
    return /mp4|webm|ogv|ogg/.test(fileType)
  },
  isText: fileType => {
    if (!fileType) fileType = ''
    fileType = fileType.toLowerCase()
    return /txt|log|java|sql|sh|bat|js|html|vue|xml|json|yaml/.test(fileType)
  },
  isExcel: fileType => {
    if (!fileType) fileType = ''
    fileType = fileType.toLowerCase()
    return /xls|xlsx/.test(fileType)
  },
  isAudio: fileType => {
    if (!fileType) fileType = ''
    fileType = fileType.toLowerCase()
    return /mp3|wav|wmv/.test(fileType)
  },
  isPdf: fileType => {
    if (!fileType) fileType = ''
    fileType = fileType.toLowerCase()
    return /pdf/.test(fileType)
  },
  isPpt: fileType => {
    if (!fileType) fileType = ''
    fileType = fileType.toLowerCase()
    return /ppt|pptx/.test(fileType)
  },
  isWeChatBrowser: () => {
    const userAgent = window.navigator.userAgent.toLowerCase()
    return !!userAgent.match(/micromessenger/i)
  },
  isWord: fileType => {
    if (!fileType) fileType = ''
    fileType = fileType.toLowerCase()
    return /doc|docx/.test(fileType)
  },
  openNewWindow: function(url) {
    const ua = navigator.userAgent
    const isDingTalk = /DingTalk/.test(ua)
    const isWeCom = /wxwork/.test(ua)
    if (isDingTalk || isWeCom || this.isWeChatBrowser()) {
      window.location.href = url
    } else {
      return window.open(url, '_blank')
    }
  },
  getFileIcon(type) {
    return ''
  },
  isPreviewSupported(fileName, moreList = []) {
    const ext = fileName.split('.').pop().toLowerCase()
    const supported = ['txt', 'docx', 'xlsx', 'pdf', 'jpg', 'png', 'jpeg', 'svg'].concat(moreList)
    return supported.includes(ext)
  }
}
