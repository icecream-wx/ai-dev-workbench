import assert from 'node:assert/strict'
import test from 'node:test'
import { extractJson } from './llm'

test('extractJson 支持纯 JSON / 代码围栏 / 前后解释', () => {
  assert.deepEqual(extractJson('{"a":1}'), { a: 1 })
  assert.deepEqual(extractJson('```json\n{"a":2}\n```'), { a: 2 })
  assert.deepEqual(extractJson('结果如下：\n{"a":3}\n以上。'), { a: 3 })
})

test('extractJson 拒绝非对象 / 缺失 JSON', () => {
  assert.throws(() => extractJson('没有 JSON'), /未找到/)
  assert.throws(() => extractJson('[1,2,3]'), /JSON|未找到/)
  assert.throws(() => extractJson('{bad}'), /JSON/)
})
