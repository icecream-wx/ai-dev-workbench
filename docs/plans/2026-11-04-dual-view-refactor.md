# 双视角重构（需求视角 / 设计视角）实施计划 P1

> **For Claude:** 按任务顺序逐个执行；每完成一个任务运行 typecheck 验证。本目录不是 git 仓库，跳过 commit 步骤。

**Goal:** 把工作台重构为「需求视角（只谈场景与需求点）+ 设计视角（需求点→规格分解，多对多映射 + 图表）」双视角结构。

**Architecture:** 本期为"虚拟规格池"方案——规格数据仍存于各需求点 Spec（module_docs.spec，零迁移、codegen 不破坏），在其上派生「需求点↔规格」映射视图；需求视角新增需求点卡片（业务语言），AI 协议新增 `card` 字段；设计视角新增「规格」页签（分组列表 + 覆盖率 + 引用反查）与「图谱」（X6 复用）。存储统一化（规格迁出模块）放到 P2，等交互验证后再做。

**Tech Stack:** Vue 3.5 + Pinia（setup store）+ Element Plus + @antv/x6 + better-sqlite3（app_settings KV）。

**全局约束：**
- 不引入新依赖；不迁移存量数据（旧 Spec 原位保留，作为 V1 规格池的数据源）
- 每个任务结束跑 `npm run typecheck`（frontend）/ `npm run build`（backend）
- 项目无 git，跳过 commit 步骤；每个文件改完在尾部更新 `Modified by AI` 标记（仓库惯例）

---

## Task 1: 类型层——需求点卡片 PointCard

**Files:**
- Modify: `frontend/src/requirements-grooming/spec/types.ts`

**Step 1:** 在 `SpecMeta` 前新增类型（放在 SpecNfr 之后、SpecOpenIssue 之前）：

```ts
/** 需求点生命周期：draft 草稿（业务讨论中）/ confirmed 需求已确认（可进设计分解）/ review 设计侧反向修改，待复核 */
export type PointStatus = 'draft' | 'confirmed' | 'review'

/** 需求视角的需求点卡片：纯业务语言，是设计视角分解的唯一业务事实源 */
export interface PointCard {
  status: PointStatus
  /** 业务目标：这个需求点要达成什么 */
  goal?: string
  /** 参与角色（业务语言，如 员工/部门主管/HR 专员） */
  actors?: string[]
  /** 核心业务规则（自然语言描述，设计视角负责形式化为 expression） */
  businessRules?: string[]
  /** 验收要点（业务语言） */
  acceptance?: string[]
  priority?: SpecPriority
}
```

**Step 2:** `ModuleMeta` 增加字段：

```ts
  /** 需求视角卡片：目标/角色/业务规则/验收要点/优先级/状态 */
  card?: PointCard
```

`WorkspaceModuleExport` 增加同名字段 `card?: PointCard`。

**Step 3:** `npm run typecheck` → PASS。

## Task 2: 后端——/workspace 载荷透传 card

**Files:**
- Modify: `backend/src/routes.ts:42-95`（GET/PUT /workspace）

**Step 1:** `GET /workspace` 的 modules map 中追加：

```ts
      const card = readSetting<unknown>(`moduleCard.${r.id}`) ?? undefined
      return { id: r.id, ..., sceneId: sceneId ?? undefined, card }
```

**Step 2:** `PUT /workspace` 循环内、moduleScene 写入旁追加：

```ts
      if (raw.card && typeof raw.card === 'object') {
        writeSetting(`moduleCard.${mod.id}`, (raw as { card?: unknown }).card)
      }
```

**Step 3:** `npm run build`（backend）→ PASS。

## Task 2b: 前端类型接线

**Files:**
- Modify: `frontend/src/requirements-grooming/spec/types.ts`（ModuleMeta 加 `card?: PointCard`）
- Modify: `frontend/src/requirements-grooming/workspace/store.ts`

**Step 1:** `ModuleMeta` 增加 `card?: PointCard`；`WorkspaceModuleExport` 增加 `card?: PointCard`；`createEmptyCard()` 导出（`{ status: 'draft' }`）。
**Step 2:** workspace store：`createModule` 种子 `card: { status: 'draft' }`；`exportWorkspace`/`importWorkspace` 透传 `card`；新增动作：

```ts
  /** 更新需求点卡片（AI card 补丁 / 手工编辑共用）；返回是否生效 */
  function updatePointCard(id: string, patch: Partial<PointCard>): boolean {
    const mod = modules.value.find(m => m.id === id)
    if (!mod) return false
    const base: PointCard = mod.card ?? { status: 'draft' }
    mod.card = { ...base, ...patch }
    return true
  }
  function confirmPoint(id: string): void { ... card.status = 'confirmed' ... }
  function sendPointToReview(id: string): void { ... status 'review' ... }
```

返回对象导出新函数。typecheck ✓。

## Task 3: 协议与校验——envelope 新增 `card`

**Files:**
- Modify: `frontend/src/requirements-grooming/conversation/protocol.ts`（ReplyEnvelope 加 `card?: ReplyCardPatch`，interface：goal/actors/businessRules/acceptance/priority/status 可选）
- Modify: `frontend/src/requirements-grooming/spec/schema.ts`（replyEnvelopeSchema 加 card：object，priority enum ['P0','P1','P2','P3']，status enum ['draft','confirmed','review']，其余 string/array of string）
- Modify: `frontend/src/requirements-grooming/conversation/store.ts`（runTurn 中 envelope.card 非空时 `workspaceStore.updatePointCard(targetModuleId, envelope.card)` + notice「已更新需求点卡片：…列出变更字段名」）

typecheck ✓。

## Task 4: 需求视角提示词重写（conversation/prompt.ts）

**Files:** Modify `conversation/prompt.ts`

要点：
- 开场白改为：**需求视角**——只讨论业务：场景与需求点（目标/角色/业务规则(自然语言)/验收要点/优先级），**禁止产出实体/页面/字段/服务/触发器等任何形式化规格**（那是设计视角的职责，用户在设计视图的分解对话中完成）
- 输出协议：`card` 字段（更新当前需求点卡片，字段全量替换语义）；`patch` 保留在协议中但**需求视角下必须省略**；newScenes/newModules/openIssues/actions 语义保留；划分确认门禁保留（已实现）
- STAGE_INSTRUCTIONS 重写为卡片流：采集=问目标/角色/规则/验收 → 澄清=补卡 → 确认=用户明确确认后 card.status='confirmed'（仅用户明确说确认时才可置）→ 完成后引导"到设计视图分解"

## Task 5: 会话 store 落 card 补丁（conversation/store.ts runTurn）

- envelope.card 存在时：`workspaceStore.updatePointCard(targetModuleId, envelope.card)`，push notice 列出变更字段
- buildSceneContext 的场景行文案不变（card 状态附加：`（需求已确认）`/`（设计分解中）`）

## Task 6: 需求点卡片文档（RequirementsView 重构）

**Files:**
- Create: `frontend/src/requirements-grooming/ui/doc/PointCardSection.vue`
- Modify: `frontend/src/requirements-grooming/ui/views/RequirementsView.vue`

PointCardSection（按 moduleId）：
- 头部：点编号/名称/编码 + 状态标签（草稿/已确认/待复核）+ 确认/复核按钮（ws.updatePointCard）
- 字段块：业务目标（textarea 就地编辑，失焦保存 updatePointCard）、参与角色（el-tag 动态增删）、核心业务规则（列表增删）、验收要点（列表增删）
- 覆盖率摘要：该点 spec 的实体/页面/规则/流程计数 + 「去设计视图分解」按钮（ui.goTo('design')）

RequirementsView：
- 删除按模板章节渲染 spec 分区的整段（Task 上一轮的 visibleSections 机制弃用），替换为：`<PointCardSection :module-id="active.id" />`
- 章节号/模板依赖（template.sections、DocMetaSection、EntitySection 等 import）随之移除；纯文档模式入口暂时保留渲染 markdown（P2 重排）
- 空态提示保留

typecheck ✓（此步是最易碎的一步：确认所有被移除引用都有替代或删除）

## Task 6: 设计视角「规格」页签（虚拟池：按点聚合展示）

**Files:**
- Create: `frontend/src/requirements-grooming/ui/design/SpecPoolPanel.vue`
- Modify: `frontend/src/requirements-grooming/ui/views/DesignView.vue`（TABS 加 `{ key: 'specs', label: '规格' }`，新增 pane）

SpecPoolPanel（props: moduleId）：
- 顶部：需求点卡片摘要（目标/角色/规则，只读）+ 覆盖率（复用 specStore.confirmRateOf）+ 需求状态徽标（未确认来源时显示「来源未确认」警示）
- 分组列表：直接复用现有 panels（EntitySection/RoleSection/PermissionSection/FlowSection/PageSection/RuleSection/DictSection/IntegrationSection/ServiceSection/FrontFunctionSection/NfrSection，全部传 module-id）
- 引用反查：每组条目行尾增加「被引用」徽标——扫描其他需求点 spec 中 `pointId:<本点id>:` 前缀引用该条目的计数（工具函数 `spec/refs.ts` 新增 `listPointRefs(moduleId): Map<section, Set<targetModuleId>>`）

## Task 7: 需求点↔规格图谱（X6，P1 尾）

- Create: `frontend/src/requirements-grooming/ui/design/PointSpecGraph.vue`
- 复用 `EntityRelationGraph.vue` 的 X6 用法：中心节点=需求点，二级节点=规格项（按 type 着色），虚线边=其他需求点对同一规格的引用；节点点击 → ui.goTo 定位（实体→ER、页面→原型）
- 数据源与 Task 6 相同（specOf(point) 分组）

## Task 8: 设计视角分解对话（独立线程，P2，本次会话暂缓）

- 新 store `useDesignChatStore`（按 moduleId 存取 messagesKey/stageKey——正好复用旧模块级会话槽位，后端零改动）；系统提示词=分解模式：输入卡片+当前 Spec，输出 envelope.patch（现有 applyReply(moduleId) 全复用）；禁用 newScenes/newModules
- 新组件 `ui/design/DesignChatPanel.vue`（复用 ChatPanel 骨架，右侧停靠）
- ⚠️ 依赖 Task 1-7 完成后单独执行

## 验证口径

- 每个 Task 后：`npm run typecheck`（frontend）、Task 2 后加 `npm run build`（backend）
- 手工验收路径：新建需求点 → 需求视图只出现卡片 → 对话只产出卡片内容 → 确认 → 设计视图「规格」页签出现该点分组列表 → 图谱可见引用反查
