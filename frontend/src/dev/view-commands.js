/**
 * 视图默认命令（纯函数，便于单测；AgentChatPanel 与空态按钮共用）
 *
 * - requirements：update-requirements（无参数）+ check-consistency
 * - design：generate-design（无参数）+ check-consistency
 * - development：不提供按钮
 */

const VIEW_COMMANDS = {
  requirements: [
    { name: 'update-requirements', label: '更新需求', args: 'none', testId: 'update' },
    { name: 'check-consistency', label: '检查一致性', args: 'none', testId: 'consistency' }
  ],
  design: [
    { name: 'generate-design', label: '生成/更新设计', args: 'none', testId: 'generate' },
    { name: 'generate-api-design', label: '补/更新接口设计', args: 'none', testId: 'api-design' },
    { name: 'check-consistency', label: '检查一致性', args: 'none', testId: 'consistency' }
  ],
  development: []
}

export function commandsForView(view) {
  const list = VIEW_COMMANDS[view]
  return Array.isArray(list) ? list : []
}

export function commandById(view, name) {
  return commandsForView(view).find(item => item.name === name) ?? null
}

/** 命令参数：去模块后所有命令无参数 */
export function commandArgs(_command) {
  return ''
}
