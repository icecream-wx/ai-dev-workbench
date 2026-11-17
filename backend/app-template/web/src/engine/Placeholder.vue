<template>
  <div class="placeholder">
    <div class="ph-icon">⚙</div>
    <div class="ph-title">该页面类型暂由占位渲染</div>
    <div class="ph-desc">看板 / 甘特 / 日历视图将在引擎后续版本提供，或由智能体以 custom 插件实现。</div>
  </div>
</template>

<style scoped>
.placeholder {
  max-width: 720px; margin: 60px auto; background: #fff; border: 1px dashed #c9cedd;
  border-radius: 10px; padding: 48px 24px; text-align: center;
}
.ph-icon { font-size: 30px; }
.ph-title { font-size: 15px; font-weight: 600; color: #262a33; margin-top: 12px; }
.ph-desc { font-size: 12.5px; color: #8b91a5; margin-top: 8px; line-height: 1.7; }
</style>
