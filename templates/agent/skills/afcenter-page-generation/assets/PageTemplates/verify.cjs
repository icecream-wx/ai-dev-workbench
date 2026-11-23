const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { pathToFileURL } = require('node:url')
const { parse, compileScript, compileTemplate, compileStyle } = require('@vue/compiler-sfc')
const { reactive, computed, createSSRApp, h } = require('vue')
const { renderToString } = require('@vue/server-renderer')
const { ElRow, ElCol, ElTooltip, ID_INJECTION_KEY } = require('element-plus')

async function verify() {
  const root = __dirname
  const { resolvePagePreferences } = await import(`data:text/javascript;base64,${Buffer.from(
    fs.readFileSync(path.join(root, 'utils.js'), 'utf8')
  ).toString('base64')}`)
  assert.equal(resolvePagePreferences({}).treePanel.actionStyle, 'footer')
  assert.equal(resolvePagePreferences({ blocks: { treePanel: { actionStyle: 'header' } } }).treePanel.actionStyle, 'header')
  assert.equal(resolvePagePreferences({ blocks: { treePanel: { actionStyle: 'footer' } } }).treePanel.actionStyle, 'footer')
  assert.equal(resolvePagePreferences({ blocks: { treePanel: { actionStyle: 'invalid' } } }).treePanel.actionStyle, 'footer')
  assert.equal(resolvePagePreferences({}).treePanel.selectionStyle, 'platform')
  assert.equal(resolvePagePreferences({ blocks: { treePanel: { selectionStyle: 'dot' } } }).treePanel.selectionStyle, 'dot')
  assert.equal(resolvePagePreferences({ blocks: { treePanel: { selectionStyle: 'invalid' } } }).treePanel.selectionStyle, 'platform')
  const preference = reactive({
    blocks: { actionBar: { align: 'end' } },
    templates: { list: { actionsAlign: null }, form: { stickyFooter: false } },
    tableConfig: { stripe: false, pageSizes: '[10,20,20]', virtualScroll: true }
  })
  const binding = computed(() => resolvePagePreferences(preference))
  assert.equal(binding.value.list.actionsAlign, 'end')
  assert.equal(binding.value.table.stripe, false)
  assert.equal(binding.value.formPage.stickyFooter, false)
  assert.deepEqual(binding.value.pagination.pageSizes, [10, 20])
  assert.equal('virtualScroll' in binding.value.table, false)
  preference.templates.list.actionsAlign = 'start'
  assert.equal(binding.value.list.actionsAlign, 'start')
  const original = JSON.stringify(preference)
  resolvePagePreferences(preference)
  assert.equal(JSON.stringify(preference), original)
  for (const pageSizes of ['bad', 'null', '[]', '[0]', '["20"]', {}]) {
    assert.deepEqual(resolvePagePreferences({ tableConfig: { pageSizes } }).pagination.pageSizes,
      [10, 20, 30, 50, 100])
  }
  assert.equal(resolvePagePreferences({ formConf: { labelPosition: 'right' } }).form.labelPosition, 'right')
  // 查看态展示偏好：默认禁用组件；text=只显示字段内容。输出放独立 view 分组，不污染 el-form 绑定。
  assert.equal(resolvePagePreferences({}).view.display, 'component')
  assert.equal(resolvePagePreferences({ templates: { form: { viewDisplay: 'text' } } }).view.display, 'text')
  assert.equal(resolvePagePreferences({ templates: { form: { viewDisplay: 'bad' } } }).view.display, 'component')
  assert.equal('display' in resolvePagePreferences({ templates: { form: { viewDisplay: 'text' } } }).form, false)
  assert.equal(resolvePagePreferences({ common: { density: 'compact' } }).table.size, 'small')
  assert.equal(resolvePagePreferences({}).list.paginationLayout, 'bar')
  assert.equal(resolvePagePreferences({ templates: { list: { paginationLayout: 'split' } } }).list.paginationLayout, 'split')
  assert.equal(resolvePagePreferences({ templates: { list: { paginationLayout: 'bad' } } }).list.paginationLayout, 'bar')
  assert.equal(resolvePagePreferences({}).text.showWordLimit, false)
  assert.equal(resolvePagePreferences({}).textarea.showWordLimit, false)
  assert.equal(resolvePagePreferences({ text: { showWordLimit: true } }).text.showWordLimit, true)
  assert.equal(resolvePagePreferences({ text: { showWordLimit: true } }).textarea.showWordLimit, false)
  assert.equal(resolvePagePreferences({ textarea: { showWordLimit: true } }).textarea.showWordLimit, true)

  assert.equal(resolvePagePreferences({}).rowActions.mode, 'text')
  for (const mode of ['text', 'icon', 'more']) {
    assert.equal(resolvePagePreferences({ blocks: { rowActions: { mode } } }).rowActions.mode, mode)
  }
  assert.equal(resolvePagePreferences({ blocks: { rowActions: { mode: 'bad' } } }).rowActions.mode, 'text')
  const filenames = ['ListPage.vue', 'FormPage.vue', 'FormSection.vue', 'RowActions.vue',
    'examples/ListExample.vue', 'examples/FormExample.vue', 'examples/Playground.vue']
  for (const filename of filenames) {
    const source = fs.readFileSync(path.join(root, filename), 'utf8')
    const { descriptor, errors } = parse(source, { filename })
    assert.deepEqual(errors, [])
    const script = compileScript(descriptor, { id: filename })
    const template = compileTemplate({ source: descriptor.template.content, filename, id: filename,
      compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(template.errors, [], filename)
    if (filename === 'ListPage.vue' || filename === 'FormPage.vue') {
      // SSR checks rendered slot structure and explicit page overrides without a browser dependency.
      const vueUrl = pathToFileURL(require.resolve('vue/dist/vue.runtime.esm-bundler.js')).href
      const code = script.content.replace("import './style.css'", '').replace('export default', 'const component =') + '\n' +
        template.code.replace(/from ["']vue["']/g, `from ${JSON.stringify(vueUrl)}`).replace('export function render', 'function render') +
        '\ncomponent.render = render\nexport default component'
      const { default: component } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
      const html = await renderToString(createSSRApp({
        components: { ElRow, ElCol },
        render: () => h(component, { ...binding.value.list, actionsAlign: 'end', title: '示例' }, {
          default: () => h('div', '内容'), actions: () => h('button', '保存')
        })
      }).component('ElRow', ElRow).component('ElCol', ElCol).component('ElTooltip', ElTooltip)
        .component('PmToolbar', { render() { return h('div', this.$slots.default?.()) } })
        .component('PmToolbarItem', { render() { return h('button', this.$attrs, this.$slots.default?.()) } }))
      assert.ok(html.includes('data-align="end"'))
      assert.ok(html.includes('保存'))
      assert.ok(html.includes('内容'))
      if (filename === 'ListPage.vue') {
        const defaultHtml = await renderToString(createSSRApp({
          render: () => h(component, { entityName: '供应商', selectionCount: 0 })
        }).component('ElRow', ElRow).component('ElCol', ElCol).component('ElTooltip', ElTooltip)
          .component('PmToolbar', { render() { return h('div', this.$slots.default?.()) } })
          .component('PmToolbarItem', { render() { return h('button', this.$attrs, this.$slots.default?.()) } }))
        assert.ok(defaultHtml.includes('新增供应商'))
        assert.ok(defaultHtml.includes('批量删除'))
        assert.ok(defaultHtml.includes('disabled'))
        // 批量态仅在分页拆分（split）布局触发：隐藏新增，显示已选数量与取消选择，批量删除激活为主按钮。
        const batchHtml = await renderToString(createSSRApp({
          render: () => h(component, { entityName: '供应商', selectionCount: 3, paginationLayout: 'split' })
        }).component('ElRow', ElRow).component('ElCol', ElCol).component('ElTooltip', ElTooltip)
          .component('PmToolbar', { render() { return h('div', this.$slots.default?.()) } })
          .component('PmToolbarItem', { render() { return h('button', this.$attrs, this.$slots.default?.()) } }))
        assert.ok(batchHtml.includes('已选中 3 条'))
        assert.ok(batchHtml.includes('取消选择'))
        assert.ok(batchHtml.includes('批量删除'))
        assert.ok(batchHtml.includes('type="primary"'))
        assert.ok(!batchHtml.includes('新增供应商'))
        // 三段式分页与 split 同样启用顶部批量态：页面声明 pagination-layout="three-part" 后勾选即切换。
        const threePartBatchHtml = await renderToString(createSSRApp({
          render: () => h(component, { entityName: '供应商', selectionCount: 2, paginationLayout: 'three-part' })
        }).component('ElRow', ElRow).component('ElCol', ElCol).component('ElTooltip', ElTooltip)
          .component('PmToolbar', { render() { return h('div', this.$slots.default?.()) } })
          .component('PmToolbarItem', { render() { return h('button', this.$attrs, this.$slots.default?.()) } }))
        assert.ok(threePartBatchHtml.includes('已选中 2 条'))
        assert.ok(threePartBatchHtml.includes('取消选择'))
        assert.ok(threePartBatchHtml.includes('type="primary"'))
        assert.ok(!threePartBatchHtml.includes('新增供应商'))
        // bar 布局（默认）保持原模式：勾选后工具栏不切换，已选数量留在底部分页区。
        const barSelectedHtml = await renderToString(createSSRApp({
          render: () => h(component, { entityName: '供应商', selectionCount: 3 })
        }).component('ElRow', ElRow).component('ElCol', ElCol).component('ElTooltip', ElTooltip)
          .component('PmToolbar', { render() { return h('div', this.$slots.default?.()) } })
          .component('PmToolbarItem', { render() { return h('button', this.$attrs, this.$slots.default?.()) } }))
        assert.ok(barSelectedHtml.includes('新增供应商'))
        assert.ok(barSelectedHtml.includes('批量删除'))
        assert.ok(!barSelectedHtml.includes('已选中 3 条'))
        assert.ok(!barSelectedHtml.includes('取消选择'))
        assert.ok(!barSelectedHtml.includes('disabled'))
        // 居右 + split 批量态：左侧标题区域被"已选中 X 条 + 取消选择"替换，右侧不占用主按钮位置。
        const endBatchHtml = await renderToString(createSSRApp({
          render: () => h(component, { title: '供应商列表', entityName: '供应商', actionsAlign: 'end',
            selectionCount: 2, paginationLayout: 'split' })
        }).provide(ID_INJECTION_KEY, { prefix: 1, current: 0 })
          .component('ElRow', ElRow).component('ElCol', ElCol).component('ElTooltip', ElTooltip)
          .component('PmToolbar', { render() { return h('div', this.$slots.default?.()) } })
          .component('PmToolbarItem', { render() { return h('button', this.$attrs, this.$slots.default?.()) } }))
        assert.ok(endBatchHtml.includes('已选中 2 条'))
        assert.ok(endBatchHtml.includes('取消选择'))
        assert.ok(endBatchHtml.includes('aria-label="批量删除"'))
        assert.ok(!endBatchHtml.includes('供应商列表'))
        assert.ok(!endBatchHtml.includes('新增供应商'))
        const rightHtml = await renderToString(createSSRApp({
          render: () => h(component, { title: '供应商列表', entityName: '供应商', actionsAlign: 'end' }, {
            filters: () => h('input', { placeholder: '搜索名称' })
          })
        }).provide(ID_INJECTION_KEY, { prefix: 1, current: 0 })
          .component('ElRow', ElRow).component('ElCol', ElCol).component('ElTooltip', ElTooltip)
          .component('PmToolbar', { render() { return h('div', this.$slots.default?.()) } })
          .component('PmToolbarItem', { render() { return h('button', this.$attrs, this.$slots.default?.()) } }))
        assert.ok(rightHtml.includes('pt-list-inline-header'))
        assert.ok(rightHtml.indexOf('供应商列表') < rightHtml.indexOf('搜索名称'))
        assert.ok(rightHtml.indexOf('搜索名称') < rightHtml.indexOf('aria-label="批量删除"'))
        assert.ok(rightHtml.indexOf('aria-label="批量删除"') < rightHtml.indexOf('新增供应商'))
        assert.ok(rightHtml.includes('type="primary"'))
        assert.ok(source.includes('class="al-footer pt-list-footer"'))
        assert.ok(source.includes('class="top-block pt-10"'))
        assert.equal('filtersDefaultExpanded' in binding.value.list, false)
      }
    }
  }
  const cssSource = fs.readFileSync(path.join(root, 'style.css'), 'utf8')
  // 弹窗内模板必须去除 --pt-padding 边距，单行/多行文本的输入统计分开绑定。
  assert.ok(cssSource.includes('.el-dialog .pt-page { padding: 0; }'))
  // 紧凑模式必须覆盖平台 --table-row-height，使模板容器内表格行高 32px。
  assert.ok(cssSource.includes("--table-row-height: 32px"))
  const formExampleSource = fs.readFileSync(path.join(root, 'examples/FormExample.vue'), 'utf8')
  assert.ok(formExampleSource.includes('v-bind="bindings.textarea"'))
  assert.ok(!formExampleSource.includes('bindings.text" v-model="form.description"'))
  const listExampleSource = fs.readFileSync(path.join(root, 'examples/ListExample.vue'), 'utf8')
  assert.ok(!listExampleSource.includes('body-class="p-0"'))
  // 操作栏批量态与分页拆分布局的关键契约。
  const listPageSource = fs.readFileSync(path.join(root, 'ListPage.vue'), 'utf8')
  assert.ok(listPageSource.includes("'clear-selection'"))
  assert.ok(listPageSource.includes('pt-list-selection-count'))
  assert.ok(listPageSource.includes(':data-layout="paginationLayout"'))
  assert.ok(listPageSource.includes(':selection-count="selectionCount"'))
  assert.ok(listPageSource.includes(':batch-active="batchActive"'))
  assert.ok(listPageSource.includes("['split', 'three-part'].includes(this.paginationLayout) && this.selectionCount > 0"))
  assert.ok(listPageSource.includes('pt-list-batch-title'))
  assert.ok(listPageSource.includes('pt-list-clear-selection'))
  assert.ok(listExampleSource.includes('@clear-selection'))
  assert.ok(listExampleSource.includes(':selections="footerSelections"'))
  assert.ok(listExampleSource.includes("paginationLayout === 'bar' ? selections.value : []"))
  assert.ok(cssSource.includes(".pt-list-footer[data-layout='split'] .el-pagination { width: 100%; }"))
  assert.ok(cssSource.includes('.pt-list-icon-action.is-active'))
  // 列表模版 pt-header/pt-region 内边距契约：上下跟随 --pt-gap（列表内默认 10px），左右固定 10px。
  assert.ok(cssSource.includes('.pt-page.pt-list { padding: 0; gap: 0; --pt-gap: 10px; }'))
  assert.ok(cssSource.includes('.pt-field-grid > .pt-field-full { grid-column: 1 / -1; }'))
  assert.ok(cssSource.includes('.pt-list > .pt-header, .pt-list > .pt-region { padding: var(--pt-gap) 10px; }'))
  // 平台 pm-textarea 根为无宽度 span，表单栅格内必须撑满单元格（headless 实测：无规则 181px / 有规则撑满行宽）。
  assert.ok(cssSource.includes('.pt-field-grid .el-form-item__content > span { width: 100%; min-width: 0; }'))
  assert.deepEqual(compileStyle({ source: cssSource,
    filename: 'style.css', id: 'templates' }).errors, [])
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'docs/catalog.json'), 'utf8'))
  const repo = path.resolve(root, '../../..')
  for (const template of catalog.templates) {
    assert.ok(fs.existsSync(path.join(repo, template.source)))
    assert.ok(fs.existsSync(path.join(repo, template.recipe)))
  }
  console.log('PASS: preference contracts, reactive overrides, 6 SFCs, SSR slots, dialog padding rule, word-limit split, compact row height, split-only batch bar (left & right modes), pagination split, CSS and catalog paths')
}
verify().catch(error => { console.error(error); process.exitCode = 1 })
// Modified by AI on 2026-11-10 17:59:45
