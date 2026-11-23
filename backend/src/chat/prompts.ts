/**
 * 统一 prompt 文案常量（P6-1）
 *
 * 面向用户的文字统一中文；代码、命令、标识符、文件路径允许英文。
 * 注入：buildViewPrompt 三个视图、DEFAULT_DEV_PROMPT、应用级 AGENTS.md、commands。
 */
export const CHINESE_INSTRUCTION =
  '所有面向用户的文字——回复、思考/进度说明、工具说明、汇报——一律使用中文；代码、命令、标识符、文件路径除外。'
