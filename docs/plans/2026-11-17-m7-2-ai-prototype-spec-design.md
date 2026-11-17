# M7-2（#8 v2）需求阶段 AI 参考原型 设计稿

日期：2026-11-17
状态：**待用户确认**（确认后派实施会话；本文不含代码改动）
关系：**取代 M7 的"纯骨架"呈现**（M7 的确定性 Epic→页面集派生保留，降级为"范围/覆盖度"信息）。M7 既有只读端点、零写库、模板解析、大纲树入口全部沿用。

上游：
- 用户 2026-11-17 反馈：骨架看不出实际意义、没有评审价值；应按需求阶段已确认的**实体/字段**生成；并明确 **需求阶段原型预览不作为设计阶段页面集来源**，只服务需求评审。
- 用户选择 **A 方案**：AI 从模块 PRD 生成"预览规格"，可重新生成；不写设计表。
- 只读核对 app1（2026-11-17，用户授权）：`app1`（订单管理系统，development）2 模块均已 confirmed；MOD-001 商品管理 v8（2 Epic/8 Story，`rules` 2.3KB 含「商品档案字段」「商品明细字段」两张字段表，`pages` 含页面清单）；MOD-002 订单管理 v5（2 Epic/5 Story，`rules` 以状态/规则为主、无完整字段表，`pages` 有 3 个页面描述）。→ 字段信息在 PRD 里**存在但形态不一**，确定性解析不可靠，AI 生成是正确选择。

---

## 0. 关键决策（本稿默认，用户确认即可实施）

| # | 决策 | 结论 |
| --- | --- | --- |
| 1 | 字段来源 | **AI 从模块 PRD 生成预览规格**（实体/字段/页面），存"预览专用"数据 |
| 2 | 与设计阶段关系 | **只读、单向**：不写设计项目/实体/页面集/页面/版本，不进交接包；设计阶段也不读预览规格 |
| 3 | 生成时机 | **显式按钮**（首次「生成原型参考」、之后「重新生成」），打开预览不自动调模型；结果缓存 |
| 4 | 存储 | **不新增表**：写 `app_settings` 键 `app.<appId>.requirementsPrototype.<moduleId>`（JSON） |
| 5 | 渲染 | **复用设计阶段渲染器** `PrototypeRenderer.vue` + `mockRows()`：真实字段 + 示例数据，列表/表单/详情/仪表盘等 |
| 6 | 导航 | 页面集 = Epic（沿用 M7）；AI 页面按 `epicId` 归属，无归属的进「其他页面」 |
| 7 | 过期 | 存 `base.docVersion/docUpdatedAt`；与当前不一致 → 顶部「需求已更新，建议重新生成」横幅（不阻塞、不自动重生成） |
| 8 | 覆盖度 | 保留 M7 的确定性统计：Story 总数 / 原型已覆盖 Story 数 / 未覆盖 Story，作为评审提示 |
| 9 | 模型 | 复用需求阶段 agent + 模型：`ensureAppAgents` → `opencode.ensureAgent(dir,'req')` → `resolveChatModel(appId,'requirements',dir)` → `generateText({agent:'req'})` |
| 10 | 失败 | 模型异常/不可解析/无页面 → **502** + `error` 文案，前端可重试；不写半成品 |

---

## 1. 目标与非目标

**目标**

1. 需求阶段按模块生成"有血有肉"的参考原型：实体、字段（含必填/枚举）、列表列、表单字段、详情分组、动作、示例数据。
2. 支撑需求评审：能否在 PRD 阶段就发现"少字段、字段类型不对、页面缺动作、Story 没落到页面"。
3. 与原型模板观感一致（#7 解析），确定性外壳 + AI 内容分离：模板/外壳/导航由代码控制，只有内容由 AI 产出。
4. 不污染设计产物：设计阶段仍按自己的实体/页面集生成，预览规格不参与。

**非目标**

- 不做预览规格的**手工编辑**（本批只支持重新生成；后续可加"微调/锁定字段"）。
- 不产 PNG、不写 `prototypes/`、不进交接包、不参与设计确认/覆盖度（设计侧）。
- 不改设计阶段（D-RMP）、交接包、Change Set、U7、阶段门禁。
- 不新增表/列/迁移；不做旧数据兼容（M7 一天前落地，直接替换呈现，无需迁移）。
- 不做多模块合并原型、不做移动端手机壳、不做交互跳转（`nav` 事件可 no-op）。

---

## 2. 数据模型：预览规格（Preview Spec）

存放在 `app_settings`，键 `app.<appId>.requirementsPrototype.<moduleId>`：

```jsonc
{
  "schema": "requirements-prototype/1",
  "generatedAt": "2026-11-17T02:10:00.000Z",
  "model": "packycode-deepseek/deepseek-flash",          // 实际使用的模型 id（可空）
  "base": { "docVersion": 8, "docUpdatedAt": "2026-11-17T01:00:00.000Z" },
  "entities": [
    {
      "id": "PE-1", "name": "商品档案", "description": "商品主数据",
      "fields": [
        { "name": "code", "label": "商品编码", "type": "string", "required": true, "unique": true, "note": "4—32 位" },
        { "name": "status", "label": "商品状态", "type": "enum", "required": true, "options": ["上架", "下架"] }
      ]
    }
  ],
  "pages": [
    {
      "id": "PP-1", "title": "商品列表", "type": "list",
      "epicId": "EPIC-001", "storyIds": ["STORY-001"],
      "entityId": "PE-1",
      "fields": ["code", "name", "status"],               // 页面用到的实体字段 name
      "actions": ["create", "edit", "delete"]
    }
  ],
  "notes": ["库存归属在商品档案还是明细待确认"],
  "stats": { "entities": 2, "fields": 22, "pages": 3 }
}
```

约束（服务端归一化后落库，见 §3.3）：`entities 1—30`、每实体 `fields 1—40`、`pages 1—80`、字符串长度上限、`type` 白名单、`epicId/storyIds/entityId/fields` 必须能在当前模块内解析，否则丢弃并记 warning/note。

---

## 3. 生成流程

### 3.1 输入（只读）

| 输入 | 用途 |
| --- | --- |
| 模块行（title/key/description/doc 版本） | 上下文、stale 基线 |
| 模块 PRD 各章节 `{title, kind, markdown}` | 主输入；`rules`/`pages`/`epics`/`scenes`/`users` 权重最高；单章节截断 6KB、总计 40KB（超出写 note） |
| 结构化 Epics/Stories（id/title/goal/description/acceptance/priority） | 页面必须挂到真实 `epicId`/`storyIds` |
| 原型模板（name/description/patterns/pageSetRules） | 页面形态与动作风格（列表筛选/表单弹窗/详情分区） |
| 应用名 | 品牌语境 |

**不输入**：设计阶段实体/页面集（避免反向耦合）、任何凭据/环境配置。

### 3.2 输出协议

模型必须只输出一段 `<<<PREVIEW_SPEC_JSON>>>` 分隔后的 JSON：

```jsonc
{
  "entities": [{ "name": "...", "description": "...", "fields": [{ "label": "商品名称", "type": "string", "required": true, "unique": false, "options": [], "note": "2—60 字" }] }],
  "pages": [{ "title": "商品列表", "type": "list", "epicId": "EPIC-001", "storyIds": ["STORY-001"], "entity": "商品档案", "fields": ["商品名称", "商品状态"], "actions": ["新增", "编辑", "删除"] }],
  "notes": ["字段/规则中的待确认项"]
}
```

Prompt 规则要点：
- 实体/字段**只能来自文档事实**；文档没有的字段不编造，缺失记入 `notes`；`> 待确认` 一律进 notes。
- 字段 `type` ∈ `string|text|number|decimal|date|datetime|time|boolean|enum|ref`；`enum` 必须给 `options`（来自文档枚举）；`ref` 必须指向本模块另一实体名。
- `pages[].type` ∈ `list|form|detail|dashboard|kanban|calendar|gantt|custom`；页面形态遵循模板 `patterns`（如企业级：表单弹窗、详情分区）。
- 页面优先对齐「页面与交互需求」章节；每个 Epic 至少 1 个列表页；Story 尽量挂到页面（`storyIds`），无法挂的留空。
- 字段用中文业务名（`label`），服务端据此生成稳定 `name`（拼音/序号，不做中文列名）。
- 不写表结构、接口、代码；不修改需求文档。

### 3.3 服务端归一化与校验（确定性）

1. 分隔符容错（代码块/尾逗号/前后噪声），解析失败 → 502 `原型生成结果无法解析，请重试`。
2. 实体名去空白、去重（不区分大小写）；字段 `label` 去空白、同名合并（后出现的非空属性补齐）；`type` 白名单外的 → `string` + note；`enum` 无 options → `string` + note；`ref` 指不到实体 → `string` + note。
3. `pages[].epicId` 不在当前模块活跃 Epic → `null`（前端进「其他页面」）+ note；`storyIds` 过滤为当前模块活跃 Story；`entity` 匹配不到 → `null`；`fields` 过滤为该实体字段 `label`，未知丢弃。
4. 上限（超出截断 + note）：entities 30 / fields 40 / pages 80 / actions 8 / options 20；字符串 ≤ 200 字（note ≤ 300）。
5. `pages` 为空 → 502 `模型没有产出可预览的页面，请重试`。
6. `id` 服务端生成（`PE-1…`/`PP-1…`），不接受模型 id。
7. 落库前写 `stats`，并把 `base` 记为当前 doc 版本/更新时间。

### 3.4 调用与并发

- 单次生成 = 一次 `generateText`（`timeoutMs` 120s），非 SSE；客户端断开 → `res.on('close')` abort（**不要用 `req.on('close')`**，M7-1 的 MF7 教训）。
- 同一模块并发生成：后到请求直接 409 `正在生成，请稍候`（进程内 `Map<moduleId, AbortController>` 保护；进程重启即失效，可接受）。
- 生成成功才写库；失败/取消不写、不覆盖旧规格。

---

## 4. 接口

### 4.1 `GET /api/apps/:id/requirements-prototype?moduleId=`

在 M7 现有响应上**增量**扩展（保持向后兼容字段）：

```jsonc
{
  "appId": "...", "generatedAt": "...",
  "module": { "...": "同 M7" },
  "template": { "...": "同 M7（tokens/shell/patterns/pageSetRules + source）" },
  "pageSets": [ /* M7 确定性 Epic→页面集，保留用于范围/分组 */ ],
  "stats": { "epics": 2, "stories": 8, "pages": 8, "unmappedStories": 0 },
  "warnings": [ /* 同 M7 */ ],
  "spec": { /* 预览规格；未生成时为 null */ },
  "specState": {
    "status": "missing" | "ready" | "stale",
    "staleReason": "doc-changed" | null,
    "coverage": { "stories": 8, "coveredStories": 6, "uncoveredStoryIds": ["STORY-007", "STORY-008"] }
  }
}
```

- 只读；不创建模块/文档/规格。
- `moduleId` 缺省 → 默认模块（不懒创建）；未知 404；归档只读。

### 4.2 `POST /api/apps/:id/requirements-prototype/spec?moduleId=`

- 生成/重新生成并落库；body 可选 `{ "regenerate": true }`（仅语义，不做特殊分支；非 regenerate 且已有 spec 时也照常覆盖，前端负责二次确认）。
- 守卫：应用存在（404）；模块存在（404）；**归档模块 409**；无文档/文档为空 → 409 `请先补全需求文档再生成原型`；并发 → 409。
- 成功 → `{ spec, specState }`（含 coverage）；失败 → 502/499。
- **只写** `app_settings` 一个键；不写需求/设计/交接包/Change Set 任何表。

---

## 5. 渲染（复用设计阶段渲染器）

- 新组件 `RequirementsPrototypeViewer.vue`（或改造现有 `RequirementsPrototypePreview.vue` 的渲染分支）：
  - 外壳：沿用 `.proto-skin/.proto-shell/.proto-paper`（`design-skin.css` + `wireframe.css`），模板 tokens/shell。
  - 内容：`PrototypeRenderer`（`readonly`、`notes=[]`、`layout=undefined`、`rows=mockRows(specEntity, 8)`、`pages=[]`、`moduleId='requirements-preview'`）。
  - spec entity → `SpecEntity`：`id/name/status='draft'`、字段 `{name,label,type,required,unique?,options?,target?}`（`decimal`→`number`，`ref`→`ref` + `target` 实体 id）。
  - spec page → `SpecPage`：`id/type/title/entity=entityId/fields=页面字段 name 列表/actions=页面动作/status='draft'`。
  - 页面列表为空/实体缺失：纸面给明确空态（"该页面未绑定实体"），不报错。
- 导航：外层页面集 chips = Epic（沿用 M7），页面 chips = 该 Epic 的 AI 页面；无 `epicId` 的页面进「其他页面」。
- 顶部信息：模板徽标（名称+来源）、模型 id、生成时间、`基v8`、`N 实体 · M 字段 · K 页面`、`Story 覆盖 6/8`。
- 声明：`AI 参考原型 · 仅用于需求评审，不进入设计阶段/交接包`。

---

## 6. UI/UX 状态

| 状态 | 呈现 |
| --- | --- |
| 未生成（`missing`） | 空态卡：「还没有原型参考」+ 说明（按当前需求由 AI 生成，不写设计数据）+ **生成原型参考** 按钮；同时显示 M7 的 Epic/Story 范围统计 |
| 生成中 | 纸面占位 + 「正在生成原型参考…（通常 10—40 秒，可取消）」+ 取消按钮；禁用重复点击与切模块以外操作 |
| 成功 | 渲染 + 顶部信息 + 「重新生成」（二次确认：将覆盖当前规格）/「查看文档」 |
| 过期（`stale`） | 顶部黄色横幅「需求已更新（v8→v9），建议重新生成」+ 重新生成按钮；旧规格仍可看 |
| 失败 | 错误卡（模型失败/不可解析/空页面）+ 重试；**不覆盖**旧规格（若已有） |
| 只读（已确认/变更外/归档） | 只读横幅保留；**允许生成**（预览不写业务数据），但归档模块 409 且按钮禁用并提示 |
| 文档无 Epic/Story | 生成仍可点，但提示「建议先补全 Epics & Stories，页面会挂到 Epic 上」 |

其它：
- 入口不变：需求大纲树每模块「原型预览」节点；进入即拉 GET（不调模型）。
- 切模块：保持 flush 与只读语义（沿用 M7）。
- 响应式：沿用 M7（1024/768 纵向堆叠、画布缩放、内部滚动、无页面级横向溢出）；深浅色沿用 token，纸面保持白纸。
- 空/错/加载均不产生 console error。

---

## 7. 只读与安全边界

- 业务数据零写入：不写需求文档/章节/版本/bundle、不建设计项目/实体/页面/页面集/版本、不写交接包/Change Set/阶段/会话/PNG；**唯一写入 = `app_settings` 的预览规格键**。测试必须断言除 `app_settings` 外所有表行数不变、`projects/<app>/` 目录树不变。
- Prompt 只含需求文本与模板元信息，不含凭据；模型输出全部过白名单/长度/引用校验后再渲染（渲染器只输出文本，无 `v-html`）。
- 预览规格明确标注 AI 生成，可能与文档不一致；不参与任何门禁/校验。
- 进程内并发锁不跨进程（单实例工作台，可接受）。

---

## 8. 测试计划

**后端（新 `prototype-spec.test.ts`，约 14—18 项）**

1. Prompt：含模块/章节/Epics/Stories/模板；单章节截断 6KB、总量 40KB；超限写 note；不含设计数据。
2. 解析容错：代码块、尾逗号、前后噪声、无分隔符 → 502。
3. 归一化：实体/字段去重合并；type 白名单/`enum` 无 options/`ref` 悬空；`epicId/storyIds/entity/fields` 过滤；上限截断；id 服务端生成。
4. `pages` 为空 → 502；模型异常 → 502；取消 → 499。
5. 守卫：未知应用/模块 404；归档 409；无文档/空文档 409；并发 409。
6. 写入：只写 `app_settings`；其余表行数与项目目录不变；旧规格在失败时不被覆盖。
7. `GET`：`spec`/`specState`（missing/ready/stale 三态）；`coverage` 统计；`stale` 由 docVersion/docUpdatedAt 变化触发；未生成时不写库。
8. HTTP：GET 200 结构、POST 200/409/502；`res.on('close')` abort 的真实 HTTP 回归（stub generator）。
9. 回归：M7 既有 `prototype-preview.test.ts` 全绿（字段语义不变）。

**前端（新 `prototype-spec-helpers.test.mjs`，约 6—10 项）**

- spec 实体/页面 → `SpecEntity/SpecPage` 映射（type/ref/enum/字段子集）；按 Epic 分组 + 「其他页面」；选中回退；coverage/stale/统计文案；空态判定。

**Playwright（stub `opencode.generateText`，返回固定 spec JSON；临时目录 + 独立端口）**

- 未生成空态 → 点生成 → 渲染真实字段（列表列/表单字段/详情分组，断言字段名出现）→ 顶部模型/时间/统计。
- 「重新生成」二次确认（取消不请求、确认后覆盖并更新统计）。
- 过期横幅：先改文档（API 或 UI）→ 再次进入 → `stale` 横幅 + 旧规格仍可见 → 重新生成后消失。
- 失败态：stub 抛出 → 502 错误卡 + 重试成功；旧规格不被覆盖。
- 只读声明与只读横幅并存；归档模块按钮禁用 + 409 提示。
- 响应式 1440/1280/1024/768 × 浅/深：0 console/page error、0 意外 API≥400、0 页面级横向溢出；生成中禁用重复请求。
- 网络断言：预览渲染期间无写请求；生成仅 1 次 `POST .../spec`。

**真实模型（主会话，临时应用，不碰 app1）**

- 用真实 `packycode-deepseek/deepseek-flash` 对"商品管理/订单管理"类 PRD 生成，核对：实体数/字段数、字段名与文档一致、列表/表单/详情字段合理、Story 覆盖率、模板观感；跑完删除临时应用。

---

## 9. 不做 / 风险 / 未验证

| 项 | 说明 |
| --- | --- |
| 规格手工编辑 | 本批不做；只能重新生成（后续可加"锁定/微调字段"） |
| 多模块合并原型 | 不做；按模块预览 |
| 字段精度 | AI 可能漏字段/合并字段；靠 `notes` + 重新生成 + 人工评审兜底 |
| 模型成本/耗时 | 显式按钮 + 缓存；重生成才再调用 |
| 模糊/极简 PRD | 字段少或缺失时原型会偏薄；UI 提示"先补全业务规则与数据要求" |
| 真正的交互 | 渲染器为静态线框 + 示例数据；不做跳转/真实校验 |
| `<768` | 沿用既有范围，本批不验证 |
| 并发 | 单实例内存锁；多实例部署未考虑 |

---

## 10. 交付拆分

一个批次（M7-2）内完成后端 + 前端 + Playwright；真实模型 E2E 由主会话另跑（临时应用）。若要拆，按 **M7-2a 后端（spec 生成/归一化/接口/单测）→ M7-2b 前端（渲染 + 状态 + Playwright）** 两段。
