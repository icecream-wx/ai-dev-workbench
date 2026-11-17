import assert from 'node:assert/strict'
import test from 'node:test'
import {
  displayTitle,
  filterSessions,
  formatSessionTime,
  groupSessions,
  groupTitle,
  handoffVersionMismatch,
  handoffWarning,
  modelShort,
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
    status: 'archived',
    changeSetId: 'cs-1',
    changeSetSeq: 1,
    changeSetTitle: '初始开发',
    changeSetStatus: 'completed',
    handoffVersion: 1
  },
  {
    id: 'b',
    title: '新客户等级',
    note: '',
    displayTitle: '新客户等级',
    opencodeTitle: 'opencode B',
    createdAt: '2026-11-11T03:00:00.000Z',
    lastActiveAt: '2026-11-11T04:00:00.000Z',
    status: 'active',
    changeSetId: 'cs-2',
    changeSetSeq: 2,
    changeSetTitle: '新增客户等级',
    changeSetStatus: 'development',
    handoffVersion: 2
  },
  {
    id: 'c',
    title: '',
    note: '',
    displayTitle: '应用 · 11-09 10:00',
    opencodeTitle: '',
    createdAt: '2026-11-09T02:00:00.000Z',
    lastActiveAt: null,
    status: 'stale',
    changeSetId: null,
    changeSetSeq: null,
    changeSetTitle: null,
    changeSetStatus: null,
    handoffVersion: null
  }
]

test('groupSessions：变更单 seq 倒序、早期会话置底、组内创建时间倒序', () => {
  const groups = groupSessions(sessions)
  assert.deepEqual(groups.map(group => group.key), ['cs:cs-2', 'cs:cs-1', 'early'])
  assert.equal(groups[0].label, '变更 #2 · 新增客户等级')
  assert.equal(groups[0].statusLabel, '开发中')
  assert.equal(groups[0].handoffVersion, 2)
  assert.equal(groups[0].active, true)
  assert.equal(groups[1].label, '初始开发')
  assert.equal(groups[2].label, '早期会话')
  assert.equal(groups[2].handoffVersion, null)
})

test('groupSessions：同组多会话按创建时间倒序，组头版本取最大值', () => {
  const groups = groupSessions([
    { ...sessions[0], id: 'old', createdAt: '2026-11-10T01:00:00.000Z', handoffVersion: 1 },
    { ...sessions[0], id: 'new', createdAt: '2026-11-11T01:00:00.000Z', handoffVersion: 3 }
  ])
  assert.equal(groups.length, 1)
  assert.deepEqual(groups[0].sessions.map(item => item.id), ['new', 'old'])
  assert.equal(groups[0].handoffVersion, 3)
})

test('groupTitle：初始开发 / 变更 #N / 早期会话', () => {
  assert.equal(groupTitle(1, '初始开发'), '初始开发')
  assert.equal(groupTitle(1, ''), '初始开发')
  assert.equal(groupTitle(3, '客户等级'), '变更 #3 · 客户等级')
  assert.equal(groupTitle(3, ''), '变更 #3')
  assert.equal(groupTitle(null, 'x'), '早期会话')
})

test('displayTitle 回退：工作台标题 → opencode 标题 → 后端 displayTitle → 应用名 · 时间', () => {
  assert.equal(displayTitle(sessions[1]), '新客户等级')
  assert.equal(displayTitle(sessions[0]), 'opencode A')
  assert.equal(displayTitle({ displayTitle: '应用 · 11-11 09:00' }), '应用 · 11-11 09:00')
  assert.match(displayTitle({ createdAt: '2026-11-11T01:00:00.000Z' }, '季度报表'), /^季度报表 · 11-11/)
  assert.equal(displayTitle({}, ''), '开发会话')
})

test('状态标签与模型简写', () => {
  assert.equal(sessionStatusLabel('active'), '进行中')
  assert.equal(sessionStatusLabel('archived'), '已归档')
  assert.equal(sessionStatusLabel('stale'), '已失效')
  assert.equal(sessionStatusLabel('other'), '未知状态')
  assert.equal(modelShort({ providerID: 'packycode-deepseek', id: 'deepseek-flash' }), 'deepseek-flash')
  assert.equal(modelShort(null), '默认模型')
})

test('搜索标题/备注忽略大小写；空搜索返回全部', () => {
  assert.deepEqual(filterSessions(sessions, '客户等级').map(item => item.id), ['a', 'b'])
  assert.deepEqual(filterSessions(sessions, 'OPENCODE A').map(item => item.id), ['a'])
  assert.deepEqual(filterSessions(sessions, '   ').map(item => item.id), ['a', 'b', 'c'])
  assert.deepEqual(filterSessions(sessions, '不存在的关键词'), [])
})

test('交接包版本差异：仅当两者都是数字且不同', () => {
  assert.equal(handoffVersionMismatch({ handoffVersion: 1 }, 2), true)
  assert.equal(handoffVersionMismatch({ handoffVersion: 2 }, 2), false)
  assert.equal(handoffVersionMismatch({ handoffVersion: null }, 2), false)
  assert.equal(handoffVersionMismatch({ handoffVersion: 1 }, null), false)
  assert.match(handoffWarning({ handoffVersion: 1 }, 2), /基于交接包 v1，当前交接包 v2/)
  assert.equal(handoffWarning({ handoffVersion: 2 }, 2), '')
})

test('时间格式与最后活跃时间', () => {
  assert.match(formatSessionTime('2026-11-11T01:02:00.000Z'), /^\d{2}-\d{2} \d{2}:\d{2}$/)
  assert.equal(formatSessionTime(''), '')
  assert.equal(sessionTimeLabel({ createdAt: '2026-11-11T01:00:00.000Z', lastActiveAt: null }), formatSessionTime('2026-11-11T01:00:00.000Z'))
  assert.equal(sessionTimeLabel({ createdAt: '2026-11-11T01:00:00.000Z', lastActiveAt: '2026-11-11T02:00:00.000Z' }), formatSessionTime('2026-11-11T02:00:00.000Z'))
})
