import { defineAsyncComponent, h } from 'vue'
import type { App, Component } from 'vue'
import PreviewPlaceholder from '../../preview/PreviewPlaceholder.vue'
import PmInput from './components/pm-input/pc.vue'
import PmNullValue from './components/pm-null-value/pc.vue'
import PmSwitch from './components/pm-switch/pc.vue'
import PmSelect from './components/pm-select/pc.vue'
import PmSelectDict from './components/pm-select-dict/pc.vue'
import PmSelectEntity from './components/pm-select-entity/pc.vue'
import PmSelectUser from './components/pm-select-user/pc.vue'
import PmSelectOrg from './components/pm-select-org/pc.vue'
import PmSelectPosition from './components/pm-select-position/pc.vue'
import PmLookup from './components/pm-lookup/pc.vue'
import PmTree from './components/pm-tree/pc.vue'
import PmTable from './components/pm-table/pc.vue'
import PmPagination from './components/pm-pagination/pc.vue'
import PmFormDialog from './components/pm-form-dialog/pc.vue'
import PmDialog from './components/pm-dialog/pc.vue'
import PmCard from './components/pm-card/pc.vue'
import PmCheckbox from './components/pm-checkbox/pc.vue'
import PmDivider from './components/pm-divider/pc.vue'
import PmFold from './components/pm-fold/pc.vue'
import PmFoldGroup from './components/pm-fold-group/pc.vue'
import PmHtml from './components/pm-html/pc.vue'
import PmImage from './components/pm-image/pc.vue'
import PmNumber from './components/pm-number/pc.vue'
import PmNumberRange from './components/pm-number-range/pc.vue'
import PmRadio from './components/pm-radio/pc.vue'
import PmSteps from './components/pm-steps/pc.vue'
import PmTextarea from './components/pm-textarea/pc.vue'
import PmTimeSelect from './components/pm-time-select/pc.vue'
import PmToolbar from './components/pm-toolbar/pc.vue'
import PmToolbarItem from './components/pm-toolbar-item/pc.vue'
import PmDatepicker from './components/pm-datepicker/pc.vue'
import PmDatepickRange from './components/pm-datepick-range/pc.vue'

/**
 * 预览用 pm-v3 组件子集注册。
 *
 * 来源于 primeton-form-components-v3（只复制页面实际用到的组件），
 * 重依赖组件用 defineAsyncComponent 懒加载，避免预览首页把 echarts/tinymce 等一次性拉进来。
 */
const lazy = (loader: () => Promise<unknown>): Component => defineAsyncComponent(loader as never)

/** pm-sheet 依赖 Luckysheet iframe 静态资源，预览包内未接入 → 明确占位（不伪造渲染） */
const PmSheetPreview = {
  name: 'PmSheetPreview',
  setup() {
    return () =>
      h(PreviewPlaceholder, {
        component: 'pm-sheet（Luckysheet）',
        reason: '预览未内置 Luckysheet 的 iframe 静态资源与表格运行时，数据样例区域以占位显示。',
        height: '220px'
      })
  }
}

const components: Record<string, Component> = {
  'pm-input': PmInput,
  'pm-null-value': PmNullValue,
  'pm-switch': PmSwitch,
  'pm-select': PmSelect,
  'pm-select-dict': PmSelectDict,
  'pm-select-entity': PmSelectEntity,
  'pm-select-user': PmSelectUser,
  'pm-select-org': PmSelectOrg,
  'pm-select-position': PmSelectPosition,
  'pm-lookup': PmLookup,
  'pm-tree': PmTree,
  'pm-table': PmTable,
  'pm-pagination': PmPagination,
  'pm-form-dialog': PmFormDialog,
  'pm-dialog': PmDialog,
  'pm-card': PmCard,
  'pm-checkbox': PmCheckbox,
  'pm-divider': PmDivider,
  'pm-fold': PmFold,
  'pm-fold-group': PmFoldGroup,
  'pm-html': PmHtml,
  'pm-image': PmImage,
  'pm-number': PmNumber,
  'pm-number-range': PmNumberRange,
  'pm-radio': PmRadio,
  'pm-steps': PmSteps,
  'pm-textarea': PmTextarea,
  'pm-time-select': PmTimeSelect,
  'pm-toolbar': PmToolbar,
  'pm-toolbar-item': PmToolbarItem,
  'pm-datepicker': PmDatepicker,
  'pm-datepick-range': PmDatepickRange,
  // 重组件（懒加载）
  'pm-auto-number': lazy(() => import('./components/pm-auto-number/pc.vue')),
  'pm-calendar': lazy(() => import('./components/pm-calendar/pc.vue')),
  'pm-echarts': lazy(() => import('./components/pm-echarts/pc.vue')),
  'pm-markdown': lazy(() => import('./components/pm-markdown/pc.vue')),
  'pm-ocr': lazy(() => import('./components/pm-ocr/pc.vue')),
  'pm-richtext': lazy(() => import('./components/pm-richtext/pc.vue')),
  'pm-search': lazy(() => import('./components/pm-search/pc.vue')),
  'pm-select-tree': lazy(() => import('./components/pm-select-tree/pc.vue')),
  'pm-split': lazy(() => import('./components/pm-split/pc.vue')),
  'pm-upload': lazy(() => import('./components/pm-upload/pc.vue')),
  // 占位
  'pm-sheet': PmSheetPreview,
  // 页面里使用 PascalCase 标签
  PmOCR: lazy(() => import('./components/pm-ocr/pc.vue'))
}

export function registerPmV3(app: App): void {
  for (const [name, component] of Object.entries(components)) {
    app.component(name, component)
  }
}
