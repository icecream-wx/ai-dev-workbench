<template>
  <div class="preview-component-placeholder" :style="{ minHeight: height }">
    <strong>预览占位（组件未接入）</strong>
    <span>{{ component }}</span>
    <small>{{ reason }}</small>
  </div>
</template>

<script setup>
/**
 * 重组件占位。
 *
 * 预览只内置「不需要额外静态资源/宿主」的 pm-v3 子集；无法在 preview.html 内
 * 真实渲染的区域（例如依赖 Luckysheet iframe 静态资源的 pm-sheet）用本组件占位，
 * 明确标注“组件未接入”，不伪造渲染结果。
 */
defineProps({
  component: { type: String, default: 'pm-*' },
  reason: { type: String, default: '该组件未在预览包内接入' },
  height: { type: String, default: '120px' }
})
</script>

<style scoped>
.preview-component-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 18px;
  color: #64748b;
  border: 1px dashed #b9c7d9;
  border-radius: 8px;
  background: repeating-linear-gradient(135deg, #f7f9fc 0 10px, #f2f6fb 10px 20px);
  text-align: center;
}

.preview-component-placeholder strong {
  color: #40536d;
  font-size: 13px;
}

.preview-component-placeholder span {
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  color: #1f5eff;
}

.preview-component-placeholder small {
  max-width: 420px;
  font-size: 11px;
  line-height: 1.6;
}
</style>
