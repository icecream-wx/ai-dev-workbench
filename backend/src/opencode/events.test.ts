import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EventHub,
  createSseParser,
  matchesFilter,
  normalizeEvent,
  parseSseFrame,
  type OpencodeEvent
} from './events'

function textDelta(sessionID: string, delta: string): OpencodeEvent {
  return { type: 'session.text.delta', data: { sessionID, delta }, location: { directory: 'E:\\apps\\a' } }
}

test('parseSseFrame 解析 data 行', () => {
  const event = parseSseFrame('event: message\ndata: {"type":"session.text.delta","data":{"sessionID":"s1","delta":"你"}}')
  assert.equal(event?.type, 'session.text.delta')
  assert.equal(event?.data?.delta, '你')
})

test('parseSseFrame 忽略无 data / 非法 JSON', () => {
  assert.equal(parseSseFrame(': ping'), null)
  assert.equal(parseSseFrame('data: not-json'), null)
})

test('createSseParser 处理跨 chunk 半帧', () => {
  const seen: string[] = []
  const parser = createSseParser(event => seen.push(event.type))
  parser.push('data: {"type":"session.text.del')
  parser.push('ta","data":{"sessionID":"s1"}}\n\n')
  parser.push('data: {"type":"session.text.ended","data":{"sessionID":"s1"}}\n\n')
  assert.deepEqual(seen, ['session.text.delta', 'session.text.ended'])
})

test('normalizeEvent 兼容 event 字段', () => {
  assert.equal(normalizeEvent({ event: 'session.idle', data: {} })?.type, 'session.idle')
  assert.equal(normalizeEvent({ data: {} }), null)
})

test('matchesFilter 按 sessionID 过滤', () => {
  assert.equal(matchesFilter(textDelta('s1', 'a'), { sessionID: 's1' }), true)
  assert.equal(matchesFilter(textDelta('s2', 'a'), { sessionID: 's1' }), false)
})

test('matchesFilter 按目录过滤并忽略 Windows 分隔符/大小写', () => {
  const filter = { directory: 'e:/apps/A' }
  assert.equal(matchesFilter(textDelta('s1', 'a'), filter), process.platform === 'win32')
  assert.equal(matchesFilter(textDelta('s1', 'a'), { directory: 'E:\\other' }), false)
})

test('EventHub 只把匹配事件推给订阅者，并可取消订阅', () => {
  const hub = new EventHub(10)
  const received: string[] = []
  const unsubscribe = hub.subscribe({ sessionID: 's1' }, event => received.push(String(event.data?.delta)))
  hub.publish(textDelta('s1', 'first'))
  hub.publish(textDelta('s2', 'other'))
  hub.publish(textDelta('s1', 'second'))
  unsubscribe()
  hub.publish(textDelta('s1', 'ignored'))
  assert.deepEqual(received, ['first', 'second'])
  assert.equal(hub.recent().length, 4)
})

test('EventHub 环形缓冲不超过上限', () => {
  const hub = new EventHub(2)
  hub.publish(textDelta('s1', 'a'))
  hub.publish(textDelta('s1', 'b'))
  hub.publish(textDelta('s1', 'c'))
  assert.equal(hub.recent().length, 2)
})
