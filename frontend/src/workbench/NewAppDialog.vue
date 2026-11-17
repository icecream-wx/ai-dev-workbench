<template>
  <Teleport to="body">
    <div v-if="modelValue" class="mask" @click.self="close">
      <div class="dialog" role="dialog" aria-modal="true" aria-label="新建应用">
        <header class="head">
          <div>
            <h2>新建应用</h2>
            <p>创建后会在 <code>projects/&lt;app-id&gt;/</code> 生成独立目录与 EOS 后端起点。</p>
          </div>
          <button type="button" class="icon-btn" aria-label="关闭" title="关闭" @click="close">×</button>
        </header>

        <form class="body" @submit.prevent="submit">
          <div class="row two">
            <label class="field">
              <span>应用 ID <b>*</b></span>
              <input v-model.trim="form.id" placeholder="leave-demo" autocomplete="off" />
              <small>小写字母、数字、短横线；用于目录 / artifactId / sys-code。示例：leave-demo</small>
            </label>
            <label class="field">
              <span>名称 <b>*</b></span>
              <input v-model.trim="form.name" placeholder="请假管理" autocomplete="off" />
              <small>显示在工作台的应用名称，可用中文。示例：请假管理</small>
            </label>
          </div>

          <label class="field">
            <span>描述</span>
            <textarea v-model.trim="form.description" rows="2" placeholder="一句话说明这个应用做什么" />
            <small>一句话说明业务目标，会进入需求阶段的上下文。</small>
          </label>

          <div class="row two">
            <label class="field">
              <span>需求模板</span>
              <select v-model="form.requirementTemplateId" :disabled="templatesLoading">
                <option value="">默认（工作台标准 PRD）</option>
                <option v-for="template in requirementTemplates" :key="template.id" :value="template.id">
                  {{ template.name }} · {{ template.category }}
                </option>
              </select>
              <small>
                {{
                  selectedRequirementTemplate?.description ||
                  (templatesLoading ? '模板加载中…' : '仅可选择需求阶段模板；之后可在需求阶段切换。')
                }}
              </small>
            </label>
            <label class="field">
              <span>设计原型模板</span>
              <select v-model="form.prototypeTemplateId" :disabled="templatesLoading">
                <option value="">默认（企业级专业管理）</option>
                <option v-for="template in prototypeTemplates" :key="template.id" :value="template.id">
                  {{ template.name }} · {{ TEMPLATE_CATEGORY_LABELS[template.category] }}
                </option>
              </select>
              <small>
                {{
                  selectedPrototypeTemplate?.description ||
                  (templatesLoading ? '模板加载中…' : '之后可在设计阶段切换原型模板。')
                }}
              </small>
            </label>
          </div>
          <p class="templates-hint">
            设计原型模板也会用于需求阶段的粗略原型预览；之后在设计阶段切换模板，需求预览会同步更新。
          </p>
          <p v-if="templatesNotice" class="templates-notice">{{ templatesNotice }}</p>

          <div class="row two">
            <label class="field">
              <span>后端端口</span>
              <input v-model.number="form.backendPort" type="number" min="1024" max="65535" />
              <small>1024—65535 的整数，默认 8081；不要与工作台 3300 冲突。</small>
            </label>
            <label class="field">
              <span>EOS sys-key</span>
              <input v-model.trim="form.eosSysKey" placeholder="留空写入 CHANGE_ME" autocomplete="off" />
              <small>EOS 应用标识，通常与应用 ID 一致；留空写入 CHANGE_ME。</small>
            </label>
          </div>

          <button type="button" class="advanced-toggle" @click="advancedOpen = !advancedOpen">
            {{ advancedOpen ? '收起高级配置' : '高级配置（数据库 / 邮件）' }}
          </button>

          <div v-if="advancedOpen" class="advanced">
            <p class="advanced-hint">
              这些值只用于渲染 <code>backend/</code> 配置文件，不写入工作台数据库。留空会写成 <code>CHANGE_ME</code>；不要提交真实凭据。
            </p>
            <div class="row three">
              <label class="field">
                <span>DB Host</span>
                <input v-model.trim="form.dbHost" placeholder="10.15.15.160" />
                <small>只填主机名或 IP，如 10.15.15.160、mysql.internal；不要带 jdbc:mysql:// 前缀。</small>
              </label>
              <label class="field">
                <span>DB Port</span>
                <input v-model.trim="form.dbPort" placeholder="3306" />
                <small>MySQL 端口，通常 3306；只填数字。</small>
              </label>
              <label class="field">
                <span>DB Name</span>
                <input v-model.trim="form.dbName" placeholder="quarterly_reporting" />
                <small>数据库名（schema），如 quarterly_reporting；不要填 JDBC URL。</small>
              </label>
            </div>
            <div class="row two">
              <label class="field">
                <span>DB User</span>
                <input v-model.trim="form.dbUser" placeholder="CHANGE_ME" />
                <small>数据库登录用户名。</small>
              </label>
              <label class="field">
                <span>DB Password</span>
                <input v-model.trim="form.dbPassword" type="password" placeholder="CHANGE_ME" autocomplete="new-password" />
                <small>数据库密码；只写入 projects/，不写入工作台数据库。</small>
              </label>
            </div>
            <div class="row three">
              <label class="field">
                <span>Mail Host</span>
                <input v-model.trim="form.mailHost" placeholder="smtp.example.com" />
                <small>SMTP 服务器主机名，如 smtp.example.com；不要带 smtp://。</small>
              </label>
              <label class="field">
                <span>Mail User</span>
                <input v-model.trim="form.mailUsername" placeholder="noreply@example.com" />
                <small>发件邮箱地址或 SMTP 登录账号。</small>
              </label>
              <label class="field">
                <span>Mail Password</span>
                <input v-model.trim="form.mailPassword" type="password" placeholder="CHANGE_ME" autocomplete="new-password" />
                <small>邮箱密码或 SMTP 授权码（不是网页登录密码）。</small>
              </label>
            </div>
          </div>

          <p v-if="error" class="error">{{ error }}</p>

          <footer class="actions">
            <button type="button" class="btn" :disabled="busy" @click="close">取消</button>
            <button type="submit" class="btn primary" :disabled="busy">{{ busy ? '创建中…' : '创建应用' }}</button>
          </footer>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ApiError, createApp, type AppInfo } from './api'
import { listTemplates, type RequirementTemplate } from '../requirements/api'
import { listPrototypeTemplates } from '../design/api'
import { TEMPLATE_CATEGORY_LABELS, type PrototypeTemplate } from '../design/types'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [open: boolean]
  created: [app: AppInfo]
}>()

const DEFAULT_REQUIREMENT_TEMPLATE_ID = 'builtin-prd'
const DEFAULT_PROTOTYPE_TEMPLATE_ID = 'builtin-prototype-enterprise'

const busy = ref(false)
const error = ref('')
const advancedOpen = ref(false)
const templatesLoading = ref(false)
const templatesNotice = ref('')
const requirementTemplates = ref<RequirementTemplate[]>([])
const prototypeTemplates = ref<PrototypeTemplate[]>([])
let templateLoadToken = 0

const form = reactive({
  id: '',
  name: '',
  description: '',
  requirementTemplateId: '',
  prototypeTemplateId: '',
  backendPort: 8081,
  eosSysKey: '',
  dbHost: '',
  dbPort: '',
  dbName: '',
  dbUser: '',
  dbPassword: '',
  mailHost: '',
  mailUsername: '',
  mailPassword: ''
})

const selectedRequirementTemplate = computed(
  () => requirementTemplates.value.find(template => template.id === form.requirementTemplateId) ?? null
)
const selectedPrototypeTemplate = computed(
  () => prototypeTemplates.value.find(template => template.id === form.prototypeTemplateId) ?? null
)

function resetForm(): void {
  Object.assign(form, {
    id: '',
    name: '',
    description: '',
    requirementTemplateId: '',
    prototypeTemplateId: '',
    backendPort: 8081,
    eosSysKey: '',
    dbHost: '',
    dbPort: '',
    dbName: '',
    dbUser: '',
    dbPassword: '',
    mailHost: '',
    mailUsername: '',
    mailPassword: ''
  })
}

/** 默认选中内置模板；不存在时回退列表第一项（列表为空则不传，后端用默认） */
function pickDefaultTemplate<T extends { id: string }>(list: T[], preferredId: string): string {
  if (!list.length) return ''
  return list.some(item => item.id === preferredId) ? preferredId : list[0].id
}

async function loadTemplates(): Promise<void> {
  const token = ++templateLoadToken
  templatesLoading.value = true
  templatesNotice.value = ''
  const [requirementResult, prototypeResult] = await Promise.allSettled([
    listTemplates({ stage: 'requirements' }),
    listPrototypeTemplates()
  ])
  if (token !== templateLoadToken) return
  let failed = false
  if (requirementResult.status === 'fulfilled') {
    requirementTemplates.value = requirementResult.value
  } else {
    requirementTemplates.value = []
    failed = true
  }
  if (prototypeResult.status === 'fulfilled') {
    prototypeTemplates.value = prototypeResult.value
  } else {
    prototypeTemplates.value = []
    failed = true
  }
  templatesLoading.value = false
  if (failed) templatesNotice.value = '模板列表加载失败，将使用默认模板'
  form.requirementTemplateId = pickDefaultTemplate(requirementTemplates.value, DEFAULT_REQUIREMENT_TEMPLATE_ID)
  form.prototypeTemplateId = pickDefaultTemplate(prototypeTemplates.value, DEFAULT_PROTOTYPE_TEMPLATE_ID)
}

watch(
  () => props.modelValue,
  open => {
    if (!open) {
      // 关闭后丢弃未完成的模板请求，避免下一次打开被旧结果覆盖
      templateLoadToken += 1
      templatesLoading.value = false
      return
    }
    resetForm()
    error.value = ''
    advancedOpen.value = false
    requirementTemplates.value = []
    prototypeTemplates.value = []
    templatesNotice.value = ''
    void loadTemplates()
  }
)

function close(): void {
  if (busy.value) return
  emit('update:modelValue', false)
}

function validate(): string {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(form.id)) return '应用 ID 只能包含小写字母、数字、短横线，且以字母或数字开头'
  if (!form.name.trim()) return '请填写应用名称'
  const port = Number(form.backendPort)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) return '后端端口需为 1024—65535 的整数'
  if (form.dbHost && /^\s*jdbc:|:\/\//i.test(form.dbHost)) {
    return 'DB Host 只填主机名或 IP（如 10.15.15.160），不要带 jdbc:mysql:// 前缀'
  }
  if (form.dbPort && (!/^\d+$/.test(form.dbPort) || Number(form.dbPort) < 1 || Number(form.dbPort) > 65535)) {
    return 'DB Port 只填 1—65535 的整数，通常为 3306'
  }
  if (form.mailHost && /:\/\//.test(form.mailHost)) {
    return 'Mail Host 只填 SMTP 主机名（如 smtp.example.com），不要带 smtp:// 前缀'
  }
  return ''
}

async function submit(): Promise<void> {
  if (busy.value) return
  error.value = validate()
  if (error.value) return
  busy.value = true
  try {
    const app = await createApp({
      id: form.id,
      name: form.name,
      description: form.description,
      backendPort: Number(form.backendPort),
      ...(form.requirementTemplateId ? { requirementTemplateId: form.requirementTemplateId } : {}),
      ...(form.prototypeTemplateId ? { prototypeTemplateId: form.prototypeTemplateId } : {}),
      ...(form.eosSysKey ? { eosSysKey: form.eosSysKey } : {}),
      ...(form.dbHost ? { dbHost: form.dbHost } : {}),
      ...(form.dbPort ? { dbPort: form.dbPort } : {}),
      ...(form.dbName ? { dbName: form.dbName } : {}),
      ...(form.dbUser ? { dbUser: form.dbUser } : {}),
      ...(form.dbPassword ? { dbPassword: form.dbPassword } : {}),
      ...(form.mailHost ? { mailHost: form.mailHost } : {}),
      ...(form.mailUsername ? { mailUsername: form.mailUsername } : {}),
      ...(form.mailPassword ? { mailPassword: form.mailPassword } : {})
    })
    emit('update:modelValue', false)
    emit('created', app)
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: var(--rg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.dialog {
  display: flex;
  flex-direction: column;
  width: min(720px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  border-radius: var(--rg-radius-lg);
  box-shadow: 0 24px 60px rgba(10, 14, 20, 0.28);
  font-family: 'Inter', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: var(--rg-text);
  overflow: hidden;
}
.head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px 12px;
  flex-shrink: 0;
}
.head h2 {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 650;
}
.head p {
  margin: 0;
  font-size: 12.5px;
  color: var(--rg-text-2);
  line-height: 1.6;
}
.icon-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--rg-text-3);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.icon-btn:hover {
  background: var(--rg-fill-2);
  color: var(--rg-text);
}
.body {
  padding: 6px 24px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  min-height: 0;
}
.row {
  display: grid;
  gap: 12px;
}
.row.two {
  grid-template-columns: 1fr 1fr;
}
.row.three {
  grid-template-columns: repeat(3, 1fr);
}
@media (max-width: 900px) {
  .row.three {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 768px) {
  .mask {
    padding: 12px;
  }
  .dialog {
    width: calc(100vw - 24px);
    max-height: calc(100vh - 24px);
  }
  .head {
    padding: 18px 18px 10px;
  }
  .body {
    padding: 4px 18px 18px;
  }
  .row.two,
  .row.three {
    grid-template-columns: 1fr;
  }
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.field > span {
  font-size: 12px;
  color: var(--rg-text-2);
  font-weight: 500;
}
.field b {
  color: var(--rg-danger);
  font-weight: 600;
}
.field input,
.field textarea,
.field select {
  border: 1px solid var(--rg-border-strong);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  color: var(--rg-text);
  background: var(--rg-surface);
  outline: none;
}
.field input::placeholder,
.field textarea::placeholder {
  color: var(--rg-text-3);
}
.field input:focus,
.field textarea:focus,
.field select:focus {
  border-color: var(--rg-ai);
  box-shadow: 0 0 0 3px var(--rg-ai-soft);
}
.field small {
  font-size: 11px;
  color: var(--rg-text-3);
  line-height: 1.5;
}
.advanced-toggle {
  align-self: flex-start;
  min-height: 28px;
  border: none;
  background: transparent;
  color: var(--rg-link);
  font-size: 12.5px;
  cursor: pointer;
  padding: 0;
}
.advanced-toggle:hover {
  text-decoration: underline;
}
.advanced {
  border: 1px solid var(--rg-border);
  border-radius: var(--rg-radius);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--rg-surface-2);
}
.advanced-hint {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--rg-text-2);
}
.templates-hint {
  margin: -4px 0 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--rg-text-3);
}
.templates-notice {
  margin: -6px 0 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--rg-warn);
}
code {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 11px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
  border-radius: 4px;
  padding: 1px 5px;
}
.error {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--rg-danger);
  background: var(--rg-danger-soft);
  border: 1px solid var(--rg-danger-border);
  border-radius: 8px;
  padding: 8px 10px;
  white-space: pre-wrap;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px solid var(--rg-border);
  position: sticky;
  bottom: -22px;
  background: var(--rg-surface);
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
}
.btn:hover:not(:disabled) {
  border-color: var(--rg-text-3);
  background: var(--rg-hover);
  color: var(--rg-text);
}
.btn.primary {
  background: var(--rg-ink);
  border-color: var(--rg-ink);
  color: var(--rg-ink-contrast);
}
.btn.primary:hover:not(:disabled) {
  background: var(--rg-ink-hover);
  border-color: var(--rg-ink-hover);
  color: var(--rg-ink-contrast);
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
