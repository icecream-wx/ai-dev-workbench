/**
 * 会话列表纯逻辑：时间/标题回退/状态/搜索/分组。
 * 不依赖 Vue/DOM，便于 node --test 单测。
 *
 * 会话是可丢弃的工作记忆：没有交接包/变更单/阶段标签，列表按创建时间倒序。
 */

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function two(value) {
  return String(value).padStart(2, '0')
}

/** MM-DD HH:mm；无效时间原样返回 */
export function formatSessionTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return `${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`
}

/** 列表时间：最后活跃优先，回退创建时间 */
export function sessionTimeLabel(session) {
  return formatSessionTime(session?.lastActiveAt || session?.createdAt)
}

export function modelShort(model) {
  if (!model) return '默认模型'
  return text(model.id) || text(model.modelID) || text(model.providerID) || '默认模型'
}

/** 工作台标题 → opencode 标题 → 后端 displayTitle → 应用名 · 创建时间 */
export function displayTitle(session, appName = '') {
  const title = text(session?.title)
  if (title) return title
  const opencodeTitle = text(session?.opencodeTitle)
  if (opencodeTitle) return opencodeTitle
  const backendTitle = text(session?.displayTitle)
  if (backendTitle) return backendTitle
  const created = formatSessionTime(session?.createdAt)
  if (appName) return created ? `${appName} · ${created}` : appName
  return '会话'
}

export function sessionStatusLabel(status) {
  if (status === 'active') return '进行中'
  if (status === 'archived') return '已归档'
  if (status === 'stale') return '已失效'
  return '未知状态'
}

export function sessionStatusClass(status) {
  if (status === 'active') return 'active'
  if (status === 'archived') return 'archived'
  if (status === 'stale') return 'stale'
  return 'unknown'
}

function byCreatedDesc(a, b) {
  const left = new Date(a?.createdAt ?? 0).getTime() || 0
  const right = new Date(b?.createdAt ?? 0).getTime() || 0
  return right - left
}

/** 单一分组：会话按创建时间倒序（列表本身不需要按变更单/阶段分组） */
export function groupSessions(sessions) {
  const list = [...(sessions ?? [])].sort(byCreatedDesc)
  if (!list.length) return []
  return [
    {
      key: 'sessions',
      label: '会话',
      sessions: list,
      active: list.some(session => session?.status === 'active')
    }
  ]
}

/** 搜索标题/备注/opencode 标题，忽略大小写 */
export function filterSessions(sessions, query) {
  const needle = text(query).toLowerCase()
  if (!needle) return sessions ?? []
  return (sessions ?? []).filter(session => {
    const haystack = [session?.title, session?.note, session?.displayTitle, session?.opencodeTitle]
      .map(text)
      .join('\n')
      .toLowerCase()
    return haystack.includes(needle)
  })
}
