import assert from 'node:assert/strict'
import test from 'node:test'
import {
  displayTitle,
  filterSessions,
  formatSessionTime,
  groupSessions,
  modelShort,
  sessionStatusClass,
  sessionStatusLabel,
  sessionTimeLabel
} from './session-labels.js'

const sessions = [
  {
    id: 'a',
    title: null,
    note: '客户等级',
    displayTitle: '应用 · 11-11 09:00',
    opencodeTitle: 'opencode A',
    createdAt: '2026-11-11T01:00:00.000Z',
    lastActiveAt: null,
    status: 'archived'
  },
  {
    id: 'b',
    title: '新客户等级',
    note: '',
    displayTitle: '新客户等级',
    opencodeTitle: 'opencode B',
    createdAt: '2026-11-11T03:00:00.000Z',
    lastActiveAt: '2026-11-11T04:00:00.000Z',
    status: 'active'
  },
  {
    id: 'c',
    title: '',
    note: '',
    displayTitle: '应用 · 11-09 10:00',
    opencodeTitle: '',
    createdAt: '2026-11-09T02:00:00.000Z',
    lastActiveAt: null,
    status: 'stale'
  }
]

test('groupSessions：单一分组，按创建时间倒序', () => {
  const groups = groupSessions(sessions)
  assert.equal(groups.length, 1)
  assert.equal(groups[0].key, 'sessions')
  assert.equal(groups[0].label, '会话')
  assert.deepEqual(groups[0].sessions.map(item => item.id), ['b', 'a', 'c'])
  assert.equal(groups[0].active, true)
  assert.deepEqual(groupSessions([]), [])
})

test('displayTitle 回退：工作台标题 → opencode 标题 → 后端 displayTitle → 应用名 · 时间', () => {
  assert.equal(displayTitle(sessions[1]), '新客户等级')
  assert.equal(displayTitle(sessions[0]), 'opencode A')
  assert.equal(displayTitle({ displayTitle: '应用 · 11-11 09:00' }), '应用 · 11-11 09:00')
  assert.match(displayTitle({ createdAt: '2026-11-11T01:00:00.000Z' }, '季度报表'), /^季度报表 · 11-11/)
  assert.equal(displayTitle({}, ''), '会话')
})

test('状态标签/样式与模型简写', () => {
  assert.equal(sessionStatusLabel('active'), '进行中')
  assert.equal(sessionStatusLabel('archived'), '已归档')
  assert.equal(sessionStatusLabel('stale'), '已失效')
  assert.equal(sessionStatusLabel('other'), '未知状态')
  assert.equal(sessionStatusClass('active'), 'active')
  assert.equal(sessionStatusClass('other'), 'unknown')
  assert.equal(modelShort({ providerID: 'packycode-deepseek', id: 'deepseek-flash' }), 'deepseek-flash')
  assert.equal(modelShort(null), '默认模型')
})

test('搜索标题/备注忽略大小写；空搜索返回全部', () => {
  assert.deepEqual(filterSessions(sessions, '客户等级').map(item => item.id), ['a', 'b'])
  assert.deepEqual(filterSessions(sessions, 'OPENCODE A').map(item => item.id), ['a'])
  assert.deepEqual(filterSessions(sessions, '   ').map(item => item.id), ['a', 'b', 'c'])
  assert.deepEqual(filterSessions(sessions, '不存在的关键词'), [])
})

test('时间格式与最后活跃时间', () => {
  assert.match(formatSessionTime('2026-11-11T01:02:00.000Z'), /^\d{2}-\d{2} \d{2}:\d{2}$/)
  assert.equal(formatSessionTime(''), '')
  assert.equal(
    sessionTimeLabel({ createdAt: '2026-11-11T01:00:00.000Z', lastActiveAt: null }),
    formatSessionTime('2026-11-11T01:00:00.000Z')
  )
  assert.equal(
    sessionTimeLabel({ createdAt: '2026-11-11T01:00:00.000Z', lastActiveAt: '2026-11-11T02:00:00.000Z' }),
    formatSessionTime('2026-11-11T02:00:00.000Z')
  )
})
