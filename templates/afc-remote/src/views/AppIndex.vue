<template>
  <main class="afc-app-index">
    <header>
      <p class="eyebrow">AFCenter 子应用</p>
      <h1>页面尚未实现</h1>
    </header>
    <section>
      <p>
        这是 Module Federation remote 的最小入口（<code>setting.json</code> 的
        <code>app.name</code> 指向本应用）。业务页面由开发阶段从设计蓝图复制并适配，
        不要在这里堆业务代码。
      </p>
      <ol>
        <li>
          读 <code>docs/design/design-system.json</code> 与
          <code>docs/design/template/</code> 下的页面蓝图。
        </li>
        <li>
          按 <code>docs/design/&lt;MOD&gt;/ui-check.md</code> 的对照表，把蓝图页面复制到
          <code>src/views/</code>，替换 mock/接口。
        </li>
        <li>
          页面统一使用 <code>src/components/PageTemplates/</code>、宿主提供的
          <code>pm-*</code> 组件和 <code>src/preferences/GlobalPreference.js</code>。
        </li>
      </ol>
      <p class="hint">
        本应用同时暴露 <code>./index</code>（<code>src/views/AppIndex.vue</code>）；
        新增页面后在 <code>build/mfp.config.js</code> 的 <code>exposes</code> 追加或在
        <code>src/router/index.js</code> 挂载。
      </p>
    </section>
  </main>
</template>

<script setup>
// 占位入口：不依赖 pm-* 组件，保证 remote 在宿主与独立 dev 下都能渲染。
</script>

<style scoped>
.afc-app-index {
  box-sizing: border-box;
  max-width: 760px;
  margin: 0 auto;
  padding: 48px 24px;
  color: #1f2937;
  font-family: 'Inter', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #2563eb;
}
h1 {
  margin: 0 0 20px;
  font-size: 26px;
  line-height: 1.3;
}
section {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px 24px;
  background: #ffffff;
  line-height: 1.8;
  font-size: 14px;
}
ol {
  padding-left: 20px;
}
code {
  border-radius: 4px;
  padding: 1px 5px;
  background: #f3f4f6;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12.5px;
}
.hint {
  margin: 12px 0 0;
  padding-top: 12px;
  border-top: 1px dashed #e5e7eb;
  color: #6b7280;
  font-size: 12.5px;
}
</style>
