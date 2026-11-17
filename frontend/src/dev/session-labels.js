/**
 * I-10 开发会话列表纯逻辑：分组/排序/标题回退/状态/搜索/交接包版本差异。
 * 不依赖 Vue/DOM，便于 node --test 单测。
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
  return '开发会话'
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

export function changeSetStatusLabel(status) {
  const labels = {
    requirements: '需求中',
    design: '设计中',
    development: '开发中',
    completed: '已完成',
    cancelled: '已取消'
  }
  return labels[status] || ''
}

/** 分组标题：初始开发 / 变更 #N · 标题 / 早期会话 */
export function groupTitle(seq, title) {
  if (seq === null || seq === undefined) return '早期会话'
  const label = text(title)
  if (seq === 1 && (!label || label === '初始开发')) return '初始开发'
  return `变更 #${seq}${label ? ` · ${label}` : ''}`
}

function byCreatedDesc(a, b) {
  const left = new Date(a?.createdAt ?? 0).getTime() || 0
  const right = new Date(b?.createdAt ?? 0).getTime() || 0
  return right - left
}

/**
 * 按变更单分组：seq 倒序在前，无 changeSetSeq 归“早期会话”置底。
 * 组内按创建时间倒序；handoffVersion 取组内最大值用于组头版本标签。
 */
export function groupSessions(sessions) {
  const groups = new Map()
  for (const session of sessions ?? []) {
    const seq = typeof session?.changeSetSeq === 'number' ? session.changeSetSeq : null
    const key = seq === null ? 'early' : `cs:${session.changeSetId || seq}`
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        seq,
        changeSetId: session?.changeSetId ?? null,
        title: null,
        status: null,
        handoffVersion: null,
        sessions: []
      })
    }
    const group = groups.get(key)
    if (!group.title && text(session?.changeSetTitle)) group.title = text(session?.changeSetTitle)
    if (!group.status && text(session?.changeSetStatus)) group.status = text(session?.changeSetStatus)
    if (typeof session?.handoffVersion === 'number') {
      group.handoffVersion = group.handoffVersion === null ? session.handoffVersion : Math.max(group.handoffVersion, session.handoffVersion)
    }
    group.sessions.push(session)
  }
  for (const group of groups.values()) {
    group.sessions.sort(byCreatedDesc)
    group.label = groupTitle(group.seq, group.title)
    group.statusLabel = changeSetStatusLabel(group.status)
    group.active = group.sessions.some(session => session?.status === 'active')
  }
  return [...groups.values()].sort((left, right) => {
    if (left.seq === null && right.seq === null) return byCreatedDesc(left.sessions[0], right.sessions[0])
    if (left.seq === null) return 1
    if (right.seq === null) return -1
    if (left.seq !== right.seq) return right.seq - left.seq
    return byCreatedDesc(left.sessions[0], right.sessions[0])
  })
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

/** 会话交接包版本与当前交接包不同（仅两者都是数字时判断） */
export function handoffVersionMismatch(session, currentVersion) {
  const sessionVersion = session?.handoffVersion
  if (typeof sessionVersion !== 'number' || typeof currentVersion !== 'number') return false
  return sessionVersion !== currentVersion
}

export function handoffWarning(session, currentVersion) {
  if (!handoffVersionMismatch(session, currentVersion)) return ''
  return `该会话基于交接包 v${session.handoffVersion}，当前交接包 v${currentVersion}；继续可能使用旧上下文，建议新建会话。`
}
