<template>
  <Editor
    style="width:100%;"
    :id="editorId"
    :model-value="modelValue"
    :init="editorInit"
    :disabled="disabled || readonly"
    @onClick="handleClick"
    @update:modelValue="handleUpdate"
  />
</template>

<script setup>
import { ref, computed, onBeforeUnmount, getCurrentInstance } from 'vue'
import tinymce from 'tinymce/tinymce'
import Editor from '@tinymce/tinymce-vue'
import 'tinymce/models/dom'
import 'tinymce/themes/silver/theme.min.js'
import './css.css'
import 'tinymce/icons/default/icons'
// 预览接入：TinyMCE 皮肤/内容样式随包内联，避免运行时再去请求 skins 静态资源
import 'tinymce/skins/ui/oxide/skin.min.css'
import 'tinymce/plugins/image'
import 'tinymce/plugins/link'
import 'tinymce/plugins/autoresize'
import 'tinymce/plugins/code'
import 'tinymce/plugins/table'
import 'tinymce/plugins/lists'
import 'tinymce/plugins/wordcount'
import 'tinymce/plugins/preview'
import 'tinymce/plugins/searchreplace'
import 'tinymce/plugins/autolink'
import 'tinymce/plugins/charmap'
// 预览接入：emoticons 需要额外运行时 emojis.js（会请求 /plugins/emoticons/js/emojis.js），预览内不启用
import 'tinymce/plugins/visualchars'
import 'tinymce/plugins/anchor'
import 'tinymce/plugins/fullscreen'
import 'tinymce/plugins/media'
// TinyMCE 6 起 paste/hr/print 已并入核心，不再有独立插件入口
import 'tinymce/plugins/pagebreak'
import 'tinymce/plugins/insertdatetime'
import './zh_CN.js'

import axios from 'axios'
import { localStore } from '../../utils/sessionStore'
import { findAppName, getQueryVariable } from '../../utils/util'
import bus from '../../common/bus'

/**
 * 富文本编辑器组件，基于 TinyMCE 的富文本编辑器，支持多种格式和插件
 */
const instance = getCurrentInstance()

const props = defineProps({
  id: { type: String, default: 'pm-rich-text' },
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  clickValue: { type: String, default: '' },
  autoresize: { type: Boolean, default: true },
  plugins: {
    type: [String, Array],
    default: 'link lists image code table wordcount preview searchreplace autolink charmap visualchars anchor fullscreen pagebreak insertdatetime media',
  },
  minHeight: { type: Number, default: null },
  maxHeight: { type: Number, default: null },
  height: { type: Number, default: 300 },
  fontFormats: {
    default: '微软雅黑=Microsoft YaHei,Helvetica Neue,PingFang SC,sans-serif;苹果苹方=PingFang SC,Microsoft YaHei,sans-serif;宋体=simsun,serif;仿宋体=FangSong,serif;黑体=SimHei,sans-serif;Arial=arial,helvetica,sans-serif;Arial Black=arial black,avant garde;Book Antiqua=book antiqua,palatino;',
  },
  toolbar: {
    type: [String, Array],
    // 预览接入：去掉 TinyMCE 6 已移除的 styleselect/paste/print/hr/lineheight 等按钮
    default: 'code undo redo | cut copy pastetext | forecolor backcolor bold italic underline strikethrough link anchor | alignleft aligncenter alignright alignjustify outdent indent | formatselect fontselect fontsizeselect | bullist numlist | blockquote subscript superscript removeformat | table image media charmap pagebreak insertdatetime preview',
  },
  action: { default: '/api/lowcode/models/attachments/actions/upload' },
  fileUrl: { type: Function, default: null },
  headers: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:modelValue', 'onClick'])

const isExpress = computed(() => {
  const globalConfig = localStore.get('globalConfig')
  return !!(globalConfig && globalConfig.isExpress)
})

const prefix = computed(() => {
  const globalConfig = localStore.get('globalConfig')
  if (globalConfig && globalConfig.apiPrefix?.path) {
    const path = globalConfig.apiPrefix.path
    return path.endsWith('/') ? path.slice(0, -1) : path
  }
  return ''
})

const allOrigin = computed(() => {
  const origin = window.location.origin
  const { subdomains } = localStore.get('globalConfig') || {}
  return `${origin}${subdomains || ''}`
})

function getAppCode() {
  return getQueryVariable('appName') || findAppName(instance?.proxy)
}

const urlPre = computed(() => {
  return props.isExpress ? `${allOrigin.value}${prefix.value}` : `${allOrigin.value}/${getAppCode()}`
})

const editorId = `rich_${instance?.uid ?? Math.random().toString(36).slice(2)}`

function getHeader() {
  let newHeaders = { ...props.headers }
  if (localStore.get('isShare')) {
    newHeaders = {
      ...newHeaders,
      appName: localStore.get('appName'),
    }
  }
  return newHeaders
}

function uploadImage(params) {
  const headers = getHeader()
  return axios.post(props.action, params, { headers })
}

function getFileUrl(resp) {
  const data = resp.data?.data || resp.data
  if (props.fileUrl) return props.fileUrl(data[0].fileId)
  return `${urlPre.value}/api/lowcode/models/attachments/${data[0].fileId}/actions/download`
}

const editorInit = {
  license_key: 'gpl',
  // 预览接入：皮肤与内容样式已由构建内联，禁止 TinyMCE 运行时加载外部 skin/content css
  skin: false,
  content_css: false,
  content_style: 'body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 14px; line-height: 1.7; color: #263247; }',
  selector: `#${editorId}`,
  paste_data_images: true,
  importcss_append: true,
  toolbar_sticky: true,
  language: 'zh_CN',
  width: '100%',
  plugins: `${props.autoresize ? 'autoresize' : ''} ${props.plugins}`,
  toolbar: props.toolbar,
  min_height: props.minHeight,
  max_height: props.maxHeight,
  height: props.height,
  font_formats: props.fontFormats,
  statusbar: true,
  menubar: false,
  branding: false,
  convert_urls: false,
  relative_urls: false,
  remove_script_host: false,
  images_upload_handler: (blobInfo, success, failure) => {
    const params = new FormData()
    params.append('attachments', blobInfo.blob())
    uploadImage(params).then((resp) => {
      success(getFileUrl(resp))
    }).catch((e) => {
      failure(`上传失败!${e}`)
    })
  },
  setup: (editor) => {
    editor.on('init', () => {
      const firstFontFormat = props.fontFormats && props.fontFormats.split(';')[0] || ''
      const fistFont = firstFontFormat && firstFontFormat.split('=')[1] || 'PingFang Sc'
      editor.getBody().style.fontFamily = fistFont
    })

    editor.ui.registry.addButton('customImage', {
      tooltip: '插入图片',
      icon: 'image',
      onAction: () => {
        bus.emit('clickCustomImage')
        bus.off('richTextInsertImage')
        bus.on('richTextInsertImage', (data) => {
          editor.insertContent(data)
        })
      },
    })

    editor.ui.registry.addButton('customAttachment', {
      tooltip: '插入附件',
      icon: 'upload',
      onAction: () => {
        bus.emit('clickCustomAttachment')
        bus.off('richTextInsertAttachment')
        bus.on('richTextInsertAttachment', (data) => {
          editor.insertContent(data)
        })
      },
    })

    editor.on('SetContent', () => {
      const imgs = editor.getBody().querySelectorAll('img')
      imgs.forEach((img) => {
        if (!img.hasAttribute('width')) {
          const image = new Image()
          image.onload = () => {
            img.setAttribute('width', image.width)
            img.setAttribute('height', image.height)
          }
          image.src = img.src
        }
      })
    })
  },
}

function handleUpdate(val) {
  emit('update:modelValue', val)
}

function handleClick(e) {
  emit('onClick', e, tinymce)
}

function getSimpleText(html) {
  if (html) {
    return html.replace(/<.+?>/g, '')
  }
  return ''
}

defineExpose({ getSimpleText })

onBeforeUnmount(() => {
  bus.off('richTextInsertImage')
  bus.off('richTextInsertAttachment')
})
</script>
