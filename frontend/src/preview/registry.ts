/* eslint-disable */
/**
 * 由 scripts/generate-preview-templates.mjs 生成，请勿手工编辑。
 * 来源：templates/design-system/afcenter-app-templates-v1（内置 pack，单一事实源）
 */
import './templates/afcenter-app-templates-v1/styles/platform-blue/style.css'
import './templates/afcenter-app-templates-v1/styles/classic-warm/style.css'
import './templates/afcenter-app-templates-v1/styles/data-cyan/style.css'
import './templates/afcenter-app-templates-v1/styles/high-contrast-tool/style.css'
import './templates/afcenter-app-templates-v1/styles/shared.css'

export interface PreviewPageMeta {
  id: string
  name: string
  type: string
  recipe: string
  preview: string
  description: string
  components: string[]
}

export interface PreviewApplicationTypeMeta {
  id: string
  name: string
  category: string
  description: string
  defaultStyle: string
  pages: PreviewPageMeta[]
}

export interface PreviewStyleMeta {
  id: string
  name: string
  className: string
  description: string
  signature: string
  tokens: Record<string, unknown>
}

export const previewPackId = 'afcenter-app-templates-v1'
export const defaultApplicationType = 'enterprise-application-platform'
export const defaultStyle = 'platform-blue'

export const applicationTypes: PreviewApplicationTypeMeta[] = [
  {
    "id": "enterprise-application-platform",
    "name": "企业级应用管理平台",
    "category": "platform",
    "description": "面向应用、组织、用户、权限、审计和平台运行概览的企业管理页面集合。",
    "defaultStyle": "platform-blue",
    "pages": [
      {
        "id": "overview",
        "name": "管理驾驶舱",
        "type": "dashboard",
        "recipe": "dashboard",
        "preview": "dashboard",
        "description": "组织、用户、应用和资源的统一运行概览。",
        "components": [
          "pm-echarts",
          "pm-select",
          "pm-table"
        ]
      },
      {
        "id": "applications",
        "name": "应用中心",
        "type": "list",
        "recipe": "list",
        "preview": "cards",
        "description": "统一管理平台应用、运行状态和负责人。",
        "components": [
          "pm-form-dialog",
          "pm-input",
          "pm-pagination",
          "pm-radio",
          "pm-select",
          "pm-table",
          "pm-textarea"
        ]
      },
      {
        "id": "application-form",
        "name": "注册应用",
        "type": "form",
        "recipe": "wizard",
        "preview": "form",
        "description": "创建应用身份并配置环境与授权范围。",
        "components": [
          "pm-input",
          "pm-select",
          "pm-steps",
          "pm-switch",
          "pm-textarea"
        ]
      },
      {
        "id": "organization",
        "name": "组织与用户",
        "type": "tree-list",
        "recipe": "tree-list",
        "preview": "tree",
        "description": "维护组织机构、账号、岗位与角色关联。",
        "components": [
          "pm-form-dialog",
          "pm-input",
          "pm-pagination",
          "pm-select",
          "pm-switch",
          "pm-table",
          "pm-tree"
        ]
      },
      {
        "id": "audit",
        "name": "审计日志",
        "type": "list",
        "recipe": "list",
        "preview": "table",
        "description": "查询平台操作、访问和安全事件记录。",
        "components": [
          "pm-dialog",
          "pm-input",
          "pm-pagination",
          "pm-select",
          "pm-table"
        ]
      }
    ]
  },
  {
    "id": "operations-management",
    "name": "运营管理后台",
    "category": "operations",
    "description": "覆盖组织台账、公告发布、活动配置、部门权限、经营简报、客服排班和订单异常处置。",
    "defaultStyle": "classic-warm",
    "pages": [
      {
        "id": "treeTable",
        "name": "运营组织台账",
        "type": "tree-list",
        "recipe": "tree-list",
        "preview": "treeTable",
        "description": "组织档案树与岗位人员台账联动，支持批量调整和编制核验。",
        "components": [
          "pm-form-dialog",
          "pm-input",
          "pm-number",
          "pm-pagination",
          "pm-search",
          "pm-select",
          "pm-table",
          "pm-toolbar",
          "pm-toolbar-item",
          "pm-tree"
        ]
      },
      {
        "id": "list",
        "name": "通知公告管理",
        "type": "list",
        "recipe": "list",
        "preview": "list",
        "description": "行内筛选、边框表格、批量操作与紧凑分页。",
        "components": [
          "pm-form-dialog",
          "pm-input",
          "pm-pagination",
          "pm-search",
          "pm-select",
          "pm-table",
          "pm-toolbar",
          "pm-toolbar-item"
        ]
      },
      {
        "id": "form",
        "name": "新建运营公告",
        "type": "form",
        "recipe": "page-form",
        "preview": "form",
        "description": "分组表单、富文本编辑与附件上传。",
        "components": [
          "pm-datepicker",
          "pm-input",
          "pm-richtext",
          "pm-select",
          "pm-switch",
          "pm-toolbar",
          "pm-toolbar-item",
          "pm-upload"
        ]
      },
      {
        "id": "permission",
        "name": "部门权限",
        "type": "permission",
        "recipe": "tree-list",
        "preview": "tree",
        "description": "组织索引与菜单、数据范围权限协同维护。",
        "components": [
          "pm-form-dialog",
          "pm-input",
          "pm-search",
          "pm-select",
          "pm-switch",
          "pm-table",
          "pm-toolbar",
          "pm-toolbar-item"
        ]
      },
      {
        "id": "components",
        "name": "运营活动配置",
        "type": "form",
        "recipe": "page-form",
        "preview": "form",
        "description": "输入、选择、上传、图片和组织类组件完整示例。",
        "components": [
          "pm-auto-number",
          "pm-checkbox",
          "pm-datepick-range",
          "pm-datepicker",
          "pm-divider",
          "pm-image",
          "pm-input",
          "pm-lookup",
          "pm-number",
          "pm-number-range",
          "pm-radio",
          "pm-richtext",
          "pm-select",
          "pm-select-org",
          "pm-select-position",
          "pm-select-tree",
          "pm-select-user",
          "pm-switch",
          "pm-table",
          "pm-textarea",
          "pm-time-select",
          "pm-toolbar",
          "pm-toolbar-item",
          "pm-upload"
        ]
      },
      {
        "id": "dashboard",
        "name": "运营简报",
        "type": "dashboard",
        "recipe": "dashboard",
        "preview": "chart",
        "description": "经营指标、工单趋势与今日运营待办。",
        "components": [
          "pm-datepicker",
          "pm-echarts",
          "pm-form-dialog",
          "pm-input",
          "pm-pagination",
          "pm-search",
          "pm-select",
          "pm-steps",
          "pm-table",
          "pm-textarea",
          "pm-toolbar",
          "pm-toolbar-item"
        ]
      },
      {
        "id": "schedule",
        "name": "客服排班",
        "type": "list",
        "recipe": "list",
        "preview": "list",
        "description": "班组、班次和排班确认状态集中维护。",
        "components": [
          "pm-datepicker",
          "pm-echarts",
          "pm-form-dialog",
          "pm-input",
          "pm-pagination",
          "pm-search",
          "pm-select",
          "pm-steps",
          "pm-table",
          "pm-textarea",
          "pm-toolbar",
          "pm-toolbar-item"
        ]
      },
      {
        "id": "issues",
        "name": "订单异常处理",
        "type": "workflow",
        "recipe": "detail",
        "preview": "timeline",
        "description": "确认、处置和复核三阶段异常处理流程。",
        "components": [
          "pm-datepicker",
          "pm-echarts",
          "pm-form-dialog",
          "pm-input",
          "pm-pagination",
          "pm-search",
          "pm-select",
          "pm-steps",
          "pm-table",
          "pm-textarea",
          "pm-toolbar",
          "pm-toolbar-item"
        ]
      }
    ]
  },
  {
    "id": "data-governance-workbench",
    "name": "数据分析与治理工作台",
    "category": "data",
    "description": "围绕数据资产、分析任务、调度监控、数据接入和成员协作组织页面结构。",
    "defaultStyle": "data-cyan",
    "pages": [
      {
        "id": "treeTable",
        "name": "数据域资产检索",
        "type": "tree-list",
        "recipe": "tree-list",
        "preview": "treeTable",
        "description": "数据域树与资产网格联动，支持多级表头、排序与资产检查。",
        "components": [
          "pm-dialog",
          "pm-pagination",
          "pm-search",
          "pm-select",
          "pm-table",
          "pm-tree"
        ]
      },
      {
        "id": "list",
        "name": "分析任务队列",
        "type": "workspace",
        "recipe": "list",
        "preview": "list",
        "description": "运行指标、组合搜索、任务进度与资源侧栏协同展示。",
        "components": [
          "pm-datepicker",
          "pm-dialog",
          "pm-form-dialog",
          "pm-pagination",
          "pm-radio",
          "pm-search",
          "pm-select",
          "pm-table"
        ]
      },
      {
        "id": "form",
        "name": "新建分析任务",
        "type": "form",
        "recipe": "wizard",
        "preview": "form",
        "description": "从分析目标、数据范围到运行策略与发布确认的完整流程。",
        "components": [
          "pm-datepicker",
          "pm-input",
          "pm-select",
          "pm-steps",
          "pm-switch",
          "pm-textarea"
        ]
      },
      {
        "id": "dataset",
        "name": "数据资产目录",
        "type": "list",
        "recipe": "list",
        "preview": "tree",
        "description": "集中查看资产质量、敏感级别、数据规模与更新状态。",
        "components": [
          "pm-form-dialog",
          "pm-input",
          "pm-search",
          "pm-select"
        ]
      },
      {
        "id": "monitor",
        "name": "调度监控中心",
        "type": "dashboard",
        "recipe": "dashboard",
        "preview": "chart",
        "description": "监控运行吞吐、资源池、异常实例与实时运行动态。",
        "components": [
          "pm-dialog",
          "pm-echarts",
          "pm-pagination",
          "pm-select",
          "pm-table"
        ]
      },
      {
        "id": "advanced",
        "name": "数据接入工作区",
        "type": "workspace",
        "recipe": "main-sub",
        "preview": "advanced",
        "description": "集成上传、树、字段映射、OCR、质量检查、日历和富文本。",
        "components": [
          "pm-calendar",
          "pm-echarts",
          "pm-html",
          "pm-input",
          "pm-markdown",
          "pm-richtext",
          "pm-search",
          "pm-select",
          "pm-sheet",
          "pm-steps",
          "pm-switch",
          "pm-table",
          "pm-textarea",
          "pm-tree",
          "pm-upload"
        ]
      },
      {
        "id": "detail",
        "name": "任务运行详情",
        "type": "detail",
        "recipe": "detail",
        "preview": "timeline",
        "description": "呈现任务配置、数据血缘、质量规则、资源画像与运行时间线。",
        "components": [
          "pm-form-dialog",
          "pm-input",
          "pm-search",
          "pm-select"
        ]
      },
      {
        "id": "members",
        "name": "工作区成员",
        "type": "list",
        "recipe": "list",
        "preview": "list",
        "description": "维护成员角色、数据权限、负责任务和协作状态。",
        "components": [
          "pm-form-dialog",
          "pm-input",
          "pm-search",
          "pm-select"
        ]
      }
    ]
  },
  {
    "id": "incident-response-console",
    "name": "轻量监控与处置工具台",
    "category": "tool",
    "description": "围绕异常监控、规则配置、事件详情和处置工作区组织的小型工具页面。",
    "defaultStyle": "high-contrast-tool",
    "pages": [
      {
        "id": "list",
        "name": "异常事件列表",
        "type": "list",
        "recipe": "list",
        "preview": "list",
        "description": "标签墙筛选、块面表格和方块分页。",
        "components": [
          "pm-form-dialog",
          "pm-input",
          "pm-pagination",
          "pm-search",
          "pm-select",
          "pm-table",
          "pm-textarea"
        ]
      },
      {
        "id": "form",
        "name": "新建异常规则",
        "type": "form",
        "recipe": "page-form",
        "preview": "form",
        "description": "规则基础信息、检测逻辑与响应动作。",
        "components": [
          "pm-input",
          "pm-select",
          "pm-switch",
          "pm-textarea"
        ]
      },
      {
        "id": "layout",
        "name": "处置工作区布局",
        "type": "workspace",
        "recipe": "main-sub",
        "preview": "form",
        "description": "标签、折叠、卡片、分栏、表格布局和操作组件。",
        "components": [
          "pm-card",
          "pm-divider",
          "pm-fold",
          "pm-fold-group",
          "pm-split",
          "pm-table",
          "pm-textarea",
          "pm-toolbar",
          "pm-toolbar-item"
        ]
      },
      {
        "id": "detail",
        "name": "异常事件详情",
        "type": "detail",
        "recipe": "detail",
        "preview": "timeline",
        "description": "大号状态卡、处置时间线与操作日志。",
        "components": [
          "pm-form-dialog",
          "pm-select",
          "pm-table",
          "pm-textarea"
        ]
      }
    ]
  }
]

export const styles: PreviewStyleMeta[] = [
  {
    "id": "platform-blue",
    "name": "平台蓝白",
    "className": "visual-style-platform-blue",
    "description": "明亮蓝白、留白适中、圆角卡片和清晰的平台层级。",
    "signature": "#1F5EFF",
    "tokens": {
      "primary": "#1f5eff",
      "accent": "#22a6b3",
      "neutral": "#64748b",
      "background": "#f4f7fb",
      "radius": 10,
      "density": "compact"
    }
  },
  {
    "id": "classic-warm",
    "name": "经典暖色",
    "className": "visual-style-classic-warm",
    "description": "暖橙棕、高信息密度、明确边界和稳重的管理后台气质。",
    "signature": "#C2542A",
    "tokens": {
      "primary": "#c2542a",
      "accent": "#8f684f",
      "neutral": "#7d766c",
      "background": "#f3efe8",
      "radius": 5,
      "density": "compact"
    }
  },
  {
    "id": "data-cyan",
    "name": "数据蓝青",
    "className": "visual-style-data-cyan",
    "description": "蓝青冷色、卡片层次、轻网格和偏数据科技的视觉表达。",
    "signature": "#145FBA",
    "tokens": {
      "primary": "#145fba",
      "accent": "#07858d",
      "neutral": "#66758a",
      "background": "#f3f7fb",
      "radius": 12,
      "density": "compact"
    }
  },
  {
    "id": "high-contrast-tool",
    "name": "高对比工具风",
    "className": "visual-style-high-contrast-tool",
    "description": "芥末黄与黑色、方正块面、清晰边框和强工具感。",
    "signature": "#F5C518",
    "tokens": {
      "primary": "#f5c518",
      "accent": "#5d5540",
      "neutral": "#6d685d",
      "background": "#f7f6f2",
      "radius": 2,
      "density": "compact"
    }
  }
]

export const pageLoaders: Record<string, Record<string, () => Promise<unknown>>> = {
  'enterprise-application-platform': {
    'overview': () => import('./templates/afcenter-app-templates-v1/application-types/enterprise-application-platform/pages/PlatformOverview.vue'),
    'applications': () => import('./templates/afcenter-app-templates-v1/application-types/enterprise-application-platform/pages/ApplicationCenter.vue'),
    'application-form': () => import('./templates/afcenter-app-templates-v1/application-types/enterprise-application-platform/pages/ApplicationForm.vue'),
    'organization': () => import('./templates/afcenter-app-templates-v1/application-types/enterprise-application-platform/pages/OrganizationUsers.vue'),
    'audit': () => import('./templates/afcenter-app-templates-v1/application-types/enterprise-application-platform/pages/AuditLogs.vue')
  },
  'operations-management': {
    'treeTable': () => import('./templates/afcenter-app-templates-v1/application-types/operations-management/pages/OperationsTreeTable.vue'),
    'list': () => import('./templates/afcenter-app-templates-v1/application-types/operations-management/pages/OperationsList.vue'),
    'form': () => import('./templates/afcenter-app-templates-v1/application-types/operations-management/pages/OperationsForm.vue'),
    'permission': () => import('./templates/afcenter-app-templates-v1/application-types/operations-management/pages/OperationsPermission.vue'),
    'components': () => import('./templates/afcenter-app-templates-v1/application-types/operations-management/pages/OperationsComponentForm.vue'),
    'dashboard': () => import('./templates/afcenter-app-templates-v1/application-types/operations-management/pages/OperationsDashboard.vue'),
    'schedule': () => import('./templates/afcenter-app-templates-v1/application-types/operations-management/pages/OperationsSchedule.vue'),
    'issues': () => import('./templates/afcenter-app-templates-v1/application-types/operations-management/pages/OperationsIssues.vue')
  },
  'data-governance-workbench': {
    'treeTable': () => import('./templates/afcenter-app-templates-v1/application-types/data-governance-workbench/pages/DataTreeTable.vue'),
    'list': () => import('./templates/afcenter-app-templates-v1/application-types/data-governance-workbench/pages/DataTaskList.vue'),
    'form': () => import('./templates/afcenter-app-templates-v1/application-types/data-governance-workbench/pages/DataTaskForm.vue'),
    'dataset': () => import('./templates/afcenter-app-templates-v1/application-types/data-governance-workbench/pages/DataAssetCatalog.vue'),
    'monitor': () => import('./templates/afcenter-app-templates-v1/application-types/data-governance-workbench/pages/DataMonitor.vue'),
    'advanced': () => import('./templates/afcenter-app-templates-v1/application-types/data-governance-workbench/pages/DataAccessWorkspace.vue'),
    'detail': () => import('./templates/afcenter-app-templates-v1/application-types/data-governance-workbench/pages/DataTaskDetail.vue'),
    'members': () => import('./templates/afcenter-app-templates-v1/application-types/data-governance-workbench/pages/DataWorkspaceMembers.vue')
  },
  'incident-response-console': {
    'list': () => import('./templates/afcenter-app-templates-v1/application-types/incident-response-console/pages/IncidentList.vue'),
    'form': () => import('./templates/afcenter-app-templates-v1/application-types/incident-response-console/pages/IncidentRuleForm.vue'),
    'layout': () => import('./templates/afcenter-app-templates-v1/application-types/incident-response-console/pages/IncidentWorkspace.vue'),
    'detail': () => import('./templates/afcenter-app-templates-v1/application-types/incident-response-console/pages/IncidentDetail.vue')
  }
}

export const structureLoaders: Record<string, () => Promise<{ default: string }>> = {
  'enterprise-application-platform': () => import('./templates/afcenter-app-templates-v1/application-types/enterprise-application-platform/structure.css?inline'),
  'operations-management': () => import('./templates/afcenter-app-templates-v1/application-types/operations-management/structure.css?inline'),
  'data-governance-workbench': () => import('./templates/afcenter-app-templates-v1/application-types/data-governance-workbench/structure.css?inline'),
  'incident-response-console': () => import('./templates/afcenter-app-templates-v1/application-types/incident-response-console/structure.css?inline')
}
