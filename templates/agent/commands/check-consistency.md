---
description: 检查需求文档、实体/页面集、设计参考包、代码与 ui-check 的一致性（应用级，只报告）
---

# 检查一致性

- 范围：`$ARGUMENTS` 为空表示全应用；可指定 Epic（`EP-001`）或页面集 id。
- 输入：`docs/requirements/requirements.md`、`docs/design/design-system.json`、
  `docs/design/entities.json`、`docs/design/pages.json`、
  `docs/design/design-brief.md`、`docs/design/tokens.json`、`docs/design/prototypes/*.png`、
  `docs/design/ui-check.md`、`docs/design/template/**`、`frontend/` 代码。
- 检查项：
  - 页面集 `epic` 是否存在、标题是否与 Epic 一致；
  - 页面字段引用（columns/filters/form/tree/subTables/components）是否都是实体字段 `code`；
  - 页面契约（recipe/catalogRef/blueprint/contracts）是否完整、蓝图/契约文件是否存在；
  - 需求 Epic/Story ↔ 页面集/页面 的覆盖情况；
  - design-brief/tokens/PNG 是否过期（`prototypes/_manifest.json` 的 designHash）；
  - ui-check 是否填写；
  - 代码实现与页面契约/蓝图的结构差异（只做静态/启发式判断）。
- 输出：按“文件/字段/证据 + 影响”列出问题与建议；只报告，不改代码、不自动修复。
- 完成后可提示用户在开发视图运行「检查一致性」（同一套 `check-fidelity` 规则，14 项）。
- 用中文汇报；不要执行任何 git 操作。
