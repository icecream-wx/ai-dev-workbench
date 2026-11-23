/**
 * 视图默认命令（纯函数，便于单测；AgentChatPanel 与空态按钮共用）
 *
 * - requirements：update-requirements（带模块）+ check-consistency
 * - design：generate-design（带模块）+ check-consistency
 * - development：P4 再定（本版不提供按钮）
 */

const VIEW_COMMANDS = {
  requirements: [
    { name: 'update-requirements', label: '更新需求', args: 'module', testId: 'update' },
    { name: 'check-consistency', label: '检查一致性', args: 'none', testId: 'consistency' }
  ],
  design: [
    { name: 'generate-design', label: '生成/更新设计', args: 'module', testId: 'generate' },
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

/** 命令参数：带模块的命令传当前模块 key，其余为空 */
export function commandArgs(command, moduleKey) {
  if (!command) return ''
  return command.args === 'module' ? String(moduleKey ?? '').trim() : ''
}
