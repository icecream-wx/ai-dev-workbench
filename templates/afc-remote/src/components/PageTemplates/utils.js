// Only documented fields cross the preference boundary; business props stay in the page.
const enumValue = (value, values, fallback) => values.includes(value) ? value : fallback
const booleanValue = (value, fallback) => typeof value === 'boolean' ? value : fallback

export function resolvePagePreferences(preference = {}) {
  const common = preference.common || {}
  const blocks = preference.blocks || {}
  const templates = preference.templates || {}
  const list = templates.list || {}
  const form = templates.form || {}
  const table = preference.tableConfig || {}
  const legacyForm = preference.formConf || {}
  const align = enumValue(blocks.actionBar?.align, ['start', 'end'], 'start')
  const density = enumValue(common.density, ['comfortable', 'compact'], 'comfortable')
  let pageSizes = table.pageSizes
  if (typeof pageSizes === 'string') {
    try { pageSizes = JSON.parse(pageSizes) } catch { pageSizes = null }
  }
  if (!Array.isArray(pageSizes) || !pageSizes.length ||
      !pageSizes.every(value => Number.isInteger(value) && value > 0)) {
    pageSizes = [10, 20, 30, 50, 100]
  }
  return {
    treePanel: {
      actionStyle: enumValue(blocks.treePanel?.actionStyle, ['header', 'footer'], 'footer'),
      selectionStyle: enumValue(blocks.treePanel?.selectionStyle, ['platform', 'dot'], 'platform')
    },
    queryPanel: {
      mode: enumValue(blocks.queryPanel?.mode, ['inline', 'card'], 'inline'),
      layout: enumValue(blocks.queryPanel?.layout, ['grid', 'header'], 'grid'),
      defaultExpanded: booleanValue(blocks.queryPanel?.defaultExpanded, true)
    },
    rowActions: { mode: enumValue(blocks.rowActions?.mode, ['text', 'icon', 'more'], 'text') },
    list: {
      density,
      actionsAlign: enumValue(list.actionsAlign, ['start', 'end'], align),
      paginationAlign: enumValue(list.paginationAlign, ['start', 'end'], 'end'),
      paginationLayout: enumValue(list.paginationLayout, ['bar', 'split', 'three-part'], 'bar')
    },
    formPage: {
      density,
      actionsAlign: enumValue(form.actionsAlign, ['start', 'end'], align),
      columns: enumValue(form.columns, [1, 2], 1),
      stickyFooter: booleanValue(form.stickyFooter, true)
    },
    form: {
      labelPosition: enumValue(form.labelPosition ?? legacyForm.labelPosition,
        ['left', 'right', 'top'], 'top'),
      labelWidth: '120px',
      size: density === 'compact' ? 'small' : 'default'
    },
    // 查看态展示方式：component=禁用组件（默认）；text=只显示字段内容，不渲染输入组件。
    // 独立分组，避免 v-bind="bindings.form" 时把非 el-form 属性透传到表单元素上。
    view: {
      display: enumValue(form.viewDisplay, ['component', 'text'], 'component')
    },
    table: {
      stripe: booleanValue(table.stripe, false),
      border: booleanValue(table.border, false),
      size: density === 'compact' ? 'small' : 'default'
    },
    // 输入统计跟随偏好：单行文本读 text.showWordLimit，多行文本读 textarea.showWordLimit；
    // 偏好默认值均为不显示，偏好开启后对应输入框即显示字数统计。
    text: { showWordLimit: booleanValue(preference.text?.showWordLimit, false) },
    textarea: { showWordLimit: booleanValue(preference.textarea?.showWordLimit, false) },
    pagination: { pageSizes: [...new Set(pageSizes)] }
  }
}
// Modified by AI on 2026-11-12 13:20:38
