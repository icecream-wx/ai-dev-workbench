<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from './api'
import { store, openEntityPage, entityName, goBack } from './store'
import BlocksRenderer from './BlocksRenderer.vue'

/**
 * 清单驱动的列表页：检索区 + 工具栏 + 数据表格 + 分页 + 行动作
 * 布局覆盖项：layout.table(columns/pageSize/searchFields)、layout.toolbar(actions)、layout.blocks
 */
const props = defineProps({ page: { type: Object, required: true } })

const entity = computed(() => (store.manifest?.entities ?? []).find(e => e.id === props.page.entity) ?? null)
const layout = computed(() => props.page.layout ?? {})

const actions = computed(() => {
  const declared = props.page.actions ?? ['create', 'edit', 'delete', 'detail']
  return declared
})
const toolbarActions = computed(() => {
  const t = layout.value.toolbar?.actions
  if (Array.isArray(t) && t.length) return t
  return ['create', 'batchDelete', 'export'].filter(a => a === 'create' || actions.value.includes(a) || a === 'export')
})

const displayFields = computed(() => {
  const fields = entity.value?.fields ?? []
  const byName = Object.fromEntries(fields.map(f => [f.name, f]))
  let names = layout.value.table?.columns?.filter(c => byName[c])
  if (!names?.length) {
    names = fields.filter(f => !['text', 'ref'].includes(f.type) || f.type === 'ref').slice(0, 6).map(f => f.name)
  }
  return names.map(n => byName[n]).filter(Boolean)
})

const searchFieldDefs = computed(() => {
  const fields = entity.value?.fields ?? []
  const declared = layout.value.table?.searchFields?.filter(n => fields.some(f => f.name === n)) ?? []
  const names = declared.length ? declared : fields.filter(f => ['string', 'enum'].includes(f.type)).slice(0, 2).map(f => f.name)
  return names.map(n => fields.find(f => f.name === n)).filter(Boolean)
})

const labelOf = fieldName => (entity.value?.fields ?? []).find(f => f.name === fieldName)?.label ?? fieldName
const targetEntityName = fieldName => {
  const f = (entity.value?.fields ?? []).find(x => x.name === fieldName)
  return f?.target ? entityName(f.target) : ''
}

const rows = ref([])
const total = ref(0)
const loading = ref(false)
const page_ = ref(1)
const pageSize = ref(Number(layout.value.table?.pageSize) || 20)
const search = ref('')
const filters = ref({})
const selection = ref([])

async function load() {
  if (!entity.value) return
  loading.value = true
  try {
    const params = { page: page_.value, pageSize: pageSize.value }
    if (search.value) params.search = search.value
    for (const [k, v] of Object.entries(filters.value)) {
      if (v !== '' && v !== null && v !== undefined) params[k] = v
    }
    const res = await api.list(entity.value.id, params)
    rows.value = res.rows ?? []
    total.value = res.total ?? 0
  } catch (err) {
    ElMessage.error(err.message)
  } finally {
    loading.value = false
  }
}

watch([search, filters, page_, pageSize], load, { deep: true })
watch(() => props.page.id, () => {
  page_.value = 1
  search.value = ''
  filters.value = {}
  load()
})
onMounted(load)

function resetQuery() {
  search.value = ''
  filters.value = {}
  page_.value = 1
}

function cellText(row, field) {
  if (field.type === 'ref') return row[`${field.name}Label`] ?? row[field.name] ?? '-'
  if (row[field.name] === null || row[field.name] === undefined || row[field.name] === '') return '-'
  return String(row[field.name])
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除该条${entityName(entity.value.id)}记录？`, '删除确认', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
  } catch {
    return
  }
  try {
    await api.remove(entity.value.id, row[entity.value.pk])
    ElMessage.success('已删除')
    load()
  } catch (err) {
    ElMessage.error(err.message)
  }
}

async function onBatchDelete() {
  const ids = selection.value.map(r => r[entity.value.pk])
  if (!ids.length) {
    ElMessage.warning('请先勾选要删除的行')
    return
  }
  try {
    await ElMessageBox.confirm(`将删除选中的 ${ids.length} 条记录，且不可恢复，确定继续？`, '批量删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
  } catch {
    return
  }
  try {
    const res = await api.batchDelete(entity.value.id, ids)
    ElMessage.success(`已删除 ${res.deleted} 条`)
    load()
  } catch (err) {
    ElMessage.error(err.message)
  }
}

function onExport() {
  const header = displayFields.value.map(f => f.label).join(',')
  const lines = rows.value.map(r => displayFields.value.map(f => `"${cellText(r, f).replace(/"/g, '""')}"`).join(','))
  const csv = `\uFEFF${header}\n${lines.join('\n')}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.page.title}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function onToolbarAction(action) {
  if (action === 'create') openEntityPage(entity.value.id, 'create')
  else if (action === 'batchDelete') onBatchDelete()
  else if (action === 'export') onExport()
  else ElMessage.info(`动作「${action}」由插件/后续版本实现`)
}

const topBlocks = computed(() => (layout.value.blocks ?? []).filter(b => b.position === 'top'))
const bottomBlocks = computed(() => (layout.value.blocks ?? []).filter(b => b.position !== 'top'))
</script>

<template>
  <div class="pg">
    <div class="pg-head">
      <div>
        <h2 class="pg-title">{{ page.title }}</h2>
        <div class="pg-sub">{{ entityName(page.entity) }} · 共 {{ total }} 条</div>
      </div>
      <el-button v-if="store.history.length" text @click="goBack">返回</el-button>
    </div>

    <BlocksRenderer :blocks="topBlocks" :entity="entity" />

    <div class="pg-card">
      <div class="pg-search">
        <el-input
          v-for="f in searchFieldDefs"
          :key="f.name"
          v-model="filters[f.name]"
          :placeholder="`按${f.label}查询`"
          clearable
          style="width: 200px"
          @keyup.enter="page_ = 1; load()"
        />
        <el-button type="primary" plain @click="page_ = 1; load()">查询</el-button>
        <el-button @click="resetQuery">重置</el-button>
      </div>
      <div class="pg-toolbar">
        <el-button
          v-for="a in toolbarActions"
          :key="a"
          :type="a === 'create' ? 'primary' : 'default'"
          size="small"
          @click="onToolbarAction(a)"
        >{{ { create: '新增', batchDelete: '批量删除', export: '导出' }[a] ?? a }}</el-button>
      </div>
      <el-table :data="rows" v-loading="loading" stripe @selection-change="selection = $event">
        <el-table-column v-if="toolbarActions.includes('batchDelete')" type="selection" width="42" />
        <el-table-column
          v-for="f in displayFields"
          :key="f.name"
          :label="f.label"
          :prop="f.type === 'ref' ? `${f.name}Label` : f.name"
          min-width="120"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <el-tag v-if="f.type === 'enum'" size="small" effect="plain">{{ cellText(row, f) }}</el-tag>
            <span v-else-if="f.type === 'boolean'" :class="row[f.name] ? 'cell-ok' : 'cell-no'">{{ row[f.name] ? '✓' : '✗' }}</span>
            <span v-else>{{ cellText(row, f) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button v-if="actions.includes('detail')" text size="small" type="primary" @click="openEntityPage(page.entity, 'detail', row)">详情</el-button>
            <el-button v-if="actions.includes('edit')" text size="small" type="primary" @click="openEntityPage(page.entity, 'edit', row)">编辑</el-button>
            <el-button v-if="actions.includes('delete')" text size="small" type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>暂无数据，点击「新增」创建第一条</template>
      </el-table>
      <div class="pg-pager">
        <el-pagination
          v-model:current-page="page_"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          background
          small
        />
      </div>
    </div>

    <BlocksRenderer :blocks="bottomBlocks" :entity="entity" />
  </div>
</template>

<style scoped>
.pg { max-width: 1280px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
.pg-head { display: flex; align-items: center; justify-content: space-between; }
.pg-title { font-size: 17px; font-weight: 700; margin: 0; color: #1c2233; }
.pg-sub { font-size: 12px; color: #8b91a5; margin-top: 3px; }
.pg-card { background: #fff; border: 1px solid #e4e7ef; border-radius: 10px; padding: 14px 16px; }
.pg-search { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.pg-toolbar { display: flex; gap: 8px; margin-bottom: 10px; }
.pg-pager { display: flex; justify-content: flex-end; margin-top: 12px; }
.cell-ok { color: #16a34a; font-weight: 600; }
.cell-no { color: #c0c4cf; }
</style>
