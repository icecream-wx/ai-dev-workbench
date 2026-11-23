# 打磨批 1（2026-11-23）：mock 枚举多样性 + 预览 embed + pm-steps 交接单

> 状态：**已实施（待评审）**。范围只含 A / F1 / F2 三项前端打磨，不改后端源码、DB、`templates/**`、依赖；仅更新 `backend/scripts/` 下 e2e 断言。

## 目的

修复三处影响预览可信度/可用性的小问题：

1. 设计产物 mock 数据里，同一行多个枚举列显示同一项（例如「商品状态」与「审核状态」总是同步）。
2. 模板中心内置 pack 预览 iframe 未走 `embed=1`，iframe 内出现重复的风格切换器和 mock 角标（与自定义模板预览不一致）。
3. `pm-steps` 点击步条只 emit `clickStep`、不同步 `v-model`，向导类预览页点击步条不切内容。

## 范围

- **A. mock 枚举多样性**（纯函数 + 单测）
- **F1. 模板中心内置预览 embed**（URL 构造 + 模板中心 + 单测 + e2e 断言）
- **F2. pm-steps 点击步条同步 v-model**（pm-v3 副本 + e2e 断言）

不做：`preview.html`/`PreviewApp.vue` 业务语义、`statusClassOfValue`/dashboard/detail 模型、其它 pm-v3 组件、模板页源码。

## 改动文件

| 文件 | 改动 |
| --- | --- |
| `frontend/src/design-preview/contract-preview.js` | `mockFieldValue(field,index,offset=0)`：枚举取值 `(i+offset)%len`，非枚举类型忽略 offset；`mockRowsForEntity` 按实体枚举字段出现顺序计算 offset（首个 0，其后 1..n），确定性无随机 |
| `frontend/src/design-preview/contract-preview.test.mjs` | 新增 3 条：枚举 offset 与两参兼容、同行多枚举不同值 + 首个枚举分布/确定性、既有商品状态列分布回归 |
| `frontend/src/workbench/design-template-helpers.js` | `buildPreviewUrl({...,embed})`：true 追加 `embed=1`，默认 false |
| `frontend/src/workbench/DesignTemplateCenter.vue` | 内置 pack 预览传 `embed:true`（与自定义预览一致） |
| `frontend/src/workbench/design-template-helpers.test.mjs` | 新增 1 条 embed 单测（默认无 / true 含 `embed=1` 保留 type/style/page） |
| `frontend/src/design-system/pm-v3/components/pm-steps/pc.vue` | `clickFun` 先 `emit('update:modelValue', data?.value ?? index)` 再 `emit('clickStep', ...)`，加“预览适配（P7-9/F2）”注释 |
| `backend/scripts/preview-e2e.ts` | 新增第 8 段：模板向导页点击步条第 2/3/1 步断言分组切换（含理由注释） |
| `backend/scripts/design-template-e2e.ts` | 内置预览断言 iframe `embed=1` + frame 内无 `.preview-style-switch`/`.preview-badge` |
| `backend/scripts/template-png-e2e.ts` | wizard 段点击步条第 2/1 步断言当前分组切换 |

## 关键取舍

- **A**：offset 只作用于枚举，字符串/数字 mock 与 `initialFormValue` 不变；首个枚举字段 offset=0 是有意保留——状态标签配色、详情首行状态、dashboard 饼图都取首个枚举字段，避免语义漂移。
- **F1**：embed 走既有 `preview.html` 语义（P8-2），不新增参数；模板中心保留自己的风格切换，iframe 内重复控件消失。
- **F2**：`data.value ?? index` 同时兼容模板页 `value=1..4` 与 ContractPage wizard `value=0..n-1`；这是预览侧适配，与上游 `pm-steps` 的差异已知并注释。
- **F2 e2e 选页**：preview-e2e 选 `enterprise-application-platform/application-form`——点击步条直接切分组，绕开该页底部「下一步」的必填校验，稳定；p10 在既有 wizard fixture 上补点击步条断言，与底部按钮路径互补。

## 验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix frontend` | **182/182**（原 178，+4） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过（全部 SFC 导入完整） |
| `npm run build --prefix frontend` | 成功（exit 0） |
| `npm run e2e:preview --prefix backend` | **93**（原 83，+10） |
| `npm run e2e:p7-3b --prefix backend` | **42**（原 39，+3） |
| `npm run e2e:p7-7b --prefix backend` | **51**（不变） |
| `npm run e2e:p9 --prefix backend` | **70**（不变） |
| `npm run e2e:p10 --prefix backend` | **82**（原 79，+3） |
| `npm run e2e:p7-7c --prefix backend` | **108**（不变） |

e2e 均使用临时目录 + 独立端口 + stub opencode，结束后核对 3420—3455 / 4400—4500 无残留监听。未跑 `e2e:p3`（未改 P3 相关路径）。

## 偏差与未验证

- 真实 3300/4771 未启停；本批视觉变化需用户 `restart.cmd`/`restart.sh` 后人工验收。
- PNG 仍只校验宽高 + 主色采样，无像素级 diff。
- `pm-steps` 与上游行为差异仅存在于预览侧副本，未回写上游组件。
- 未改动 P7-7 的“已实施（待评审）”状态；本批不构成评审通过。
