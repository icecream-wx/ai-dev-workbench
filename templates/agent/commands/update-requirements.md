---
description: 更新应用唯一需求文档（单文档、Epic/Story），并与设计产物保持一致
---

# 更新需求

- 范围：`$ARGUMENTS` 为空表示按用户上一条消息判断；如需指定 Epic，可直接写 `EP-001`。
- 目标文件：`docs/requirements/requirements.md`（**唯一**需求文档；不要新建 `MOD-xxx-*.md`）。
- frontmatter 只保留 `title` / `template`；不要写 `module` / `order`。
- 章节结构以 `template` 对应的 `adw-template-req-<id>` skill 为准（`assets/template.md`）。
- Epic 用 `### EP-001 标题`、Story 用 `#### US-001 标题`；ID 稳定，不要重编号。
- 先读现有需求文档；设计文件（`docs/design/entities.json`、`pages.json`、`api-design.md`）**仅在存在且用户要求同步设计时才读**，不存在跳过、不报错、不创建空设计文件。
- 再增量修改；不要整篇重写，不要删掉用户已有内容。
- 用户明确要求同步设计时，加载 skill `adw-design-artifacts`，同步
  `docs/design/entities.json` / `pages.json` / `api-design.md`（页面集 `epic` 必须指向需求 Epic）。
- 完成后用中文汇报：改了哪些章节/Epic、与设计的同步点、待确认项。
- 不要修改 `.opencode/skills/**`、`.opencode/commands/**`；不要执行任何 git 操作。
