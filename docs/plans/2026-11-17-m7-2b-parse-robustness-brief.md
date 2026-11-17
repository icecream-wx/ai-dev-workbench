# M7-2b 原型规格生成健壮性修复 交接单（解析容错 + 自动重试 + 可诊断报错）

日期：2026-11-17
状态：**已实施（2026-11-17，待评审）**（用户先重试一次；不论结果，本单都建议实施）
背景：用户在真实 app1「商品管理」点「生成原型参考」得到 `原型生成失败 / 原型生成结果无法解析，请重试`。
主会话排查（2026-11-17）：
- 用 app1 的真实 PRD + 真实 `deepseek-flash`（含 app1 实际 fallback 的 `variant=high`）在临时实例复现 **3 次全部成功**（MOD-001 15.6s/25.9s；MOD-002 15.9s），生产 `parsePrototypeSpecOutput` 解析全部通过。
- 真实 3300 的 `specState.status = missing`（未写库）；生成走**临时会话**且结束即删除，opencode 日志不含正文/错误，无法取证原始输出。
- 结论：最可能是**模型偶发输出不符合 JSON 契约**（夹杂解释、多个 JSON、未转义换行、截断等），当前实现"一次不过就 502"，且错误里没有原始片段，无法定位。

范围：**只改 M7-2 生成链路的健壮性与可诊断性**；不改数据模型、接口语义（只增 `detail`）、UI 主流程、设计阶段/交接包/Change Set/U7；不新增表/依赖。

---

## 1. 后端

### B1 提示词：只输出 JSON（`src/requirements/prototype-spec.ts`）

- 去掉"先输出 1—3 句中文回复"的要求；改为：
  - 首个非空字符必须是 `{`，最后一个非空字符必须是 `}`；`JSON` 之后不得有任何文字；
  - 不允许 markdown 围栏、注释、尾逗号；
  - 仍保留 `<<<PREVIEW_SPEC_JSON>>>` 分隔符（兼容旧解析与调试），但**不再要求**寒暄。
- 其余规则（事实来源/type 白名单/notes/页面挂 Epic 等）不变。

### B2 解析容错（同文件）

新增/增强（按顺序尝试，全部失败才 502）：

1. 预处理：去 BOM；去掉任意位置的 ```` ```json … ``` ```` 围栏；`\r\n` → `\n`。
2. **平衡括号候选扫描**：忽略字符串内的 `{}`；收集所有完整的 `{…}` 子串，**从后往前**逐个 `JSON.parse`（优先分隔符之后、最靠近末尾的对象）。
3. 每个候选做修复后再试：
   - 尾逗号；
   - **字符串内未转义换行** → 转成 `\\n`（扫描字符串状态，谨慎实现）；
   - 解析失败且含全角引号 `“ ”` 时，替换为 `"` 再试一次（仅作为最后手段）；
   - 截断检测：若候选括号不平衡，不尝试"补括号"（避免造出错误数据）。
4. 结构化校验（entity/page 归一化）保持不变；归一化后 `entities` 或 `pages` 为空仍 502（文案不变）。

### B3 自动重试一次（`generatePrototypeSpec`）

- 触发条件：模型调用成功但**输出为空/解析失败/归一化后无实体或无页面**（不含 499 中止、不含模型调用抛错）。
- 行为：用**同一 prompt** 再调一次生成器；成功则用第二次结果；两次都失败 → 502。
- 错误体带诊断：`RequirementDocError(502, '原型生成结果无法解析，请重试（已自动重试 1 次）', { detail })`，`detail` = 最后一次原始输出经 `redact()` 后截断 **300 字**（保留开头与结尾各 150 字，中间 `…`）。
- 记录日志：`logWarn` 输出 `moduleId / attempt / rawLen / head(120)`（不含完整文档内容）。
- 测试注入保持 `options.generator`；新增 `options.retry?: boolean`（默认 true，测试可关）。

### B4 错误类与路由

- `RequirementDocError` 支持可选 `detail`（若现有构造不便，可加 `payload?: Record<string, unknown>`），`requirementErrorHandler` 在响应 JSON 中输出 `{ error, detail? }`；其它错误不受影响。
- `POST /api/apps/:id/requirements-prototype/spec` 保持现有守卫；只增 `detail` 字段。

### B5 后端测试（扩展 `prototype-spec.test.ts`，新增 10—14 项）

1. 解析：分隔符后多个 JSON → 取最靠后的合法对象；前后噪声；```json 围栏；BOM；尾逗号；字符串内未转义换行；全角引号；截断 JSON → 502。
2. 生成：第一次垃圾、第二次合法 → 成功且只多一次调用（断言调用次数=2）；两次垃圾 → 502 且 `detail` 非空且含开头片段；`retry:false` 时只调用一次。
3. 中止：第一次生成期间 abort → 499、**不重试**。
4. 模型抛错 → 502（原文案），不进入重试。
5. HTTP：502 响应含 `detail`；成功响应结构不变。
6. 既有全部用例回归（归一化/守卫/只写 settings/并发/stale）。

---

## 2. 前端（小改）

- `RequirementsPrototypePreview.vue` 错误卡：若错误带 `detail`，显示可折叠「模型输出片段（前 300 字）」`<pre>`（等宽、自动换行、最长 240px 内部滚动）。
- `api.ts`：请求错误对象透出 `detail`（`request()` 抛出 Error 时挂 `detail` 属性或 message 附带；实现取最小侵入）。
- `data-testid="prototype-spec-error-detail"`；无 `detail` 时不显示该块。
- 不改生成/重生成/取消/过期/归档等既有交互与文案（`无法解析` 文案按后端新文案显示）。

前端单测：若抽了 `formatSpecError(err)` 之类纯函数，补 2 项（有/无 detail、超长截断）。

---

## 3. 验证

| 项 | 要求 |
| --- | --- |
| `npm run build --prefix backend` / `npm run build --prefix frontend` | 通过 |
| `npm test --prefix backend`（临时目录） | 全绿；新增 10—14（基线 295） |
| `npm test --prefix frontend` | 全绿（基线 165，新增 0—2） |
| `typecheck` / `check:vue` | 通过 |
| 冒烟 | `smoke:requirements` / `smoke:modules` / `smoke:design` / `smoke:design-handoff` / `smoke:change-set` 全过 |
| Playwright（stub 控制） | ① 第一次垃圾第二次合法 → UI 直接成功（无错误卡）；② 两次垃圾 → 错误卡 + 可展开输出片段（断言片段文本）；③ 既有生成/重生成/stale/失败重试回归不破 |

真实模型：主会话另跑（可选）——若用户环境仍失败，用发布后的 `detail` 直接定位。

---

## 4. 回传

改动文件、测试数字（后端/前端新增数）、静态检查、冒烟/Playwright 断言数、偏差、未验证项；回填本单 §5；`docs/STATUS.md` 末尾追加「M7-2b 完成（待评审）」。

---

## 5. 实施结果（已回填，2026-11-17）

- 改动文件：
  - `backend/src/requirements/prototype-spec.ts`（提示词只输出 JSON；BOM/围栏/CRLF 预处理 + 平衡括号顶层候选从后往前解析 + 尾逗号/未转义换行/全角引号修复；截断不补括号；`options.retry` 默认 true 自动重试一次；502 `detail`（redact + 300 字头尾截断）；`specErrorDetail`/`logWarn` 级诊断日志）
  - `backend/src/requirements/templates.ts`（`RequirementDocError` 可选 `detail` 第 5 参）
  - `backend/src/requirements/routes.ts`（`requirementErrorHandler` 输出 `{ error, detail? }`）
  - `backend/src/requirements/prototype-spec.test.ts`（新增 13 项：解析 5、重试/中止/抛错 7、HTTP 1）
  - `frontend/src/requirements/api.ts`（`DocApiError.detail`，`request()` 透出 `payload.detail`）
  - `frontend/src/requirements/prototype-spec-helpers.js`（`specErrorOf` + `SPEC_ERROR_DETAIL_LIMIT`）
  - `frontend/src/requirements/prototype-spec-helpers.test.mjs`（新增 2 项：有无 detail / 超长截断）
  - `frontend/src/requirements/RequirementsPrototypePreview.vue`（错误卡下可折叠「模型输出片段（前 300 字）」`<pre data-testid="prototype-spec-error-detail">`，240px 内部滚动 + 自动换行；无 detail 不渲染）
  - `docs/STATUS.md`（末尾追加「M7-2b 完成」）
- 测试：
  - 后端 `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`）：**310/310**（基线 295，**新增 15**；含评审后补的解析边界 2 项）
  - 前端 `npm test --prefix frontend`：**167/167**（基线 165，**新增 2**）
  - 覆盖：分隔符后多 JSON 取最靠后 / 前后噪声 / BOM / ```json 围栏 / CRLF / 尾逗号 / 字符串内未转义换行 / 全角引号 / 嵌套只取顶层 / 截断不补括号→502；第一次垃圾第二次合法（调用 2 次）/ 两次垃圾→502 + detail 头尾截断 / `retry:false` 只调用 1 次 / 第一次空输出 / 第一次无实体 / 中止 499 不重试 / 模型抛错 502 不重试 / HTTP 502 带 detail 且成功响应结构不变。
- 静态检查：`build --prefix backend`、`build --prefix frontend`、`typecheck`、`check:vue` 全部通过（`backend/dist`、`frontend/dist` 已重写）。
- 冒烟/Playwright：`smoke:requirements` / `smoke:modules` / `smoke:design` / `smoke:design-handoff` / `smoke:change-set` 全部通过（各自临时目录/端口）；Playwright（临时 data/projects + 端口 3443/4443 + stub 生成器）**45/45 断言**，0 console/page error、0 意外 API≥400（2 次预期 502 已剔除）、0 页面级横向溢出；断言：① 第一次垃圾第二次合法 → 1 次 POST 200、无错误卡；② 两次垃圾 → 502 + 展开片段文本/长度≤301/`max-height:240px`/`overflow:auto`/`pre-wrap`、旧规格不被覆盖；③ 重新生成（二次确认）、stale、生成中禁用+取消回归不破。脚本：`C:\Users\icecream\AppData\Local\Temp\opencode\m72b-pw\`；截图：`C:\Users\icecream\AppData\Local\Temp\opencode\m72b-e2e-2026-11-17T03-06-21\screens\`（6 张）。
- 偏差：
  1. 两次失败文案沿用最后一次语义文案再追加「（已自动重试 1 次）」（如「模型没有产出可预览的页面，请重试（已自动重试 1 次）」）；纯解析失败场景与交接单文案一致；`retry:false` 不加后缀。
  2. 候选解析「顶层对象优先」：优先返回含 `entities`/`pages` 的对象，避免噪声 `{…}` 抢先；都不含时退回最后一个**顶层完整**可解析对象。
  3. **评审后补（解析边界）**：顶层候选之外增加「后缀候选」（每个字符串外 `{` 起点单独深度匹配，仅最靠后 60 个、单候选 >200KB 跳过），修复「分隔符后先未闭合残片、再完整 JSON」时无法解析的问题；合并后去掉被包含的嵌套对象，且只有顶层完整对象可作为非规格回退（截断且无完整对象仍 `null`/502）。
  4. 测试同步 +2：「未闭合残片 + 完整 JSON → 成功」「未闭合残片 + 无完整 JSON → null」，原有解析用例全部回归通过。
- 未验证：真实模型 E2E（由主会话另跑；本轮未调真实模型）；真实 3300 仍为旧进程（`dist` 已重写，需 `stop.cmd` → `start.cmd` 才能生效）；`<768` 移动端与多实例并发沿用既有范围。真实 3300 / `data/` / `projects/` / `.env` / app1 **未触碰**。
