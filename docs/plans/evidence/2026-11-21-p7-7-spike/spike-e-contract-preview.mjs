/**
 * P7-7 spike E：contract 页面预览可行性（直接 import 纯函数，不改产品代码）
 *
 * 复用：
 * - frontend/src/design/design-adapter.js#adaptDesign：design.json → 页面/实体渲染模型；
 * - frontend/src/design-preview/contract-preview.js：列/查询/表单/树/分页/驾驶舱/详情模型。
 *
 * 构造一个 sampleEntity + list / tree-list / dialog-form 三份契约，验证能产出；
 * 输出 JSON（stdout + 可选文件）供设计稿/证据引用。
 *
 * 运行：node spike-e-contract-preview.mjs [--json-out <file>]
 */
import fs from 'node:fs'
import path from 'node:path'

const REPO = process.env.REPO_ROOT || 'E:/work_space_primeton/ai-dev-workbench'
const adapterUrl = new URL(`file:///${REPO.replace(/\\/g, '/')}/frontend/src/design/design-adapter.js`).href
const contractUrl = new URL(`file:///${REPO.replace(/\\/g, '/')}/frontend/src/design-preview/contract-preview.js`).href

const { adaptDesign } = await import(adapterUrl)
const {
  resolveContractRecipe,
  buildColumns,
  buildFilters,
  buildForm,
  buildTreeRows,
  buildToolbar,
  buildRowActions,
  selectionEnabled,
  pageSizeOf,
  mockRowsForEntity,
  buildDashboardModel,
  buildDetailModel
} = await import(contractUrl)

const fields = [
  { name: 'code', label: '供应商编码', type: 'string' },
  { name: 'name', label: '供应商名称', type: 'string' },
  { name: 'status', label: '状态', type: 'enum', options: ['启用', '停用', '草稿'] },
  { name: 'org', label: '所属机构', type: 'string' },
  { name: 'owner', label: '负责人', type: 'string' },
  { name: 'amount', label: '年度金额', type: 'decimal' },
  { name: 'enabled', label: '是否合作', type: 'boolean' },
  { name: 'parentName', label: '上级机构', type: 'string' },
  { name: 'createdAt', label: '创建时间', type: 'datetime' },
  { name: 'remark', label: '备注', type: 'string' }
]

const design = {
  module: 'MOD-001',
  title: '供应商管理',
  designSystem: { pack: 'afcenter-app-templates-v1', applicationType: 'enterprise-application-platform', style: 'platform-blue' },
  entities: [
    {
      id: 'supplier',
      name: '供应商',
      fields: fields.map((field) => ({ ...field })),
      relations: []
    }
  ],
  relations: [],
  pages: [
    {
      id: 'supplier-list',
      name: '供应商列表',
      type: 'list',
      entity: 'supplier',
      recipe: 'list',
      filters: ['name', 'status', 'org', 'unknownField'],
      columns: ['code', 'name', 'status', 'owner', 'amount', 'createdAt', 'ghostColumn'],
      toolbarActions: ['create', 'import', 'batchDelete'],
      rowActions: ['edit', 'delete', 'detail'],
      selection: { enabled: true },
      pagination: { layout: 'three-part', pageSize: 10 }
    },
    {
      id: 'org-tree',
      name: '机构树表',
      type: 'tree-list',
      entity: 'supplier',
      recipe: 'tree-list',
      tree: { titleField: 'org', parentField: 'parentName', actionStyle: 'header' },
      columns: ['name', 'status', 'owner'],
      filters: ['name'],
      selection: { enabled: false },
      pagination: { layout: 'bar', pageSize: 20 }
    },
    {
      id: 'supplier-form',
      name: '供应商表单',
      type: 'form',
      entity: 'supplier',
      recipe: 'dialog-form',
      form: {
        presentation: 'dialog',
        columns: 2,
        width: 1200,
        groups: [
          { title: '基本信息', fields: ['name', 'code', 'status', 'org'] },
          { title: '扩展信息', fields: ['owner', 'amount', 'enabled', 'missingField'] }
        ]
      },
      components: { owner: 'pm-select-user', org: 'pm-select-org' }
    },
    {
      id: 'supplier-dashboard',
      name: '供应商驾驶舱',
      type: 'dashboard',
      entity: 'supplier',
      recipe: 'dashboard'
    },
    {
      id: 'supplier-detail',
      name: '供应商详情',
      type: 'detail',
      entity: 'supplier',
      recipe: 'detail',
      columns: ['code', 'name', 'status']
    }
  ]
}

const adapted = adaptDesign(design)
const entity = adapted.entities.find((item) => item.id === 'supplier')
const pageOf = (id) => adapted.pages.find((page) => page.id === id)

const rows = mockRowsForEntity(entity, 24)
const treeRows = rows.map((row, index) => ({
  ...row,
  org: ['总部', '华东事业部', '华南事业部', '研发中心'][index % 4],
  parentName: index % 4 === 0 ? '' : '总部'
}))
// 去重样例：每个机构只出现一次（验证嵌套树的本意）
const uniqueTreeRows = ['总部', '华东事业部', '华南事业部', '研发中心'].map((org, index) => ({
  ...rows[index],
  org,
  parentName: index === 0 ? '' : '总部'
}))

function check(name, fn) {
  try {
    const value = fn()
    return { name, ok: true, value }
  } catch (error) {
    return { name, ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

const results = []
for (const rule of [
  check('adaptDesign 页面数', () => adapted.pages.length),
  check('adaptDesign 实体字段数', () => entity?.fields?.length ?? 0),
  check('list: resolveContractRecipe', () => resolveContractRecipe(pageOf('supplier-list'))),
  check('list: buildColumns', () => buildColumns(pageOf('supplier-list'), entity)),
  check('list: buildFilters', () => buildFilters(pageOf('supplier-list'), entity)),
  check('list: buildToolbar', () => buildToolbar(pageOf('supplier-list'))),
  check('list: buildRowActions', () => buildRowActions(pageOf('supplier-list'))),
  check('list: selectionEnabled', () => selectionEnabled(pageOf('supplier-list'))),
  check('list: pageSizeOf', () => pageSizeOf(pageOf('supplier-list'))),
  check('tree-list: resolveContractRecipe', () => resolveContractRecipe(pageOf('org-tree'))),
  check('tree-list: buildTreeRows（重复行）', () => buildTreeRows(treeRows, { titleField: 'org', parentField: 'parentName' })),
  check('tree-list: buildTreeRows（去重行）', () => buildTreeRows(uniqueTreeRows, { titleField: 'org', parentField: 'parentName' })),
  check('dialog-form: resolveContractRecipe', () => resolveContractRecipe(pageOf('supplier-form'))),
  check('dialog-form: buildForm', () => {
    const form = buildForm(pageOf('supplier-form'), entity)
    return {
      dialog: form.dialog,
      columns: form.columns,
      width: form.width,
      groupCount: form.groups.length,
      groups: form.groups.map((group) => ({ title: group.title, fields: group.fields.map((field) => field.name) })),
      skipped: form.skipped
    }
  }),
  check('dashboard: resolveContractRecipe', () => resolveContractRecipe(pageOf('supplier-dashboard'))),
  check('dashboard: buildDashboardModel', () => {
    const model = buildDashboardModel({ page: pageOf('supplier-dashboard'), entity, rows })
    return { metricCount: model.metrics.length, chartType: model.chartOption?.chartView?.series?.[0]?.type || null, columnCount: model.columns.length }
  }),
  check('detail: resolveContractRecipe', () => resolveContractRecipe(pageOf('supplier-detail'))),
  check('detail: buildDetailModel', () => {
    const model = buildDetailModel({ page: pageOf('supplier-detail'), entity, row: rows[0], entities: adapted.entities })
    return { fieldCount: model.fields.length, hasHero: Boolean(model.hero), timelineCount: model.timeline.length, statusClass: model.status.className }
  })
]) {
  results.push(rule)
}

const summary = {
  ok: results.every((item) => item.ok),
  adaptedPages: adapted.pages.map((page) => ({ id: page.id, type: page.type, recipe: page.recipe, entityId: page.entityId })),
  results
}

const outArgIndex = process.argv.indexOf('--json-out')
if (outArgIndex > 0 && process.argv[outArgIndex + 1]) {
  const out = process.argv[outArgIndex + 1]
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, JSON.stringify(summary, null, 2), 'utf8')
  console.log(`[spike-e] JSON 写入 ${out}`)
}

for (const item of results) {
  console.log(`[spike-e] ${item.ok ? 'OK ' : 'FAIL'} ${item.name}${item.ok ? '' : `：${item.error}`}`)
  if (item.ok && /buildColumns|buildFilters|buildForm|buildTreeRows|buildDashboardModel|buildDetailModel/.test(item.name)) {
    console.log('  ', JSON.stringify(item.value))
  }
}
console.log(`[spike-e] 总计 ${results.filter((item) => item.ok).length}/${results.length} 通过`)
if (!summary.ok) process.exitCode = 1
