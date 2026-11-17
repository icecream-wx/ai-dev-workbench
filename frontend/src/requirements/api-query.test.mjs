import assert from 'node:assert/strict'
import test from 'node:test'
import { moduleQuery } from './api-query.js'

test('moduleQuery：缺省/空串/空格 = 默认模块（不拼参数）', () => {
  assert.equal(moduleQuery(), '')
  assert.equal(moduleQuery(''), '')
  assert.equal(moduleQuery('   '), '')
  assert.equal(moduleQuery(null), '')
  assert.equal(moduleQuery(42), '')
})

test('moduleQuery：非空 moduleId 用 ?moduleId= 编码拼接', () => {
  assert.equal(moduleQuery('m-1'), '?moduleId=m-1')
  assert.equal(moduleQuery('  模块 A  '), `?moduleId=${encodeURIComponent('模块 A')}`)
  assert.equal(moduleQuery('a&b=c'), '?moduleId=a%26b%3Dc')
})
