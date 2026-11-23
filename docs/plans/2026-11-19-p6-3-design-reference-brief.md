# P6-3 实施交接单：设计参考包（2026-11-19）

> 上游：`docs/plans/2026-11-18-agent-first-workbench-p6-design.md` §3。
> P6-1/P6-2 已完成并通过评审（后端 82/82、前端 54/54、e2e 116/104/91、模板 skill 实测加载）。
> 本轮只做 **P6-3**；P6-4（回归/报告/STATUS 收尾）另开。
> 真实 3300 不启停；真实 `data/`/`projects/`/`.env` 不读写；不做 git；不调真实模型（主会话另跑）。

---

## 0. 出口标准

1. 设计视图打开、`design.json` hash 变化 → **1s 防抖自动导出**全部页面 PNG 到工作区；手动「重新导出」兜底。
2. 工作区生成：
   ```
   docs/design/<MOD>/
   ├─ design.json
   ├─ design-brief.md          # 设计 agent 写（本轮只加 skill 要求；不校验格式）
   ├─ tokens.json              # 工作台从原型模板确定性写入
   └─ prototypes/
      ├─ _manifest.json        # {designHash, templateId, exportedAt, pages:{id:{file,hash,exportedAt}}}
      └─ <page-id>.png
   ```
3. 过期：manifest.designHash ≠ 当前 `design.json` hash → 设计视图黄条「原型图已过期」+ 重新导出；开发 prompt 明确“结构以 design.json 为准，PNG 过期先说明”。
4. 新增唯一后端接口 `POST /api/apps/:id/design/:module/prototypes`（base64 PNG + designHash + templateId），校验 hash/PNG 魔数/大小/路径；写 PNG、manifest、tokens.json。
5. `GET /api/apps/:id/artifacts` 的 `designs[]` 增加只读：`prototypes{designHash,templateId,exportedAt,stale,pages[]}`、`brief{exists,file}`、`tokens{exists,templateId}`。
6. 开发 prompt（`buildViewPrompt('development')`）与应用 `AGENTS.md` 明确必读：需求、`design.json`、`design-brief.md`、`tokens.json`、`prototypes/*.png`；优先级与边界（EOS 后端不吃风格）。
7. 设计 skill：写完/改完 `design.json` 维护 `design-brief.md`；说明 tokens/prototypes 由工作台生成、不要手改。
8. `check-consistency` 增加“设计页面/字段 vs 代码页面/字段”差异清单（只报告，不门禁）。
9. 测试：后端接口校验/写入/stale；前端导出 helper + 自动导出 e2e（真渲染）；三视图回归；真实模型验收（主会话）。

## 1. 不做

- 版本/确认/变更单/交接包/门禁。
- 原型图片的模型生成（PNG 只来自前端渲染）。
- 设计页在线编辑器；P6-4 收尾。
- 旧应用迁移（当前 `apps=0`）。

## 2. 后端

### 2.1 新接口

`POST /api/apps/:id/design/:module/prototypes`

```jsonc
{
  "designHash": "sha256(design.json 内容)",
  "templateId": "builtin-prototype-enterprise",
  "pages": [{ "id": "product-list", "dataUrl": "data:image/png;base64,..." }]
}
```

校验与行为：
- app/module 存在；module 形如 `MOD-\d{3,}`；`docs/design/<MOD>/design.json` 存在。
- `designHash` 必须等于当前文件 sha256，否则 **409**（防过期写入）。
- `templateId` 必须存在（原型模板库）。
- pages 1—80；`id` 只允许 `[A-Za-z0-9._-]{1,80}`；单页 PNG ≤5MB、总量 ≤40MB；base64 解码后魔数 `89 50 4E 47`。
- 写入 `prototypes/<id>.png`；删除 manifest 中不再存在的旧 PNG；写 `_manifest.json`、`tokens.json`（`{templateId,name,tokens,shell}`）。
- 返回 `{ok, manifest}`；失败 4xx 带可读原因；不抛 500。

### 2.2 artifacts 扩展（只读）

`DesignArtifact` 增加：
```ts
prototypes?: { designHash: string; templateId: string; exportedAt: string; stale: boolean; pages: Array<{id,file,hash}> }
brief?: { exists: boolean; file: string }
tokens?: { exists: boolean; templateId?: string }
```
- `stale = manifest.designHash !== hash(design.json)`；无 manifest 时 `prototypes` 为空。
- 不触发生成/写入。

### 2.3 tokens.json

- 由接口写入（以 `templateId` 解析原型模板，取 `tokens/shell`）。
- 不调用模型；模板更新后下次导出会覆盖。

## 3. 前端

### 3.1 自动导出（设计视图）

- 条件：设计视图可见、当前模块有 `design.json`、原型模板可用；`design.json` hash 变化/首次进入 → 1s 防抖。
- 逐页离屏渲染（隐藏的 `PrototypeCanvas`，切页 + `nextTick`）→ `captureElementPng`（scale=2）→ 收集 dataURL → 调接口。
- 导出中禁用重复导出；成功后刷新 artifacts（显示 manifest/时间）；失败显示错误条，不阻塞视图。
- 手动「重新导出」按钮；仅导出当前模块。
- 过期黄条：`design.prototypes.stale` → 「原型图已过期，请重新导出」+ 按钮。

### 3.2 设计摘要/面板

- 显示 `brief 已生成/未生成`、`tokens 已生成/未生成`、`原型 N 页 · 导出时间`。
- 保留现有单页下载 PNG（浏览器下载）。

## 4. 设计/开发 skill 与 prompt

- `adw-design-artifacts/SKILL.md`：
  - 写完/改完 `design.json` 后维护 `docs/design/<MOD>/design-brief.md`（自由文本：概览/导航/页面/组件/风格；颜色间距引用 `tokens.json`）。
  - `tokens.json`、`prototypes/*.png` 由工作台生成，不要手改；设计变更后提醒用户/导出。
- `buildViewPrompt('development')`：
  - 必读：`docs/requirements/`、`docs/design/<MOD>/design.json`、`design-brief.md`、`tokens.json`、`prototypes/*.png`。
  - 优先级：需求 > design.json 结构 > brief/tokens/PNG 风格；PNG 过期（manifest hash 不匹配）先说明，不盲从。
  - 边界：tokens 只约束 Vue3 前端；EOS 后端不吃风格。
- 应用 `AGENTS.md`：新增“设计参考”段（路径 + 优先级 + 边界）。
- `check-consistency`：增加设计页面/字段 vs 代码页面/字段差异清单（只报告）。

## 5. 测试与验收

| 项 | 要求 |
| --- | --- |
| 后端单测 | 接口：正常写入/manifest/tokens；hash 不匹配 409；非法 PNG/超限/非法 page id/路径穿越 400；模块不存在 404；删除旧 PNG；artifacts stale 计算 |
| 前端单测 | 导出 payload/顺序、manifest 解析、stale 判断、页面 id 安全化（抽 `design-export.js` 纯函数） |
| e2e:p3 扩展 | 打开设计 → 自动导出（真渲染 PNG + manifest）；改 `design.json` → 黄条过期 → 手动重导消失；导出失败提示；`design-brief`/tokens 状态；深浅色/响应式不回归 |
| e2e:p4 扩展 | stub harness 捕获开发 prompt：包含 design.json/brief/tokens/prototypes 路径与优先级 |
| 回归 | 后端 82+、前端 54+、build/typecheck/check:vue、三个 smoke、e2e 116/104/91 全过 |
| 真实模型（主会话） | 新建应用 → 需求 → 设计（导出 PNG/brief/tokens）→ 开发实现；断言关键字段/路由存在；人工截图比对布局/导航/主色/间距“可辨认一致”；记录差异 |

## 6. 风险

1. **PNG 过期** → manifest hash + UI 黄条 + 开发 prompt 优先级；自动导出打开时补导。
2. 自动导出性能/闪烁 → 离屏渲染、逐页串行、导出中禁用按钮；上限 80 页。
3. 上传体积 → 5MB/页、40MB/总；超限提示，不写半成品（先校验全部再落盘）。
4. 路径安全 → page id 白名单 + `path.resolve` 前缀检查；module 白名单。
5. 渲染与模板不一致 → 导出与设计视图使用同一 `PrototypeCanvas`/模板；导出失败保留旧 PNG 并显示错误。
6. design-brief 缺失 → 不阻塞；设计摘要提示“未生成”，开发 prompt 仍以 design.json 结构为准。
7. 旧 PNG 残留 → 写入前按本次 pages 删除 manifest 中多余的 PNG。

---

## 7. 实施结果（2026-11-19）

### 7.1 改动文件

**后端**

- 新增 `backend/src/design/prototypes.ts`：`decodePngDataUrl`、`writePrototypePackage`、`readPrototypeManifest`、`readPrototypeArtifact`、brief/tokens 只读。
- `backend/src/workspace/artifacts.ts`：`DesignArtifact` 增加 `prototypes/brief/tokens`（只读）。
- `backend/src/apps/routes.ts`：新增 `POST /:id/design/:module/prototypes`。
- `backend/src/chat/service.ts`：development prompt 增加设计参考包、优先级、EOS 边界；design prompt 增加 brief/tokens/PNG 受管说明。
- `backend/src/dev/service.ts`：`DEFAULT_DEV_PROMPT` 同步设计参考包。
- `backend/src/apps/scaffold.ts`：应用 `AGENTS.md` 新增“设计参考（开发）”段。
- `backend/package.json`：测试清单加入 `design/reference.test.ts`。

**前端**

- 新增 `frontend/src/design/design-export.js` + `design-export.test.mjs`。
- `frontend/src/workbench/api.ts`：参考包类型 + `savePrototypePackage`。
- `frontend/src/workbench/DesignView.vue`：自动/手动导出、离屏逐页渲染、过期黄条、失败条/重试、brief/tokens/页数/导出时间、导出状态。
- `frontend/package.json`：测试清单加入 `design-export.test.mjs`。

**skill / command / e2e**

- `templates/agent/skills/adw-design-artifacts/SKILL.md`：维护 `design-brief.md`；tokens/PNG 受管。
- `templates/agent/commands/generate-design.md`：同步 brief/tokens 要求。
- `templates/agent/commands/check-consistency.md`：设计 vs 代码差异清单（只报告）。
- `backend/scripts/p3-e2e.ts`：自动导出、PNG 尺寸/hash/manifest/tokens、过期→手动重导、失败提示。
- `backend/scripts/p4-e2e.ts`：开发 prompt 含 design.json/brief/tokens/prototypes、优先级、EOS 边界。

### 7.2 验证

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **88 / 88**（P6-3 +6） |
| `npm test --prefix frontend` | **59 / 59**（P6-3 +5） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run smoke:workspace` | 通过 |
| `npm run smoke:assets` | 通过（真实 opencode 2.2.5 / 4719，不调模型） |
| `npm run smoke:dev` | 通过（真实 opencode 2.2.5 / 4724，不调模型） |
| `npm run e2e:p2` | **116** |
| `npm run e2e:p3` | **126**（原 104） |
| `npm run e2e:p4` | **97**（原 91） |

### 7.3 偏差 / 未验证

- 偏差：`runExport` 开始前重新读取 artifacts，渲染后再次比对 design hash（避免 409/旧图覆盖）；自动导出失败后同 hash 不自动重试；e2e 失败提示通过拦截接口 500 验证，并只在该窗口忽略对应错误审计。
- 未验证：真实模型全链路（需求 → 设计参考包 → 开发）与人工截图风格比对；非 headless 浏览器离屏导出；真实 3300/EOS 运行态。
- 环境：未启停真实 3300；未读写真实 `data/`/`projects/`/`.env`；未执行 git；未调用真实模型。
