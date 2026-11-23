import { reactive } from 'vue'

/**
 * 应用级偏好单例（每个子应用只有一个；页面统一导入，不各建一套默认值）。
 *
 * 字段与取值见 afcenter-page-generation 的偏好契约：
 * `common.density`、`blocks.*`、`templates.list/form`、`tableConfig`、`text/textarea`。
 * 宿主注入有效偏好时，在应用入口合并覆盖这里的默认值；页面只做局部覆盖。
 */
export const GlobalPreference = reactive({
  common: {
    density: 'comfortable',
  },
  blocks: {
    actionBar: { align: 'start' },
    treePanel: { actionStyle: 'footer', selectionStyle: 'platform' },
    queryPanel: { mode: 'inline', layout: 'grid', defaultExpanded: true },
    rowActions: { mode: 'text' },
  },
  templates: {
    list: {
      actionsAlign: null,
      paginationAlign: 'end',
      paginationLayout: 'bar',
    },
    form: {
      actionsAlign: null,
      columns: 1,
      stickyFooter: true,
      labelPosition: 'top',
      viewDisplay: 'component',
    },
  },
  tableConfig: {
    stripe: false,
    border: false,
    pageSizes: [10, 20, 30, 50, 100],
  },
  text: { showWordLimit: false },
  textarea: { showWordLimit: false },
})

export default GlobalPreference
