# 布局优化 + 接口同轮生成（O1—O3）实施 brief（2026-11-23）

> 状态：**已实施（待评审）**。范围：需求/设计视图布局（左对话 + 可拖拽宽度）、接口设计与 entities/pages 同轮生成、回归与文档。
> **未调真实模型、未启停真实 3300/4771、未读写真实 `data/`/`projects/`/`.env`、未做 git。**

## 1. 已确认决策

- 需求：删除左侧章节大纲，仅「左 AI 对话（可拖拽）+ 右需求文档」；文档自带 TOC（`doc-toc`）继续使用。
- 设计：左 AI 对话 + 中「页面集/实体」+ 右设计主区（ER / 页面集 / 接口设计三 Tab）。
- 对话默认 380px、最小 300px；需求文档 ≥520px；设计主区+中栏 ≥740px；最大宽度按容器动态限制。
- ≤1024：对话为左侧抽屉；设计另有「页面集」左抽屉，二者互斥；Esc 关闭；主区/文档占满。
- 宽度 localStorage 记忆；双击分隔条恢复默认；键盘 ←/→（Home/End）调整；分隔条 `role=separator`。
- 接口设计必须与 entities/pages 同轮生成；`generate-api-design` 只作“补/更新接口设计”。

## 2. 改动

### O1 首轮需求报错 + 接口同轮生成

- `backend/src/chat/service.ts`：需求 prompt 明确“设计产物可能尚未生成；不要主动读取不存在的设计文件；只有用户明确要求同步且文件存在时才读；不存在正常”；设计 prompt 明确“api-design.md 必须同轮生成，不要只生成 entities/pages”，列出 `adw-design-artifacts` / `adw-api-design` 与两个 validator。
- `adw-requirements-document/SKILL.md`、`update-requirements.md`：设计文件仅在存在且需要同步时读取；不存在跳过、不报错、不创建空设计文件。
- `generate-design.md`：一次生成三份文件；读 `adw-api-design` conventions/template/example；写完页面同轮写接口；运行两个 validator。
- `adw-design-artifacts/SKILL.md`：description/正文改为三份设计文件；第 1 节要求加载/参考 `adw-api-design`；新增「3.5 接口设计（同轮生成）」；自查同时跑两个脚本。
- `adw-api-design/SKILL.md`：注明设计阶段通常由 `adw-design-artifacts` 同轮调用，单独更新才用 `generate-api-design`；命令改名“补/更新接口设计”。
- 前端：`DesignView` 空态/示例改为一次生成实体/页面集/接口设计；`ApiDesignPanel` 空态文案与按钮改“补生成/补更新”；`view-commands` label 改“补/更新接口设计”；`chat-empty.js` 示例同步。
- e2e：`p2-e2e-harness` 的 `generate-design` stub 同轮写合法 `api-design.md`（5 接口，覆盖 product 实体 CRUD 与页面动作）；`p3-e2e` 生成后校验接口 Tab 有文档/摘要，不再断言空态。

### O2 布局 + 可拖拽对话

- 新增 `frontend/src/shared/chat-resize.js`（`clampChatWidth`、`readStoredChatWidth`、`keyboardChatWidth` + 常量）、`useChatResize.ts`（pointer/resize/localStorage/键盘/双击/清理）、`SplitHandle.vue`（`role=separator`、aria、6px、hover/focus、col-resize）。
- `RequirementsView.vue`：删除 `RequirementsOutline`（文件已删除）、工具栏“大纲”按钮、`outlineOpen`/`toggleOutline`/`scrollToAnchor`/`toc`；DOM 改为 chat + SplitHandle + doc；grid `var(--chat-width) 6px minmax(0,1fr)`；窄屏 chat 左抽屉。
- `DesignView.vue`：DOM 改为 chat + SplitHandle + 页面集/实体 + main；grid `var(--chat-width) 6px 260px minmax(0,1fr)`（≤1280 中栏 230）；窄屏 chat 与页面集均为左抽屉且互斥，Esc/mask；chat 从左滑入。
- 默认 380 / min 300；需求 otherMin 526（520+6）；设计 otherMin 746（260+480+6），动态上限由容器宽度计算。
- 测试：`chat-resize.test.mjs`（clamp 边界/otherMin/键盘/持久化容错）；p2/p3 新增两栏/三栏、拖动、双击复位、窄屏左抽屉/Esc 断言；p2 大纲断言改为 `doc-toc`/文档文本。

### O3 回归 + 文档

- 新增本 brief；`docs/STATUS.md`、`docs/plans/README.md` 更新本轮记录；`AGENTS.md`/`README.md` 当前布局/接口生成/回归口径更新。
- `docs/report/**` **未更新**（按要求不重截图、不改汇报口径）。

## 3. 命令与结果（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix backend`（临时 RG 目录） | **235 / 235** |
| `npm test --prefix frontend` | **186 / 186**（新增 chat-resize 5 项） |
| `npm run typecheck --prefix frontend` / `check:vue` | 通过 |
| `npm run build --prefix backend` / `frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过 |
| `npm run smoke:assets --prefix backend` | 通过（opencode 2.2.5 / 4719，不调模型；6 command） |
| `e2e:p2` | **95** 条断言 |
| `e2e:p3` | **138** 条断言 |
| `e2e:p4` | **135** 条断言 |
| `e2e:preview` / `p7-3b` / `p7-4b` | **93 / 77 / 57** |
| `e2e:p9` / `p10` / `p7-6a` | **79 / 81 / 21** |
| `e2e:p7-7b` / `p7-7c` / `api-design` | **73 / 118 / 26** |
| `npx tsx scripts/ui1b-shots.ts` | **11** 张，9 次无溢出 |
| `npx tsx scripts/ui2a-shots.ts` | **10** 张，10 次无溢出（evidence 已覆盖） |
| `npx tsx scripts/ui2b-shots.ts` | **7** 张，7 次无溢出（evidence 已覆盖） |
| `npx tsx scripts/ui3a-shots.ts` | **13** 张，12 次无溢出（evidence 已覆盖） |
| `npx tsx scripts/ui3b-shots.ts` | **23** 张，22 次无溢出，17 次口径测量（evidence 已覆盖） |

e2e/UI 截图均为临时目录 + 独立端口 + stub opencode（不调模型）。

## 4. 偏差

- `design-module-loading` 的替代沿用 D3 的 `design-outline-loading`；本次需求删除 `requirements-outline` 后，p2 改为断言 `doc-toc`/文档文本与“无 requirements-outline”。
- 设计主区宽度较改造前少 6px（新增分隔条），p9/p10 断言未变化。
- `p2` 断言数 101→95（新增 2.8—2.11 布局/拖动/复位，删除大纲项；实跑稳定为 95）；`p3` 129→138（新增布局/拖动/复位与接口同轮生成断言）。
- `p3` 测试未知实体 warning 时临时把 `api-design.md` 改名为 `.stale`，避免接口文档 errors 占用提示条前 3 行；测试后恢复。
- 需求视图空态/加载骨架不再有左侧大纲骨架；`ui2a` 已同步。
- 设计接口面板在既有 `api-design` 时主按钮“补/更新接口设计”，空态“补生成接口设计”。

## 5. 未验证

- **真实模型闭环未执行（需用户另行授权）**。
- 真实 3300/4771 视觉验收：本轮只读核对（用户已在 **17:00:43** 重启：3300 PID **19900** / 4771 PID **13484**，`/api/health` **200**；非本轮启停）。当前 `backend/dist` **17:31:07**、`frontend/dist` **17:27:02**，**运行进程早于本轮构建**，需用户再次 `restart.cmd`/`restart.sh` 后再验收。
- `docs/report/**` 未更新/未重截。
- 真实 AFCenter 宿主 `pm-*`、EOS 构建/运行、真实 401/403 未验证；旧应用硬切不提供迁移。
