import assert from 'node:assert/strict'
import test from 'node:test'
import {
  composerPlaceholderFor,
  contextPillsFor,
  emptyCopyFor,
  emptyExamplesFor,
  emptyHintFor,
  viewLabelOf
} from './chat-empty.js'

test('视图标签：三视图 + 工作室；未知走开发兜底', () => {
  assert.equal(viewLabelOf('requirements'), '需求视图')
  assert.equal(viewLabelOf('design'), '设计视图')
  assert.equal(viewLabelOf('development'), '开发视图')
  assert.equal(viewLabelOf('template'), '模板工作室')
  assert.equal(viewLabelOf('nope'), '开发视图')
  assert.equal(viewLabelOf(undefined), '开发视图')
})

test('示例 prompts：每个视图 3 条且互不相同；开发/未知共用兜底', () => {
  for (const view of ['requirements', 'design', 'template', 'development']) {
    const list = emptyExamplesFor(view)
    assert.equal(list.length, 3, `${view} 示例 3 条`)
    assert.equal(new Set(list).size, 3, `${view} 示例不重复`)
    for (const item of list) assert.equal(typeof item, 'string')
  }
  assert.deepEqual(emptyExamplesFor('nope'), emptyExamplesFor('development'))
  // 返回副本：调用方修改不影响下次默认值
  const first = emptyExamplesFor('design')
  first.push('x')
  assert.equal(emptyExamplesFor('design').length, 3)
})

test('需求视图 AI 示例与需求视图中央空态不重复（AI 专属问法）', () => {
  // 与 RequirementsView.vue 的 EXAMPLE_PROMPTS 对照：两处同屏，文案不得重复
  const central = [
    '按模板补全需求文档，重点写目标与验收标准。',
    '新增一个「订单管理」Epic，包含下单、支付、发货三个用户故事。',
    '检查需求文档与设计（实体/页面集）是否一致，列出具体差异。'
  ]
  const ai = emptyExamplesFor('requirements')
  assert.equal(ai.length, 3)
  for (const item of ai) {
    assert.equal(central.includes(item), false, `AI 示例不应与中央空态重复：${item}`)
  }
  assert.match(ai[0], /还缺哪些 Epic/)
  assert.match(ai[1], /章节骨架/)
  assert.match(ai[2], /缺失的验收标准/)
})

test('空态说明/占位：按视图默认，需求与设计文案不同', () => {
  assert.match(emptyHintFor('requirements'), /需求对话/)
  assert.match(emptyHintFor('design'), /设计对话/)
  assert.match(emptyHintFor('template'), /catalog/)
  assert.match(emptyHintFor('development'), /AGENTS/)
  assert.equal(emptyHintFor('unknown'), emptyHintFor('development'))

  assert.match(composerPlaceholderFor('requirements'), /^给需求 agent 发消息/)
  assert.match(composerPlaceholderFor('design'), /^给设计 agent 发消息/)
  assert.match(composerPlaceholderFor('template'), /^给模板工作室 agent 发消息/)
  assert.match(composerPlaceholderFor('development'), /^给开发 agent 发消息/)
  assert.match(composerPlaceholderFor('design'), /Enter 发送 · Shift\+Enter 换行$/)
})

test('空态标题/CTA：无会话=开始与新会话；有会话=第一条消息与聚焦', () => {
  assert.deepEqual(emptyCopyFor({ hasSession: false }), {
    title: '开始与 AI 协作',
    cta: '新会话',
    action: 'new-session'
  })
  assert.deepEqual(emptyCopyFor({ hasSession: true }), {
    title: '发送第一条消息',
    cta: '发送第一条消息',
    action: 'focus'
  })
  // 缺省（不传）按无会话处理
  assert.equal(emptyCopyFor().title, '开始与 AI 协作')
})

test('上下文 pills：视图必有；工作室 pack 按需；模块已移除', () => {
  const plain = contextPillsFor({ view: 'requirements' })
  assert.equal(plain.length, 1)
  assert.equal(plain[0].key, 'view')
  assert.equal(plain[0].label, '需求视图')

  const design = contextPillsFor({ view: 'design' })
  assert.equal(design.length, 1)
  assert.equal(design[0].label, '设计视图')

  const studio = contextPillsFor({ view: 'template', packId: 'goods-hub' })
  assert.equal(studio.length, 2)
  assert.equal(studio[1].key, 'pack')
  assert.match(studio[1].label, /goods-hub/)
  // 非工作室视图不显示 pack（即使传了）
  assert.equal(contextPillsFor({ view: 'design', packId: 'goods-hub' }).length, 1)
})
