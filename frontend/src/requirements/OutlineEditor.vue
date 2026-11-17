<template>
  <div class="outline-editor" :class="{ readonly }">
    <header class="outline-head">
      <div class="outline-title">
        <strong>{{ mode === 'scenes' ? '场景结构' : 'Epic / Story 结构' }}</strong>
        <span class="outline-count">
          {{ mode === 'scenes' ? `${scenes.length} 个场景` : `${epics.length} 个 Epic · ${stories.length} 个 Story` }}
        </span>
        <span class="outline-hint">稳定 ID 由系统分配，不随标题修改；场景可选，一个场景可包含多个 Epic</span>
      </div>
      <div class="outline-actions">
        <button v-if="!readonly && mode === 'scenes'" type="button" class="btn" @click="addScene">新增场景</button>
        <button v-if="!readonly && mode === 'epics'" type="button" class="btn" @click="addEpic">新增 Epic</button>
        <button v-if="!readonly && mode === 'epics'" type="button" class="btn" @click="addStory()">新增 Story</button>
      </div>
    </header>

    <template v-if="mode === 'scenes'">
      <div v-for="scene in scenes" :key="scene.id" class="scene-card">
        <div class="row-head">
          <span class="id-chip">{{ scene.id }}</span>
          <el-input v-model="scene.title" size="small" placeholder="场景名称，如：订单管理" @input="emitChange" />
          <button v-if="!readonly" type="button" class="icon-btn" title="删除场景" @click="removeScene(scene.id)">×</button>
        </div>
        <el-input
          v-model="scene.description"
          type="textarea"
          :rows="2"
          size="small"
          placeholder="场景描述：谁在什么情况下做什么、关键状态/异常"
          @input="emitChange"
        />
      </div>
      <p v-if="!scenes.length" class="empty">
        还没有场景。可以点「新增场景」，或在下方“结构 / Markdown”里切到 Markdown 写完后点“重建结构”。
      </p>
    </template>

    <template v-else>
      <div v-for="epic in epics" :key="epic.id" class="epic-card">
        <div class="row-head">
          <span class="id-chip">{{ epic.id }}</span>
          <el-input v-model="epic.title" size="small" placeholder="Epic 名称，如：订单创建" @input="emitChange" />
          <button v-if="!readonly" type="button" class="icon-btn" title="删除 Epic" @click="removeEpic(epic.id)">×</button>
        </div>
        <div class="epic-meta">
          <label class="field">
            <span>目标</span>
            <el-input
              v-model="epic.goal"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 6 }"
              size="small"
              placeholder="这个 Epic 要达成的业务目标（1—3 句；Story 请放在下方）"
              @input="emitChange"
            />
          </label>
          <label class="field narrow">
            <span>优先级</span>
            <el-input v-model="epic.priority" size="small" placeholder="P0/P1" @input="emitChange" />
          </label>
          <label class="field" title="一个场景可包含多个 Epic；一个 Epic 最多属于一个场景">
            <span>所属场景（可选）</span>
            <el-select
              v-model="epic.sceneId"
              size="small"
              clearable
              placeholder="（无）"
              title="一个场景可包含多个 Epic；一个 Epic 最多属于一个场景"
              @change="emitChange"
            >
              <el-option v-for="scene in sceneOptions" :key="scene.id" :label="`${scene.id} ${scene.title}`" :value="scene.id" />
            </el-select>
          </label>
        </div>

        <div class="story-list">
          <div v-for="story in storiesOf(epic.id)" :key="story.id" class="story-card">
            <div class="row-head">
              <span class="id-chip story">{{ story.id }}</span>
              <el-input v-model="story.title" size="small" placeholder="Story 标题，如：创建订单" @input="emitChange" />
              <button v-if="!readonly" type="button" class="icon-btn" title="删除 Story" @click="removeStory(story.id)">×</button>
            </div>
            <el-input
              v-model="story.description"
              type="textarea"
              :rows="2"
              size="small"
              placeholder="作为…，我希望…，以便…"
              @input="emitChange"
            />
            <div class="story-meta">
              <label class="field narrow">
                <span>优先级</span>
                <el-input v-model="story.priority" size="small" placeholder="P0/P1" @input="emitChange" />
              </label>
              <label class="field">
                <span>验收标准（每行一条）</span>
                <el-input
                  type="textarea"
                  :rows="2"
                  size="small"
                  :model-value="story.acceptance.join('\n')"
                  placeholder="必填字段校验&#10;保存后列表可见"
                  @update:model-value="value => setAcceptance(story, value)"
                />
              </label>
            </div>
          </div>
          <button v-if="!readonly" type="button" class="add-story" @click="addStory(epic.id)">＋ 在此 Epic 下新增 Story</button>
        </div>
        <p v-if="!storiesOf(epic.id).length" class="epic-warning" data-testid="epic-no-story">
          该 Epic 还没有 Story；设计阶段不会为它生成页面集。
        </p>
      </div>

      <div v-if="orphanStories.length" class="epic-card orphan">
        <div class="orphan-head">
          <span class="id-chip">未归属 Epic</span>
          <span class="outline-hint">这些 Story 没有绑定 Epic；设计页面集只会按 Epic/场景组织。</span>
        </div>
        <div v-for="story in orphanStories" :key="story.id" class="story-card">
          <div class="row-head">
            <span class="id-chip story">{{ story.id }}</span>
            <el-input v-model="story.title" size="small" placeholder="Story 标题" @input="emitChange" />
            <el-select v-model="story.epicId" size="small" clearable placeholder="归属 Epic" @change="emitChange">
              <el-option v-for="epic in epics" :key="epic.id" :label="`${epic.id} ${epic.title}`" :value="epic.id" />
            </el-select>
            <button v-if="!readonly" type="button" class="icon-btn" title="删除 Story" @click="removeStory(story.id)">×</button>
          </div>
        </div>
      </div>

      <p v-if="!epics.length && !stories.length" class="empty">
        还没有 Epic/Story。可以点「新增 Epic」，或在下方“结构 / Markdown”里切到 Markdown 写完并点“重建结构”。
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { OutlineEpic, OutlineScene, OutlineStory, RequirementOutlineData } from './api'

const props = defineProps<{
  mode: 'scenes' | 'epics'
  data: RequirementOutlineData
  /** 文档内全部场景（epics 章节需要选择所属场景） */
  scenes?: OutlineScene[]
  readonly?: boolean
}>()

const emit = defineEmits<{ change: [RequirementOutlineData] }>()

function clone(value: RequirementOutlineData): RequirementOutlineData {
  return JSON.parse(JSON.stringify(value || { scenes: [], epics: [], stories: [] })) as RequirementOutlineData
}

const local = ref<RequirementOutlineData>(clone(props.data))

watch(
  () => props.data,
  next => {
    local.value = clone(next)
  },
  { deep: true }
)

const scenes = computed(() => local.value.scenes.filter(item => !item.archived))
const epics = computed(() => local.value.epics.filter(item => !item.archived))
const stories = computed(() => local.value.stories.filter(item => !item.archived))
const orphanStories = computed(() => stories.value.filter(story => !story.epicId))
const sceneOptions = computed(() => {
  const map = new Map<string, OutlineScene>()
  for (const scene of [...(props.scenes ?? []), ...scenes.value]) map.set(scene.id, scene)
  return Array.from(map.values()).filter(scene => !scene.archived)
})

function storiesOf(epicId: string): OutlineStory[] {
  return stories.value.filter(story => story.epicId === epicId)
}

function nextId(prefix: 'SCENE' | 'EPIC' | 'STORY'): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`)
  let max = 0
  for (const item of [...local.value.scenes, ...local.value.epics, ...local.value.stories]) {
    const found = pattern.exec(item.id)
    if (found) max = Math.max(max, Number(found[1]))
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`
}

function emitChange(): void {
  emit('change', clone(local.value))
}

function addScene(): void {
  local.value.scenes.push({ id: nextId('SCENE'), title: `新场景${scenes.value.length + 1}`, description: '', position: local.value.scenes.length })
  emitChange()
}

function removeScene(id: string): void {
  local.value.scenes = local.value.scenes.filter(scene => scene.id !== id)
  emitChange()
}

function addEpic(): void {
  const epic: OutlineEpic = {
    id: nextId('EPIC'),
    title: `新 Epic${epics.value.length + 1}`,
    goal: '',
    priority: 'P1',
    sceneId: sceneOptions.value[0]?.id ?? null,
    position: local.value.epics.length
  }
  local.value.epics.push(epic)
  emitChange()
}

function removeEpic(id: string): void {
  local.value.epics = local.value.epics.filter(epic => epic.id !== id)
  local.value.stories = local.value.stories.map(story => (story.epicId === id ? { ...story, epicId: null } : story))
  emitChange()
}

function addStory(epicId?: string): void {
  const story: OutlineStory = {
    id: nextId('STORY'),
    epicId: epicId ?? epics.value[0]?.id ?? null,
    title: `新 Story${stories.value.length + 1}`,
    description: '',
    acceptance: [],
    priority: 'P1',
    position: local.value.stories.length
  }
  local.value.stories.push(story)
  emitChange()
}

function removeStory(id: string): void {
  local.value.stories = local.value.stories.filter(story => story.id !== id)
  emitChange()
}

function setAcceptance(story: OutlineStory, value: string): void {
  story.acceptance = String(value)
    .split('\n')
    .map(line => line.replace(/^\s*(?:[-*+]|\d+\.)\s*/, '').trim())
    .filter(Boolean)
  emitChange()
}
</script>

<style scoped>
.outline-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: var(--rg-text);
}
.outline-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.outline-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.outline-title strong {
  font-size: 12.5px;
  color: var(--rg-text);
}
.outline-count {
  font-size: 10.5px;
  color: var(--rg-text-2);
}
.outline-hint {
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.outline-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.btn {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 7px;
  padding: 4px 9px;
  font-size: 11.5px;
  cursor: pointer;
}
.btn:hover:not(:disabled) {
  border-color: var(--rg-text-3);
  background: var(--rg-hover);
  color: var(--rg-text);
}
.scene-card,
.epic-card,
.story-card {
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  border-radius: 9px;
  padding: 9px 11px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.epic-card {
  border-color: var(--rg-border-strong);
}
.story-card {
  background: var(--rg-surface-2);
  border-color: var(--rg-border);
}
.epic-card .story-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px dashed var(--rg-border);
  padding-top: 9px;
}
.row-head {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}
.id-chip {
  flex-shrink: 0;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 10px;
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
  border-radius: 5px;
  padding: 2px 6px;
}
.id-chip.story {
  color: var(--rg-accent);
  background: var(--rg-accent-soft);
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--rg-danger);
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  border-radius: 6px;
  flex-shrink: 0;
}
.icon-btn:hover {
  background: var(--rg-danger-soft);
}
.epic-meta,
.story-meta {
  display: grid;
  grid-template-columns: 1.6fr 0.6fr 1.2fr;
  gap: 8px;
}
.story-meta {
  grid-template-columns: 0.5fr 2fr;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 10.5px;
  color: var(--rg-text-2);
  min-width: 0;
}
.field.narrow {
  max-width: 120px;
}
.field :deep(.el-textarea) {
  width: 100%;
}
.epic-warning {
  margin: 0;
  border: 1px dashed var(--rg-warn-border);
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
  border-radius: 7px;
  padding: 5px 9px;
  font-size: 10.5px;
  line-height: 1.6;
}
.add-story {
  align-self: flex-start;
  border: 1px dashed var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-ai);
  border-radius: 7px;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
}
.add-story:hover {
  border-color: var(--rg-ai-border);
  background: var(--rg-ai-soft);
}
.orphan-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.empty {
  margin: 0;
  font-size: 11.5px;
  color: var(--rg-text-3);
  line-height: 1.7;
}
.readonly .outline-actions button,
.readonly .icon-btn,
.readonly .add-story {
  display: none;
}
@media (max-width: 1100px) {
  .epic-meta {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 768px) {
  .epic-meta,
  .story-meta {
    grid-template-columns: 1fr;
  }
  .field.narrow {
    max-width: none;
  }
  .btn {
    min-height: 30px;
  }
  .icon-btn {
    width: 30px;
    height: 30px;
  }
}
</style>
