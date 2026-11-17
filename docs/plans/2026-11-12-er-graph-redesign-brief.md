# ER 图专业化改造交接单（#3）

日期：2026-11-12
用途：新开实施会话执行；主会话评审。
状态：**待实施**。
上游：用户反馈“实体设计 ER 图太丑，参考专业 ER 工具”；当前 `frontend/src/design/ErGraph.vue` 为固定 176×70 方块 + 直线，字段/关系不可读。
范围：**只改 ER 图前端（ErGraph + 纯布局逻辑 + 样式/测试）**；不改实体数据模型/API/后端/页面原型/需求结构；不做整页设计 Studio 重排。

**重要**：真实工作台可能在运行（app1 含用户数据）。禁止修改真实 `data/`/`projects/app1`；验证用临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR` + 新应用。

---

## 1. 目标

把 ER 图从“方块+直线”升级为接近 dbdiagram / drawSQL / MySQL Workbench 的可读风格：

- 每个实体是一张“表卡片”：表名（英文 tableName）+ 实体名 + 状态；字段行显示字段名、类型、PK/FK/必填/唯一标记；外键显示目标实体。
- 关系线为平滑曲线/正交线，带箭头与 `1:1 / 1:N / N:1 / N:N` 基数标签，避免穿过卡片。
- 节点按关系分层自动布局（无关系时网格），确定、无重叠、可滚动；宽屏充分利用，窄屏横向滚动。
- 支持缩放（75/100/125%），图例（PK/FK/必填/唯一），点击选中实体（保持现有 `select` 行为）。
- 深浅色使用 `--rg-*` token；不引入新依赖（不必须用 X6）。

---

## 2. 文件与实现

### 2.1 新增纯布局 `frontend/src/design/er-layout.js`

不依赖 Vue/DOM，供组件和 `node --test`：

建议 API：

```js
export function buildErLayout(entities, options = {}) -> {
  width, height,
  nodes: [{ id, entity, x, y, width, height, headerHeight, rows: [...] }],
  edges: [{ key, sourceId, targetId, path, label, cardinality, labelX, labelY }]
}
export function relationCardinality(type) // '1:1' | '1:N' | 'N:1' | 'N:N'
```

布局要求：

- 常量集中：`NODE_W=240`、`HEADER_H=44`、`ROW_H=20`、`PAD=24`、`LAYER_GAP=96`、`ROW_GAP=28`、`COMPONENT_GAP=56`。
- 节点高度 = header + `min(fields.length, 12) * ROW_H` +（fields>12 时加一行 `+N 更多字段`）+ 底部 padding；不截断字段数据（渲染层显示前 12 + 省略提示）。
- 只把 `relations[].target` 能解析到本图实体的关系画成边；自引用也保留（用自环路径）。
- 分层：按无向关系做 BFS/最长路径分层（roots = 无入边或最靠前；无关系时按 position 网格 2 列）；循环关系不能死循环；同一层按 position/名称稳定排序。
- 同一层节点纵向堆叠，层间横向排列；多个不相连组件纵向堆叠，不重叠。
- 边锚点：目标在右侧 → 源右中到目标左中；左侧反之；同层 → 源下中到目标上中；使用三次贝塞尔 `path`，控制点水平偏移 ~64。标签放在路径中点旁，带背景。
- 输出 `width/height` 覆盖所有节点 + padding；测试可据 boxes 断言无重叠。

### 2.2 重写 `frontend/src/design/ErGraph.vue`

Props/emit 保持：`entities: DesignEntity[]`、`selectedId?`、`@select(id)`。

模板：

- 顶部工具条：`表 {n} · 关系 {m}`、图例（PK 主键 / FK 外键 / * 必填 / U 唯一）、缩放 `<select>`（75/100/125），右侧提示“关系在实体编辑里维护”。
- `<div class="er-canvas">` 横向/纵向滚动，内部 `<svg :viewBox="0 0 width height" :style="{ width: width*zoom+'px', height: height*zoom+'px' }">`。
- 先画边（`<path>` + marker 箭头 + `rect` 标签底 + `text` 基数/关系名），再画节点，避免线压卡片。
- 节点组：
  - 卡片背景/边框/阴影（selected 高亮 + 左侧 accent 条）；
  - header：实体名（13px 600）、tableName（mono 10.5px）、状态 chip（已确认/草稿）；
  - divider 后字段行：`PK`/`FK`/`*`/`U` 小徽标（颜色区分）、`name`（mono 11px）、`type`（右对齐 10px）、FK 行显示 `→ 目标实体名`（截断）。
  - 字段超过 12 行显示 `+N 更多字段` 行。
  - `role="button" tabindex=0`、Enter/Space 选中；`aria-label` 含实体名/表名。
- 空状态保留：还没有实体。
- 禁止在 SVG 外层出现页面级横向滚动（容器 `overflow:auto`，`min-width:0`）。

样式：

- 全部 `--rg-*` token；卡片 `--rg-surface`，header `--rg-surface-2`，边框 `--rg-border`，选中 `--rg-ai`/`--rg-ai-soft`；FK/PK 徽标使用 `--rg-ai`/`--rg-accent`/`--rg-ok`。
- 深色可读；文字不溢出卡片（`text-overflow` 用 `<title>` 或截断）。
- 1024/768：卡片尺寸不变、容器滚动；工具条换行；不出现页面横向溢出。

### 2.3 纯逻辑单测

新增 `frontend/src/design/er-layout.test.mjs`，加入 `frontend/package.json` 的 `test` 列表。至少：

1. 无关系：网格布局、所有节点不重叠、都在 width/height 内、顺序稳定。
2. 有向链 A→B→C：A/B/C 分层递增；边数 2；path 非空；基数标签正确。
3. 循环 A→B→A：不死循环、两节点不重叠、边可生成。
4. 自引用：节点仍一个、边存在（允许自环）。
5. 多组件：互不相连的两组不重叠（或 y 区间分离）。
6. 字段数：高度随字段增加；>12 时有省略行（若布局输出包含 `hiddenFields`/`moreCount`）。
7. `relationCardinality` 四种类型 + 未知类型回退 `1:N`。

### 2.4 Playwright（临时数据）

- 临时后端（如 3462/4462，`OPENCODE_AUTO_START=false`）+ 新应用：确认需求（2 Epic/若干 Story）、5 个实体（含 1:1/1:N/N:1、自引用、字段 3—15 个、部分 FK/required/unique）保存为草稿/确认均可，设计不确认。
- 打开设计 → 实体设计 → ER 图：
  - 节点数=5；含字段/表名/关系标签；无关系线穿过卡片（人工截图确认）；
  - 点击节点 → 右侧实体编辑器切换到该实体；缩放 75/100/125 可用；空状态（删除/新应用无实体）正常。
  - 截图：浅/深 × 1440/1024/768（至少 ER 图区域 + 整页）；0 console/page error、0 意外 API>=400、0 页面级横向溢出、0 深色白底。
- 清理临时后端/端口；真实 app1/data 不变。

---

## 3. 不做 / 边界

- 不改 DesignEntity/关系字段/API/后端/交接包/页面原型。
- 不引入 X6/新依赖（如确需，先回传说明；默认不用）。
- 不做拖拽/手工布局/缩放持久化；只做自动布局 + 简单缩放。
- 不改实体编辑器左侧列表/表单，仅 ER 图。

## 4. 验证命令

```powershell
npm test --prefix frontend
npm run typecheck --prefix frontend
npm run build --prefix frontend
npm run check:vue --prefix frontend
npm run build --prefix backend
npm test --prefix backend
```

- 前端基线 79（Batch 1 后）；新增 ER 测试后按实际回传；后端保持 149/149（未改后端）。
- Playwright 证据放 `C:\Users\icecream\AppData\Local\Temp\opencode\er-graph\`（临时目录，不提交）；回传截图数/错误数/溢出数。

## 5. 文档

- 本交接单追加 `## 6. 实施结果`（改动/命令/截图/偏差/未验证）。
- `docs/STATUS.md` 新增 ER 优化小节 + 摘要表行。
- 不改 `AGENTS.md`（主会话评审后统一更新）。

## 6. 实施结果

日期：2026-11-12（实施会话）。

### 6.1 改动文件

| 文件 | 改动 |
| --- | --- |
| `frontend/src/design/er-layout.js` | **新增**纯布局（无 Vue/DOM 依赖）：`buildErLayout(entities, options)` / `relationCardinality(type)`；固定卡片 `NODE_W=240`、`HEADER_H=44`、`ROW_H=20`、`PAD=24`、`LAYER_GAP=96`、`ROW_GAP=28`、`COMPONENT_GAP=56`；字段最多 12 行 + `moreCount`/`hiddenFields`；按无向关系拆连通分量、分量内有向 BFS 分层（无根时取首个节点，循环不死循环）、同层按 position/名称稳定排序、分量纵向堆叠；无关系时 2 列网格；相邻层三次贝塞尔、同层优先上下锚点（穿卡时退化为层间竖向通道）、跨层走分量上方正交通道、自引用右侧自环；边输出 `path/cardinality/label/labelX/labelY/labelSubtext/labelWidth/labelHeight`；输出 `width/height` 覆盖节点与边标签。 |
| `frontend/src/design/ErGraph.vue` | **重写**为表卡片 ER 图：工具条（`表 N · 关系 M`、PK/FK/*/U 图例、缩放 75/100/125、关系维护提示）；SVG 先画边（箭头 marker + 标签底 + 基数 + 关系名）再画卡片；卡片 header（实体名/表名/状态 chip）、字段行（PK/FK 徽标、`*`/`U`、字段名、SQL 类型、FK `→ 目标实体名`）、`+N 更多字段`；点击/Enter/Space 选中、`aria-label`；空状态；全部 `--rg-*` token、点阵画布、内部滚动、1024/768 工具条换行与页面无横向溢出、深浅色可读。Props/emit 保持 `entities/selectedId/@select`。 |
| `frontend/src/design/er-layout.test.mjs` | **新增** 8 项纯逻辑测试：无关系网格/稳定顺序、A→B→C 分层与基数、循环 A↔B、自引用、多组件纵向分离、字段数/`moreCount`、`relationCardinality` 4 类 + 未知回退、字段行 PK/FK/必填/唯一/外键目标名。 |
| `frontend/package.json` | `test` 列表加入 `src/design/er-layout.test.mjs`。 |

未改后端/数据库/API/实体或关系数据模型/页面原型/需求结构/实体编辑器表单。

### 6.2 验证命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix frontend` | ✅ **87/87**（基线 79，+8） |
| `npm run typecheck --prefix frontend` | ✅ `vue-tsc --noEmit` |
| `npm run build --prefix frontend` | ✅ vite 构建通过 |
| `npm run check:vue --prefix frontend` | ✅ 全部 SFC 导入完整 |
| `npm run build --prefix backend` | ✅ `tsc` 通过（未改后端） |
| `npm test --prefix backend` | ✅ **149/149**（未改后端） |

Playwright（临时环境，不触碰真实 3300/app1）：

- 临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`，PORT=3462、OPENCODE_PORT=4462、`OPENCODE_AUTO_START=false`，不调模型/不启动 opencode。
- 预置：新应用 `er-graph-e2e` 确认需求（2 Epic）；5 实体（客户 6 字段/客户档案 4/订单 15/订单明细 7/商品 5），关系 1:1、1:N、N:1×2、自引用（订单→父订单），部分 required/unique/FK；设计保持 draft。另建 `er-graph-empty`（无实体）。
- **66 项断言全部通过**：节点 5、表名/实体名齐全、工具条 `表 5 · 关系 5`、图例与关系维护提示、边 5、基数 `1:1/1:N/N:1`、关系名 `客户档案/所属客户/订单明细/父订单/关联商品`、PK 徽标 5、FK 徽标 5、`*`/`U` 标记、订单 `+3 更多字段`、点击/Enter/Space 切换左侧选中实体、缩放 75/125 生效、空状态文案与 `表 0 · 关系 0`。
- 浅/深 × 1440/1024/768：ER 区域 + 整页截图 **12 张** + 空状态 **1 张**，共 **13 张**；**0 console error / 0 page error / 0 意外 API>=400 / 0 页面级横向溢出 / 0 深色白底**（深色下扫描 `.er-wrap` 内 HTML background-color 与 SVG fill）；1024/768 ER 画布内部横向滚动生效；人工查看截图确认关系线未穿过卡片（相邻层曲线均在层间通道内）。
- 产物（临时目录，未提交）：`C:\Users\icecream\AppData\Local\Temp\opencode\er-graph\`（`seed.mjs`、`run-e2e.cjs`、`results.json`、`backend.log`、`shots/` 13 张）。

### 6.3 偏差 / 决策

1. 类型列展示紧凑 SQL 类型（`varchar/text/int/decimal/date/datetime/time/bool/enum/ref`），而非 `DesignFieldType` 原值；完整类型/字段名/外键目标在行 `<title>` 中，避免 240 宽卡片文本溢出。字段名按是否 FK 动态裁剪（FK 行给外键目标留位），并非所有字段都显示完整名。
2. 跨层边在分量上方使用**正交通道**（brief 的“避免穿过卡片”优先于纯贝塞尔）；同层边仍按要求优先上下锚点三次贝塞尔，检测到穿过其他卡片时退化为层间竖向通道。为保证顶部通道标签不裁剪，布局顶部额外预留 `TOP_CHANNEL_PAD=20`（`PAD` 常量本身未改）。
3. PK 判定：字段名 `id` 优先，否则第一个 `unique` 字段；FK 判定：字段 `type==='ref'`（可解析目标）或关系 `sourceField` 匹配。后端无独立主键字段，按此推断只影响展示。
4. 自引用标签偏移到自环右侧上方，避免与相邻关系标签重叠（实测标签矩形无重叠）。
5. 未引入 X6/新依赖（虽然 `@antv/x6` 已在依赖中，本改造不使用）；不做拖拽/手工布局/缩放持久化（按 §3）。
6. 为让临时后端直接托管前端，重建了 `frontend/dist`；真实 3300 实例仍在运行且只读静态文件，未停止、未改真实 `data/`/`projects/app1`。验证全部使用 3462 临时实例与临时目录，结束后已停止临时后端并释放 3462/4462。

### 6.4 未验证 / 已知限制

- 未在真实 app1/真实数据上操作（按约束禁止）；Playwright 用 API 预置数据，未走真实模型生成实体。
- 未专项验证 >5 实体的大型图、N:N 边与多跳过层视觉（单测覆盖循环/多组件/自引用/无关系，截图仅覆盖 5 实体）；未验证 `<768` 移动端（brief 只要求 1024/768）。
- 卡片固定 240 宽、字段行 20 高，超长字段名/表名会按估算宽度省略（`<title>` 提供全文）；中英文混排的像素级宽度为估算，极端字符可能仍有少量留白/截断。
- 未验证真实浏览器缩放（浏览器页面 zoom）与打印/导出；缩放控件只改变 SVG 显示尺寸（75/100/125），不持久化。
