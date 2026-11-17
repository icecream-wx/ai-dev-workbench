<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from './api'
import { store, entityName, goBack } from './store'
import FieldControl from './FieldControl.vue'
import BlocksRenderer from './BlocksRenderer.vue'

/**
 * 清单驱动的表单/详情页：create / edit / detail
 * 布局覆盖项：fieldOrder / fieldOverrides(hidden,control,span) / groups / subTables(title,columns,hidden) / blocks
 */
const props = defineProps({
  page: { type: Object, required: true },
  mode: { type: String, default: 'create' },
  record: { type: Object, default: null }
})

const entity = computed(() => (store.manifest?.entities ?? []).find(e => e.id === props.page.entity) ?? null)
const layout = computed(() => props.page.layout ?? {})
const isEdit = computed(() => props.mode === 'edit')
const readonly = computed(() => props.mode === 'detail')
const submitting = ref(false)

const form = reactive({})
const subTables = ref([])

// 新增模式：应用 manifest 字段默认值（如 状态默认「有效」）
watch(
  () => entity.value?.id,
  () => {
    for (const f of entity.value?.fields ?? []) {
      if (f.default !== undefined && f.name !== 'id') form[f.name] = f.default
    }
  },
  { immediate: true }
)

const visibleFields = computed(() => {
  const fields = entity.value?.fields ?? []
  const overrides = layout.value.fieldOverrides ?? {}
  const order = layout.value.fieldOrder
  const names = order?.length
    ? [...order.filter(n => fields.some(f => f.name === n)), ...fields.map(f => f.name).filter(n => !order.includes(n))]
    : fields.map(f => f.name)
  return names
    .map(n => fields.find(f => f.name === n))
    .filter(Boolean)
    .filter(f => !f.pk)
    .filter(f => !f.autoFk)
    .filter(f => overrides[f.name]?.hidden !== true)
    .map(f => ({ ...f, control: overrides[f.name]?.control, span: overrides[f.name]?.span }))
})

const groups = computed(() => {
  const gs = layout.value.groups
  if (gs?.length) {
    return gs
      .map(g => ({ title: g.title, fields: visibleFields.value.filter(f => g.fields.includes(f.name)) }))
      .filter(g => g.fields.length)
  }
  return [{ title: '', fields: visibleFields.value }]
})

const subTableDefs = computed(() => {
  const rels = (entity.value?.relations ?? []).filter(r => r.type === 'one-to-many')
  const overrides = layout.value.subTables ?? []
  const out = []
  for (const rel of rels) {
    const o = overrides.find(s => s.target === rel.target)
    if (o?.hidden) continue
    const child = (store.manifest?.entities ?? []).find(e => e.id === rel.target)
    if (!child) continue
    const fk = `${entity.value.id}Id`
    if (!child.fields.some(f => f.name === fk)) continue
    out.push({ rel, child, fk, title: o?.title ?? rel.name ?? child.name, columnNames: o?.columns })
  }
  return out
})

function subColumns(def) {
  const fields = def.child.fields
  let names = def.columnNames?.filter(n => fields.some(f => f.name === n))
  if (!names?.length) names = fields.filter(f => !f.pk).slice(0, 4).map(f => f.name)
  return names.map(n => fields.find(f => f.name === n)).filter(Boolean)
}

async function fill() {
  if (!entity.value) return
  if ((isEdit.value || readonly.value) && props.record) {
    try {
      const fresh = await api.get(entity.value.id, props.record[entity.value.pk])
      Object.assign(form, fresh)
    } catch {
      Object.assign(form, props.record)
    }
  }
  await loadSubTables()
}

async function loadSubTables() {
  const out = []
  for (const def of subTableDefs.value) {
    let rows = []
    if (props.record?.[entity.value.pk]) {
      try {
        const res = await api.list(def.child.id, { page: 1, pageSize: 100, [def.fk]: props.record[entity.value.pk] })
        rows = res.rows ?? []
      } catch {
        rows = []
      }
    }
    out.push({ ...def, rows })
  }
  subTables.value = out
}

onMounted(fill)

const spanOf = f => f.span ?? (f.type === 'text' ? 24 : 12)

async function onSubmit() {
  if (!entity.value || submitting.value) return
  submitting.value = true
  try {
    const payload = {}
    for (const f of visibleFields.value) payload[f.name] = form[f.name]
    if (isEdit.value) {
      await api.update(entity.value.id, props.record[entity.value.pk], payload)
      ElMessage.success('已保存')
    } else {
      await api.create(entity.value.id, payload)
      ElMessage.success('已创建')
    }
    goBack()
  } catch (err) {
    ElMessage.error(err.message)
  } finally {
    submitting.value = false
  }
}

const bottomBlocks = computed(() => (layout.value.blocks ?? []).filter(b => b.position !== 'top'))
const topBlocks = computed(() => (layout.value.blocks ?? []).filter(b => b.position === 'top'))
</script>

<template>
  <div v-if="entity" class="pg">
    <div class="pg-head">
      <div>
        <h2 class="pg-title">{{ readonly ? `${entity.name}详情` : isEdit ? `编辑${entity.name}` : `新增${entity.name}` }}</h2>
        <div class="pg-sub">{{ page.title }} · {{ entityName(page.entity) }}</div>
      </div>
      <el-button text @click="goBack">返回</el-button>
    </div>

    <BlocksRenderer :blocks="topBlocks" :entity="entity" />

    <div class="pg-card">
      <template v-for="(g, gi) in groups" :key="gi">
        <div v-if="g.title" class="fg-title">{{ g.title }}</div>
        <el-form label-width="110px" @submit.prevent>
          <el-row :gutter="18">
            <el-col v-for="f in g.fields" :key="f.name" :span="spanOf(f)">
              <el-form-item :label="f.label" :required="f.required && !readonly">
                <FieldControl :field="f" v-model="form[f.name]" :disabled="readonly" />
                <div v-if="f.note" class="field-note">{{ f.note }}</div>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
        <div v-if="gi < groups.length - 1" class="fg-divider" />
      </template>

      <div v-if="!readonly" class="pg-form-foot">
        <el-button @click="goBack">取消</el-button>
        <el-button
          v-if="!(page.actions ?? []).length || (page.actions ?? []).includes('submit')"
          type="primary"
          :loading="submitting"
          @click="onSubmit"
        >{{ isEdit ? '保存' : '创建' }}</el-button>
      </div>
      <div v-else class="pg-form-foot">
        <el-button type="primary" plain @click="store.openPage(store.current.pageId, { ...store.current, mode: 'edit' })">编辑</el-button>
      </div>
    </div>

    <div v-for="(sub, i) in subTables" :key="i" class="pg-card">
      <div class="pg-title-sm">{{ sub.title }}（{{ sub.rows.length }}）</div>
      <el-table :data="sub.rows" size="small" stripe>
        <el-table-column
          v-for="f in subColumns(sub)"
          :key="f.name"
          :label="f.label"
          :prop="f.type === 'ref' ? `${f.name}Label` : f.name"
          min-width="110"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <el-tag v-if="f.type === 'enum'" size="small" effect="plain">{{ row[f.name] ?? '-' }}</el-tag>
            <span v-else-if="f.type === 'boolean'">{{ row[f.name] ? '✓' : '✗' }}</span>
            <span v-else>{{ row[f.name] ?? '-' }}</span>
          </template>
        </el-table-column>
        <template #empty>暂无{{ sub.child.name }}数据</template>
      </el-table>
    </div>

    <BlocksRenderer :blocks="bottomBlocks" :entity="entity" />
  </div>
</template>

<style scoped>
.pg { max-width: 1080px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
.pg-head { display: flex; align-items: center; justify-content: space-between; }
.pg-title { font-size: 17px; font-weight: 700; margin: 0; color: #1c2233; }
.pg-sub { font-size: 12px; color: #8b91a5; margin-top: 3px; }
.pg-card { background: #fff; border: 1px solid #e4e7ef; border-radius: 10px; padding: 18px 20px; }
.pg-title-sm { font-size: 13px; font-weight: 600; color: #1c2233; margin-bottom: 10px; }
.fg-title { font-size: 13px; font-weight: 600; color: #1c2233; margin: 2px 0 14px; padding-left: 9px; border-left: 3px solid #5b5bd6; line-height: 1.3; }
.fg-divider { height: 1px; background: #eef0f6; margin: 4px 0 16px; }
.pg-form-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.field-note { font-size: 11px; color: #9aa0b5; line-height: 1.4; margin-top: 2px; }
</style>
