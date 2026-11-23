<template>
  <div class="el-upload__tip" v-if="showAcceptText">
    <div>
      <transition name="slide-fade">
        <el-progress
          v-if="showProgress"
          :percentage="progressPercent"
          :status="importStatus"
        />
      </transition>
    </div>
    <template v-if="accept && accept.length > 0">
      {{ i18n('只能上传') }} {{ accept }}
    </template>
    <template v-if="fileSize && sizeUnit">
      {{ i18n('文件不超过') }}{{ fileSize }}{{ sizeUnit }}
    </template>
    <template v-if="limit && multiple">
      {{ i18n('文件数量不超过') }}{{ limit }}
    </template>
  </div>
</template>

<script>
import { i18n as i18nFn } from '../../../i18n/info'
export default {
  name: 'uploadTips',
  props: {
    showAcceptText: { default: true },
    showPreview: { default: true },
    accept: {},
    fileSize: {},
    sizeUnit: {},
    multiple: { type: Boolean, default: false },
    limit: { type: Number, default: 0 },
    showProgress: { type: Boolean, default: false },
    progressPercent: { type: Number, default: 0 },
    importStatus: { type: String, default: '' },
  },
  methods: {
    i18n(key) {
      return i18nFn(key)
    }
  },
}
</script>
