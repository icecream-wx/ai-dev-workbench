<template>
  <div class="coverage-panel">
    <header class="cov-head">
      <div class="cov-title">
        <h2>需求覆盖</h2>
        <span class="cov-sub">
          {{ coverage.stats.sceneCount }} 场景 · {{ coverage.stats.epicCount }} Epics · {{ coverage.stats.storyCount }} Stories ·
          已覆盖 {{ coverage.stats.coveredStoryCount }}/{{ coverage.stats.storyCount }}
        </span>
        <span v-if="coverage.structure === 'fallback'" class="fallback-chip">fallback：无 Epic</span>
        <span v-else class="prd-chip">PRD 结构</span>
      </div>
      <span class="cov-input">需求输入 v{{ coverage.docVersion ?? '—' }}</span>
    </header>

    <p class="cov-tip">
      覆盖只做提示，不阻塞设计确认；纯后端 Story 可以只有实体、没有页面。
    </p>

    <div v-if="!coverage.inputId" class="cov-empty">还没有设计输入。确认需求后进入设计阶段会自动生成本快照。</div>

    <template v-else>
      <section v-if="coverage.scenes.length" class="cov-group">
        <h3>场景</h3>
        <div v-for="scene in coverage.scenes" :key="scene.id" class="cov-row scene">
          <span class="id-chip">{{ scene.id }}</span>
          <span class="cov-name">{{ scene.title }}</span>
          <span :class="['cov-badge', scene.covered ? 'ok' : 'warn']">{{ scene.covered ? '已覆盖' : '未覆盖' }}</span>
          <span class="cov-links">{{ linkText(scene) }}</span>
        </div>
      </section>

      <section v-if="coverage.epics.length" class="cov-group">
        <h3>Epics / Stories</h3>
        <div v-for="epic in coverage.epics" :key="epic.id" class="cov-epic">
          <div class="cov-row epic">
            <span class="id-chip">{{ epic.id }}</span>
            <span class="cov-name">{{ epic.title }}</span>
            <span :class="['cov-badge', epic.covered ? 'ok' : 'warn']">{{ epic.covered ? '已覆盖' : '未覆盖' }}</span>
            <span class="cov-links">{{ linkText(epic) }}</span>
          </div>
          <div v-for="story in storiesOf(epic.id)" :key="story.id" class="cov-row story">
            <span class="id-chip story">{{ story.id }}</span>
            <span class="cov-name">{{ story.title }}</span>
            <span :class="['cov-badge', story.covered ? 'ok' : 'warn']">{{ story.covered ? '已覆盖' : '未覆盖' }}</span>
            <span class="cov-links">{{ linkText(story) }}</span>
          </div>
        </div>
      </section>

      <section v-if="orphanStories.length" class="cov-group">
        <h3>未归属 Epic 的 Stories</h3>
        <div v-for="story in orphanStories" :key="story.id" class="cov-row story">
          <span class="id-chip story">{{ story.id }}</span>
          <span class="cov-name">{{ story.title }}</span>
          <span :class="['cov-badge', story.covered ? 'ok' : 'warn']">{{ story.covered ? '已覆盖' : '未覆盖' }}</span>
          <span class="cov-links">{{ linkText(story) }}</span>
        </div>
      </section>

      <section class="cov-group">
        <h3>无需求依据</h3>
        <div v-if="!coverage.unlinkedEntities.length && !coverage.unlinkedPages.length" class="cov-ok">
          所有实体/页面都带 requirementRefs。
        </div>
        <div v-for="entity in coverage.unlinkedEntities" :key="entity.id" class="cov-row unlinked">
          <span class="kind-chip entity">实体</span>
          <button type="button" class="cov-name link" @click="jump('entity', entity.id)">{{ entity.name }}</button>
          <span class="cov-note">requirementRefs 为空</span>
        </div>
        <div v-for="page in coverage.unlinkedPages" :key="page.id" class="cov-row unlinked">
          <span class="kind-chip page">页面</span>
          <button type="button" class="cov-name link" @click="jump('page', page.id)">{{ page.title }}</button>
          <span class="cov-note">requirementRefs 为空</span>
        </div>
      </section>

      <section v-if="coverage.warnings.length" class="cov-group">
        <h3>覆盖提示（{{ coverage.warnings.length }}）</h3>
        <ul class="cov-warnings">
          <li v-for="(warning, index) in coverage.warnings.slice(0, 40)" :key="index">{{ warning }}</li>
        </ul>
        <p v-if="coverage.warnings.length > 40" class="cov-note">还有 {{ coverage.warnings.length - 40 }} 条…</p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DesignCoverageItem, DesignProjectPayload } from './types'

const props = defineProps<{ project: DesignProjectPayload }>()
const emit = defineEmits<{ jump: [{ kind: 'entity' | 'page'; id: string }] }>()

const coverage = computed(() => props.project.coverage)
const orphanStories = computed(() => coverage.value.stories.filter(story => !story.parentId))

const entityName = computed(() => new Map(props.project.entities.map(entity => [entity.id, entity.name])))
const pageTitle = computed(() => {
  const map = new Map<string, string>()
  for (const set of props.project.pageSets) for (const page of set.pages) map.set(page.id, page.title)
  return map
})

function storiesOf(epicId: string): DesignCoverageItem[] {
  return coverage.value.stories.filter(story => story.parentId === epicId)
}

function linkText(item: DesignCoverageItem): string {
  const entities = item.entityIds.map(id => entityName.value.get(id) ?? id)
  const pages = item.pageIds.map(id => pageTitle.value.get(id) ?? id)
  const parts: string[] = []
  if (entities.length) parts.push(`实体：${entities.join('、')}`)
  if (pages.length) parts.push(`页面：${pages.join('、')}`)
  return parts.join('；') || '—'
}

function jump(kind: 'entity' | 'page', id: string): void {
  emit('jump', { kind, id })
}
</script>

<style scoped>
.coverage-panel {
  height: 100%;
  overflow-y: auto;
  padding: 16px 18px 48px;
  background: var(--rg-bg);
  color: var(--rg-text);
}
.cov-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.cov-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.cov-title h2 {
  margin: 0;
  font-size: 14px;
  color: var(--rg-text);
}
.cov-sub,
.cov-input {
  font-size: 11px;
  color: var(--rg-text-3);
}
.prd-chip,
.fallback-chip {
  font-size: 10px;
  border-radius: 999px;
  padding: 1px 7px;
}
.prd-chip {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.fallback-chip {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.cov-tip {
  margin: 0 0 14px;
  font-size: 11px;
  color: var(--rg-text-3);
}
.cov-empty {
  border: 1px dashed var(--rg-border-strong);
  border-radius: 10px;
  padding: 18px;
  font-size: 12px;
  color: var(--rg-text-3);
  text-align: center;
}
.cov-group {
  margin-bottom: 16px;
}
.cov-group h3 {
  margin: 0 0 7px;
  font-size: 12px;
  color: var(--rg-text-2);
}
.cov-epic {
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  border-radius: 10px;
  padding: 8px 10px;
  margin-bottom: 8px;
}
.cov-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 26px;
  font-size: 11.5px;
  color: var(--rg-text-2);
  border-bottom: 1px dashed var(--rg-border);
  padding: 2px 0;
  flex-wrap: wrap;
}
.cov-row:last-child {
  border-bottom: none;
}
.cov-row.epic {
  font-weight: 600;
  color: var(--rg-text);
}
.cov-row.story {
  padding-left: 14px;
}
.id-chip {
  flex-shrink: 0;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 9.5px;
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
  border-radius: 5px;
  padding: 1px 5px;
}
.id-chip.story {
  color: var(--rg-accent);
  background: var(--rg-accent-soft);
}
.cov-name {
  min-width: 120px;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cov-name.link {
  border: none;
  background: transparent;
  padding: 0;
  color: var(--rg-ai);
  cursor: pointer;
  text-align: left;
  font: inherit;
}
.cov-name.link:hover {
  text-decoration: underline;
}
.cov-badge {
  flex-shrink: 0;
  font-size: 9.5px;
  border-radius: 999px;
  padding: 1px 6px;
}
.cov-badge.ok {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.cov-badge.warn {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.cov-links {
  flex: 1;
  min-width: 0;
  color: var(--rg-text-3);
  font-size: 10.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cov-ok {
  font-size: 11.5px;
  color: var(--rg-ok);
  background: var(--rg-ok-soft);
  border: 1px solid var(--rg-ok-border);
  border-radius: 9px;
  padding: 8px 11px;
}
.kind-chip {
  flex-shrink: 0;
  font-size: 9.5px;
  border-radius: 5px;
  padding: 1px 5px;
}
.kind-chip.entity {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.kind-chip.page {
  background: var(--rg-accent-soft);
  color: var(--rg-accent);
}
.cov-note {
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.cov-warnings {
  margin: 0;
  padding-left: 18px;
  font-size: 11px;
  color: var(--rg-warn);
  line-height: 1.8;
}

@media (max-width: 768px) {
  .coverage-panel {
    padding: 12px 12px 36px;
  }
  .cov-name {
    min-width: 0;
    max-width: none;
    white-space: normal;
    word-break: break-word;
  }
  .cov-links {
    flex-basis: 100%;
    white-space: normal;
  }
  .cov-row.story {
    padding-left: 8px;
  }
  .cov-name.link {
    min-height: 28px;
  }
}
</style>
