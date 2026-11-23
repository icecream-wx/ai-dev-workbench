# P7-5b 实施单：开发提示/方法 skill/digest/模块上下文/ui-check 软门禁（2026-11-19）

> 上游：P7-5a MF 脚手架、P7-4a 页面契约、`2026-11-19-design-template-and-dev-linkage-p7-design.md` 第 7 节。
> 本轮只做 **P7-5b**：开发侧强关联——prompt/AGENTS/方法 skill/digest/module/`ui-check.md` 软门禁/开发视图参考。
> **不做**：一致性检查脚本/截图自动比对（P7-6）、自定义 builder（P7-7）。
> 不改需求模板中心/需求 skill/DB 表/旧应用行为。

---

## 0. 出口标准

1. 开发 prompt 包含：
   - 应用设计系统（pack/applicationType/style）；
   - `docs/design/design-system.json`、`docs/design/<MOD>/design.json`、`design-brief.md`、`tokens.json`、`prototypes/*.png`、`docs/design/template/` 蓝图；
   - 团队 skill（`afcenter-page-generation`、`pm-components-usage`）、设计模板 skill、开发方法 skill（`adw-frontend-implementation`）；
   - `ui-check.md` 路径与“先填对照表再写代码”的软门禁；
   - 蓝图复制/PageTemplates/pm-*/GlobalPreference/conformance/冲突上报/PNG 草图定位。
2. 应用 `AGENTS.md` 写入上述规则。
3. 新增 `adw-frontend-implementation` skill（读顺序/对照表/蓝图复制/组件规范/截图比对/冲突/完成汇报）。
4. 后端注入 design digest：模块、页面清单/recipe/blueprint、字段/列/操作、form/tree 摘要、brief/tokens/stale、ui-check 状态；不把大段原文塞进 prompt。
5. 开发视图可选择模块并传给后端；单模块自动带上。
6. `docs/design/<MOD>/ui-check.md` 由后端生成骨架（缺失时），agent 填充；不覆盖已有内容；开发视图显示状态。
7. 现有 109/79、e2e:preview 77、e2e:p7-3b 45、e2e:p2/p3/p4 116/126/97 保持；新增 prompt/digest/ui-check 测试。

---

## 1. 应用 AGENTS.md

更新 `backend/src/apps/scaffold.ts` 的 `APP_AGENTS_MD`（以及必要 README）：

- 设计系统段：pack/applicationType/style；`docs/design/design-system.json`；模板页面库/蓝图根 `docs/design/template/`。
- 开发规则：
  1. 先读 design-system/design.json/brief/tokens/prototypes/蓝图/AGENTS；
  2. 先填 `docs/design/<MOD>/ui-check.md` 对照表，再写代码（软门禁，不阻断）；
  3. 从 `docs/design/template/<type>/pages/*.vue` 复制/适配到 `frontend/src/views/`，保留结构/样式/组件，替换 mock/接口；
  4. 使用 PageTemplates（BusinessListPage/TreeListPage/StandardFormPage/FormSection/QueryPanel/RowActions/ThreePartPagination）；
  5. 使用 `pm-*`；pm-* 由 AFCenter 宿主全局提供，不重复注册；新增/编辑默认 `pm-form-dialog`；`v-auto-height`；>8 字段双列；批量 `batch-actions`；树 MoreFilled；
  6. 统一 `GlobalPreference`；预设只在页面 computed 合并；
  7. PNG 是线框草图；蓝图/预览是视觉事实；冲突先报告，偏离写进 ui-check/汇报；
  8. 禁止手写一套 UI 替代模板；缺少 pm-*/PageTemplates 时停下报告。
- 保留中文、无 git、凭据等现有约定。

## 2. 开发方法 skill

新增 `templates/agent/skills/adw-frontend-implementation/SKILL.md`：

- 何时加载：开发视图实现前端页面。
- 读取顺序：AGENTS → design-system.json → design.json/brief/tokens/prototypes → 蓝图 → 现有 frontend 代码。
- 输出页面对照表（页面/路由/蓝图/字段/列/操作/布局/差异）。
- 蓝图复制/适配规则；PageTemplates/pm-*/GlobalPreference；conformance 清单。
- 完成后：启动页面/截图（若可）、逐页对照、差异说明、未实现项。
- 冲突处理：需求/design.json/brief/PNG/蓝图冲突先报告，不静默取舍。
- 失败边界：缺宿主/pm-* 时说明，不自造 UI。

分发：`installAgentAssets` 自动复制；`expectedSkillIds`/verify assets 增加该 skill。

## 3. 开发 prompt / digest

`backend/src/chat/service.ts`、`backend/src/dev/service.ts`：

- `buildViewPrompt('development')` 改为：
  - 设计系统/路径/蓝图/团队 skill/开发 skill/ui-check；
  - 优先级：需求 > design-system/design.json 契约 > 蓝图（布局/组件） > brief/tokens（视觉变量） > PNG（线框草图）；
  - 冲突先报告；偏离必须说明；
  - MF remote 边界（pm-* 宿主提供，不重复注册；EOS 后端不吃风格）。
- 新增 digest 生成（后端）：
  - 输入 appId/module；读取 design-system（P7-1）、design.json + artifacts、pack 页面元数据；
  - 输出精简文本：pack/type/style；页面 id/name/recipe/blueprint；实体/字段/列/操作；form/tree 摘要；brief/tokens/PNG stale；ui-check 状态；蓝图根路径；
  - 限制长度（如 6KB），超长截断并注明；
  - 缺失模块/设计时给明确提示，不抛 500。
- 单模块自动带 module；多模块用 DevView 选择。

## 4. 模块上下文

`frontend/src/dev/DevView.vue`、`frontend/src/dev/api.ts`：

- 从 artifacts（或新增轻量 API）取模块列表；开发视图增加模块选择（单选/下拉）。
- `createDevSession`/`promptDevSession` 传 `module`；选中持久化（localStorage 或应用上下文）。
- 单模块自动选中；无模块时提示先做设计。
- 不破坏现有会话列表/流式/停止/compact。

## 5. ui-check.md

- 新增后端生成函数（如 `backend/src/dev/ui-check.ts`）：
  - 路径 `docs/design/<MOD>/ui-check.md`；
  - 内容：实现前表（页面/路由/蓝图/字段/列/操作/布局/差异）、实现后表（文件/截图/一致项/差异/原因）、未实现项；
  - 页面/字段/操作从 design.json + pack 页面元数据生成；
  - 缺失时创建；已存在不覆盖（可追加“工作台骨架”标记只在首次）；
  - 只在开发 prompt 且 module 明确时生成；设计缺失则跳过。
- prompt 中写明路径与“先填再写代码”。
- 开发视图显示 ui-check 状态（未生成/已生成未填/已填），只读。
- 不做硬门禁；未填只在会话摘要/验收标记。

## 6. 开发视图参考

`frontend/src/dev/DevView.vue`：

- 顶部/侧栏增加只读“设计参考”摘要：应用类型/风格、页面数、ui-check 状态、蓝图根、打开模板中心/页面库。
- 不改现有时间线/工具卡/权限卡/Composer。

## 7. 测试

- 后端：
  - prompt 含 design-system/blueprint/团队 skill/开发 skill/ui-check/优先级；
  - digest 内容/长度/缺失模块；ui-check 生成/不覆盖/无设计跳过；
  - expectedSkillIds 含开发 skill；旧应用兼容。
- 前端：
  - DevView 模块选择与 prompt payload（单测/纯函数）；
  - e2e p4 断言更新（prompt 设计参考/ui-check）；新增 UI 检查（模块选择/ui-check 状态）。
- 回归：109/79、e2e:preview 77、e2e:p7-3b 45、e2e:p2/p3/p4 116/126/97。
- 不调真实模型；真实模型验证留 P7-6/用户授权。

## 8. 边界

- 不改需求模板中心/需求 skill/DB 表；不改 P7-3a/b 预览/模板中心业务；不做一致性脚本/截图自动比对（P7-6）；不启停真实 3300；不读写真实 data/projects/.env；不 git；不调模型。

## 9. 收尾

- 更新 P7 设计稿 P7-5b 实施记录与 docs/STATUS.md。
- 回报：prompt/AGENTS/skill/digest/module/ui-check 变更、测试结果、偏差、未验证项、环境确认。

## 10. 实施结果（2026-11-19）

已按本单完成 P7-5b；详细记录见 `2026-11-19-design-template-and-dev-linkage-p7-design.md` 第 20 节与 `docs/STATUS.md`。

- 变更：开发 prompt/首条提示重写、应用 AGENTS 开发规则、新增 `adw-frontend-implementation` skill、后端 design digest（约 6KB）、模块上下文（DevView 选择 + localStorage + 后端 module）、`ui-check.md` 骨架生成/状态只读、开发视图设计参考。
- 测试：后端 **115/115**、前端 **83/83**；`build`/`typecheck`/`check:vue`/`smoke:workspace`/`smoke:assets`（真实 opencode 2.2.5，不调模型）通过；`e2e:preview` 77、`e2e:p7-3b` 45、`e2e:p2/p3/p4` 116/126/**128**。
- 偏差：ui-check 状态用骨架哈希判断、digest 摘要上限/截断、模块持久化在前端、ui-check 只在开发 prompt 生成、p4 增加临时 fixture。
- 未验证：真实模型完整还原、生成物 frontend 构建、真实 AFCenter/EOS/3300、P7-6/P7-7。未执行 git、未调用模型、未读写真实 data/projects/.env。

