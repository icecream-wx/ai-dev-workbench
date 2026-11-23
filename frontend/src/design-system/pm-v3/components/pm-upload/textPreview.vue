<template>
  <div style="padding: 10px">
    <el-input type="textarea" autosize :disabled="true" placeholder="请输入内容" v-model="textarea" />
  </div>
</template>

<script>
export default {
  name: 'textPreview',
  props: { src: { default: '' } },
  data() {
    return { textarea: '' }
  },
  mounted() {
    const xhr = new XMLHttpRequest()
    xhr.open('get', this.src, true)
    xhr.responseType = 'blob'
    const self = this
    xhr.onload = function() {
      if (this.status === 200) {
        const reader = new FileReader()
        reader.onload = function() {
          self.textarea = reader.result
        }
        reader.readAsText(this.response)
      }
    }
    xhr.send()
  },
}
</script>
