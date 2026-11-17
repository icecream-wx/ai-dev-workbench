# I-09b-1（U6）交接包规模识别 + 04-PLAN 建议分阶段 实施交接单

日期：2026-11-12
用途：**新开实施会话**使用；主会话负责设计/评审。
状态：**已完成（2026-11-12，实施会话；主会话待评审）**。
上游：`docs/plans/2026-11-09-stage-ux-and-dev-session-design.md` §4.3.2/§4.3.3、`docs/STATUS.md`「I-09a 评审」「视觉 V3 评审」。
范围：**只做 U6**——确定性规模识别 + `04-PLAN.md` 建议分阶段 + `00-README.md` 提示 + 交接包弹窗/开发页提示。**不做 U7**（阶段模型、一阶段一会话、phase brief、阶段状态/表）；不改 Change Set/需求/设计/版本语义；不调模型。

---

## 1. 已确认决策（2026-11-12）

| # | 决策 | 结论 |
| --- | --- | --- |
| 1 | 本轮范围 | 只做 U6；U7 仅预设计，暂不实施。 |
| 2 | 默认模式 | 继续单会话 + 原生 compact；分阶段只是**建议**，不强制、不做门禁。 |
| 3 | 触发口径 | `Story >= 10` 或 `页面 >= 12` 或 `交接包文本 >= 100KB`（102400 bytes），任一命中。 |
| 4 | 规模来源 | 从 `DesignHandoffBundle` 确定性计算，不调用模型；`preview` 与 `generate` 同一套。 |
| 5 | 展示 | `manifest.json` 记录 `scale`；`04-PLAN.md` 增加建议章节；`00-README.md` 提示；弹窗/开发页显示规模与入口。 |
| 6 | U7 倾向（仅预设计） | 按 Epic 派生阶段 + 新表 `app_dev_phases` + 会话阶段标签；等真实大交接包数据后再定稿。 |

**命名纠偏**：交接包实际文件是 `04-PLAN.md`（不是旧文档里的 `03-PLAN`）；需求结构是 Scene/Epic/Story（不是旧 `FEAT`）。

---

## 2. 规模口径

### 2.1 统计字段

从 bundle 计算：

```ts
counts: {
  scenes, epics, stories,
  entities, fields, relations,
  pageSets, pages, prototypes
}
```

- `fields` = 所有实体字段数之和；`relations` = 所有实体关系数之和。
- `prototypes` = 有 `prototypePath` 的页面数（缺图在生成前已被校验阻塞）。
- `textBytes` = `00-README.md`、`01-REQUIREMENTS.md`、`02-DATA-MODEL.md`、`03-PAGES.md`、`04-PLAN.md`、`05-CHANGES.md`、`schema.sql`、`prototype-template.json` 的 UTF-8 字节和。
- **不包含** `manifest.json`、PNG、HTML；**不包含**“建议分阶段开发”章节自身（用建议章节渲染前的文本测量，避免循环）。
- `textBytes` 用 bytes 不是字符数；中文按 UTF-8 计。

### 2.2 阈值

集中常量（导出以便单测）：

```ts
export const HANDOFF_SCALE_THRESHOLDS = {
  stories: 10,
  pages: 12,
  textBytes: 102400
} as const
```

命中项用结构化数组表示，便于 UI/测试，不用中文原因字符串：

```ts
triggers: Array<{
  metric: 'stories' | 'pages' | 'textBytes'
  value: number
  threshold: number
}>
```

`level = triggers.length ? 'large' : 'normal'`；`suggested = triggers.length > 0`。

### 2.3 返回结构

```ts
export interface DesignHandoffScale {
  level: 'normal' | 'large'
  suggested: boolean
  counts: DesignHandoffScaleCounts
  textBytes: number
  thresholds: { stories: number; pages: number; textBytes: number }
  triggers: DesignHandoffScaleTrigger[]
  phaseCount: number
  derivedFrom: 'epics' | 'pageSets' | 'none'
}
```

- `normal` 时 `phaseCount = 0`、`derivedFrom = 'none'`（不派生）。
- `large` 时 `phaseCount` = 草案阶段数（含“数据模型与基础框架”）。
- `scale` 写入 `manifest.json`；`DesignHandoffMeta`/preview 结果暴露同一对象，避免前端从 manifest 里猜类型。

---

## 3. 后端实现

### 3.1 新文件 `backend/src/handoff/design-scale.ts`（纯函数，无 IO）

```ts
export const HANDOFF_SCALE_THRESHOLDS = { stories: 10, pages: 12, textBytes: 102400 } as const

export interface DesignHandoffPhaseDraft {
  kind: 'base' | 'epic' | 'other' | 'pageSets' | 'all'
  title: string
  goal: string
  storyIds: string[]
  pageSetCodes: string[]
  pageCodes: string[]
  note?: string
}

export function assessHandoffScale(
  bundle: DesignHandoffBundle,
  textBytes: number
): { scale: DesignHandoffScale; phases: DesignHandoffPhaseDraft[] }
```

派生规则（确定性、按 bundle 顺序，不排序、不随机）：

1. 固定第一阶段 `数据模型与基础框架`：目标“建表/调整实体，打通 App Shell、导航与公共组件”；范围指向 `02-DATA-MODEL.md` / `schema.sql` / 应用壳。
2. 有 Epic：每个 Epic 一个阶段，按 `bundle.requirements.input.epics` 顺序：
   - 标题 `EPIC-001 标题`；目标取 `epic.goal || epic.title`；
   - `storyIds` 取该 Epic 的 Story；
   - `pageSetCodes/pageCodes` 取 `epicId === epic.id` 的页面集/页面；
   - 无页面集时 `note = '无页面集；按 Story 实现接口/后端能力'`。
3. 有未归属 Epic 的页面集：追加 `其他页面与收尾`，列出这些页面集；`storyIds` 取这些页面集的 `storyIds` 去重。
4. 无 Epic：
   - 有页面集：按顺序每 2—3 个页面集一组，标题用首个页面集 `PS-001 标题`（多个时加“等 N 个页面集”）；
   - 无页面集：只给 `全量实现` 阶段，`storyIds` 取全部 Story。
5. 不拆分单个 Epic（即使很大）；在章节说明里提示“如单个阶段过大，可人工拆分为多个会话”。
6. 阶段标题只用 `EPIC-xxx / STORY-xxx / PS-xxx / PAGE-xxx` 等外部稳定编号，**不得出现工作台内部 ID（UUID / `ps-` / `page-` 内部 id）**。

### 3.2 渲染 `backend/src/handoff/design-render.ts`

- `renderDesignHandoffText(bundle, scale?, phases?)`：
  - `renderPlan(bundle, scale, phases)`；
  - `renderReadme(bundle, scale)`；
  - 其余文件不变。
- `04-PLAN.md` 命中时在 `## 1. 建议顺序` **之前**插入 `## 0. 建议分阶段开发（可选）`，避免重排现有 1—6 节：
  - 第一段：规模与命中项，如“规模：12 Story / 14 页面 / 123 KB（Story ≥10、页面 ≥12）”。
  - 明确“只是建议，不强制、不做门禁；可以继续单会话完成”。
  - 每个阶段：`### 阶段 N · 标题`、目标、Story、页面集/页面、完成标准；Epic 阶段给“建议会话标题”。
  - 最后“使用方式”：每阶段可新建/继续会话；进入下一阶段时把上一阶段总结带到首条提示；全部完成后再“确认完成开发”。
  - 未命中：**完全不输出**该章节，现有 `04-PLAN.md` 内容保持不变。
- `00-README.md` 命中时在“阅读顺序”后增加一句：
  `本交接包较大（N Story / M 页面 / X KB），建议按 04-PLAN.md 的《建议分阶段开发》推进；也可单会话完成。`
- `renderManifest(bundle, files, scale)` 增加：
  ```json
  "scale": { "level": "...", "suggested": true, "counts": {...}, "textBytes": 123456,
             "thresholds": {...}, "triggers": [...], "phaseCount": 4, "derivedFrom": "epics" }
  ```
- 保持确定性：相同 bundle 两次渲染内容一致；阶段顺序稳定。

### 3.3 `backend/src/handoff/design-service.ts`

- `renderHandoff()` 改两遍渲染：
  1. `const measure = renderDesignHandoffText(bundle)`；`textBytes = sum(Buffer.byteLength(content,'utf8'))`；
  2. `const { scale, phases } = assessHandoffScale(bundle, textBytes)`；
  3. 若 `scale.suggested`，`texts = renderDesignHandoffText(bundle, scale, phases)`；否则复用 `measure`；
  4. `renderManifest(bundle, metas, scale)`；`RenderedHandoff` 增加 `scale`。
- `previewDesignHandoff` 返回增加 `scale`（不写盘）。
- `generateDesignHandoff` 的 meta/`handoff` 增加 `scale`；`design_handoffs.manifest_json` 已保存 manifest（含 scale），**不加列/不建表**。
- `readDesignHandoff` 从 `manifest_json.scale` 解析并放入 `handoff.scale`；旧交接包没有该字段时返回 `scale: null`（前端隐藏提示，不报错）。
- `designHandoffSummary` 保持原字段不变（避免影响 app payload/旧调用方）；开发页通过 `GET /design/handoff` 取 meta。

### 3.4 类型

`backend/src/handoff/design-types.ts` 增加：

- `DesignHandoffScaleCounts/Trigger/Scale`；
- `DesignHandoffMeta.scale: DesignHandoffScale | null`；
- preview/generate 结果类型补 `scale`（若结果类型在 service 内联，保持同一形状）。

**不新增 API 路由**；`GET /api/apps/:id/design/handoff`、`preview`、`generate` 形状只增字段，属向后兼容。

---

## 4. 前端实现

### 4.1 纯逻辑 `frontend/src/design/handoff-scale.js` + `.test.mjs`

建议导出：

- `scaleCountsLabel(scale)` → `12 Story / 14 页面 / 123 KB`（KB 向上取整；缺字段回退）。
- `scaleTriggerLabels(scale)` → `['Story ≥ 10', '页面 ≥ 12']`（按 triggers 生成，未知 metric 忽略）。
- `scaleBadge(scale)` → `{ label: '建议分阶段', tone: 'warn' } | null`（`suggested=false/null` 返回 null）。
- `scaleHint(scale)` → `交接包较大：...；建议按 04-PLAN.md 分阶段推进，也可单会话完成。`（normal 返回空串）。

单测覆盖：normal、large、仅 text 触发、缺 counts/旧数据 null、KB 格式边界。

### 4.2 `DesignHandoffDialog.vue`

- `DesignHandoffMeta`/`DesignHandoffPreviewResult` 类型补 `scale?: DesignHandoffScale | null`。
- 在 meta/工具栏下方增加一行规模信息（`meta?.scale` 或预览 `previewScale`）：
  - `规模：12 Story / 14 页面 / 123 KB`
  - `suggested` 时加 chip `建议分阶段` + 提示“查看 04-PLAN.md 的分阶段建议”。
  - normal 时只显示规模，不加 chip/警示。
  - 旧交接包 `scale=null`：整行不显示。
- 预览模式也显示（来自 preview 结果）；预览不写盘，提示“生成后可查看 04-PLAN.md”。
- 样式复用现有 token（`--rg-warn-*`/`--rg-surface-*`），深浅色/窄屏不溢出。

### 4.3 `DevView.vue`

- `handoffMeta` 本地类型补 `scale?: DesignHandoffScale | null`（`getDesignHandoff` 返回）。
- 右侧“交接文档”区：`handoffMeta.scale?.suggested` 时显示一行提示 + 按钮“查看 04-PLAN.md”（复用 `openHandoff('04-PLAN.md')`），并显示 `scaleCountsLabel`。
- normal/旧交接包不显示；不新增顶部按钮、不改 Composer/首条提示/会话行为。
- 1024/768 抽屉内不溢出；深浅色对比度正常。

---

## 5. 测试与验证

### 5.1 后端

新增 `backend/src/handoff/design-scale.test.ts`，并加入 `backend/package.json` 的 `test` 列表：

1. 边界：9 Story / 11 页面 / 99KB → normal，无 triggers；10 Story、12 页面、102400 bytes 分别命中对应 trigger。
2. counts：fields/relations/prototypes 汇总正确。
3. 派生：base + 每 Epic 一阶段 + 未归属页面集进“其他页面与收尾”；无 Epic 按页面集 2—3 个分组；无 Epic/无页面集为“全量实现”。
4. 确定性：同一 bundle 两次 `deepEqual`；阶段顺序稳定。
5. 不出现内部 ID（UUID/`ps-`/`page-` 内部 id）。

`design-handoff.test.ts` 扩展：

- 小交接包：`04-PLAN.md` 无“建议分阶段开发”，`00-README.md` 无“本交接包较大”，`manifest.scale.suggested=false`。
- 大交接包（至少 10 Story / 12 页面）：`04-PLAN.md` 含章节、阶段标题、STORY/PS/PAGE 编号；README 提示；`manifest.scale` 计数/triggers/phaseCount 正确。
- `previewDesignHandoff` 返回 `scale` 且不写盘；`generateDesignHandoff`/`readDesignHandoff` 的 meta `scale` 一致；旧 manifest 无 scale → `null`。
- 不泄露内部 ID/凭据；`05-CHANGES` 不受影响。

命令：

- `npm run build --prefix backend`
- `npm test --prefix backend`
- `npm run smoke:design-handoff --prefix backend`（断言 `manifest.scale` 存在；normal 路径不出现建议章节）
- 回归：`smoke:change-set` / `smoke:design` / `smoke:handoff-input` / `smoke:requirements`
- 可选：真实 opencode 开发会话不涉及本项，不必重跑 `smoke:dev*`；若改动 `dev` 类型则跑 `smoke:dev-sessions`。

### 5.2 前端

- `npm test --prefix frontend`（新增 `handoff-scale.test.mjs`）
- `npm run typecheck --prefix frontend`
- `npm run build --prefix frontend`
- `node check-vue-imports.cjs`
- Playwright（API 预置或路由注入，不依赖模型）：
  - 打开设计交接包弹窗：normal 只显示规模；large 显示 chip + 提示；
  - 预览模式显示 scale；
  - 开发页右侧显示“建议分阶段 + 查看 04-PLAN.md”，点击打开 `04-PLAN.md`；
  - 浅/深 × 1440/768 无白底、无横向溢出；0 console error / 0 意外 API >=400。

---

## 6. 不做 / 边界

- **不做 U7**：不建 `app_dev_phases`、不改 `app_sessions`、不加 `phaseKey`、不做阶段完成状态/阶段会话/phase brief。
- 不自动创建新会话、不自动发送提示、不自动 compact；不改首条提示。
- 不改 Change Set/需求/设计/交接包版本/`05-CHANGES` 语义；不新增 API 路由。
- 不新增/修改数据库表或列（manifest 已保存 JSON；旧行无 scale 返回 null）。
- 不调模型；不做 <768 移动端专项；不做视觉重构。
- 不读取/打印/提交真实密码；`projects/`、`data/`、`.env` 不提交。

---

## 7. 文档与回传

实施完成后：

- 更新本交接单 §8（实施结果、命令/结果、偏差、未验证）。
- 更新 `docs/STATUS.md`：「I-09b-1 完成」+ 摘要表 + 总状态 + 未验证；记录测试数变化。
- 更新 `docs/plans/2026-11-09-stage-ux-and-dev-session-design.md` §4.3.2 状态（U6 已实施；U7 仍未实施）。
- 更新 `docs/plans/2026-11-11-main-review-handoff.md`（下一步：U6 评审 → 视数据决定 U7）。
- 回传主会话：改动文件、命令/结果、未验证项、偏差、需决策问题。主会话独立验证后评审。

---

## 8. 实施结果（2026-11-12，已完成）

### 8.1 改动文件

后端：

- `backend/src/handoff/design-scale.ts`（新增：阈值、规模计数、阶段派生、文档标签辅助）
- `backend/src/handoff/design-scale.test.ts`（新增：7 项纯函数单测）
- `backend/src/handoff/design-types.ts`（`DesignHandoffScaleMetric/Trigger/Counts/Scale`；`DesignHandoffMeta.scale`）
- `backend/src/handoff/design-render.ts`（`renderPlan/renderReadme/renderManifest/renderDesignHandoffText` 增加 scale/phases；仅命中时插建议章节与 README 提示）
- `backend/src/handoff/design-service.ts`（两遍渲染；`RenderedHandoff.scale`；preview/generate/read 返回 scale；旧 manifest 无 scale → null）
- `backend/src/handoff/design-handoff.test.ts`（小包 normal 断言；大包 10 Story/12 页面全链路；旧 manifest → null）
- `backend/scripts/design-handoff-smoke.ts`（preview/generate/read 的 `scale` 与 normal 无建议章节断言）
- `backend/package.json`（test 列表加入 `design-scale.test.ts`）

前端：

- `frontend/src/design/handoff-scale.js`（新增：`scaleCountsLabel/scaleTriggerLabels/scaleBadge/scaleHint`）
- `frontend/src/design/handoff-scale.test.mjs`（新增：6 项）
- `frontend/src/design/api.ts`（scale 类型；meta/preview 可选 scale）
- `frontend/src/design/DesignHandoffDialog.vue`（规模行、chip/触发行、查看 04-PLAN、预览提示；normal/旧数据隐藏 chip/整行）
- `frontend/src/dev/DevView.vue`（右侧交接文档建议入口 + 查看 04-PLAN；normal/旧数据隐藏）
- `frontend/package.json`（test 列表加入 `handoff-scale.test.mjs`）

### 8.2 命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ |
| `npm test --prefix backend` | ✅ 122/122（基线 113；+9） |
| `npm run smoke:design-handoff --prefix backend` | ✅ |
| `npm run smoke:change-set --prefix backend` | ✅ |
| `npm run smoke:design --prefix backend` | ✅ |
| `npm run smoke:handoff-input --prefix backend` | ✅ |
| `npm run smoke:requirements --prefix backend` | ✅ |
| `npm test --prefix frontend` | ✅ 69/69（基线 63；+6） |
| `npm run typecheck --prefix frontend` | ✅ |
| `npm run build --prefix frontend` | ✅ |
| `npm run check:vue --prefix frontend` | ✅ |
| Playwright（API 预置，临时 SQLite/projects，端口 3441） | ✅ 9 张截图；0 console/page error、0 意外 API>=400、深色无白底、无横向溢出 |

Playwright 覆盖：大交接包 1440 浅/深、768 浅/深（开发页入口 → 04-PLAN 定位；弹窗规模行/chip/触发行）；预览模式规模行（不写盘提示 + 04-PLAN 建议章节）；小交接包 1440 浅/768 深（开发页无入口、弹窗只显示规模、04-PLAN 无建议章节）。截图：`C:\Users\icecream\AppData\Local\Temp\opencode\i09b1-e2e\shots`（01—09）。

### 8.3 偏差

- 无 Epic 时页面集分组取“每 3 个一组”（本单允许 2—3）。
- 未归属 Epic 的页面集 = `epicId=null` 或引用不存在 Epic 的页面集。
- `manifest.scale` 在 normal 也存在（本单 §2.3 预期）；04-PLAN/README 未命中时保持原内容。
- 前端 `scale` 类型可选、后端 read 旧数据返回 `null`，属向后兼容字段新增。
- **变更单场景未加 caveat（观察项，已补）**：`changeSet.seq > 1` 时 `04-PLAN.md` 建议章节现已在规模行后写明“以下阶段按全量交接包生成；实际开发范围以 `05-CHANGES.md` 的增量与影响为准，不要按阶段重写未变更部分”，`00-README` 规模提示追加“本次为变更 #N，增量范围以 `05-CHANGES.md` 为准”；seq=1 不出现。见 `docs/plans/2026-11-12-design-id-collision-fix-brief.md` §7。
- **评审发现的既有 P1（已修，2026-11-12）**：页面集/页面/实体 ID 跨应用冲突 + 先删后插未包事务已修复（raw id 仅在全局未被占用时保留，否则生成全局唯一 ID；`writeEntities`/`writePageSets` 及回滚/取消恢复写盘事务化）。见 `docs/STATUS.md`「设计 ID 跨应用冲突修复完成」与 `docs/plans/2026-11-12-design-id-collision-fix-brief.md`。

### 8.4 未验证

- 真实长需求产物形成的大交接包（本轮为合成 10 Story / 3 Epic / 12 页面）；未调用真实模型（U6 不调模型）。
- 旧交接包 `scale=null` 的前端隐藏仅单测 + 代码走查，未在 Playwright 注入旧 manifest。
- <768 移动端专项、真实长会话滚动/对比度（非本轮范围）。
