import assert from 'node:assert/strict'
import test from 'node:test'
import { clearSecretsForTests, redact, redactDeep, registerSecret } from './redact'

test('注册的密码在文本中被替换', () => {
  clearSecretsForTests()
  registerSecret('serve-pass-123')
  const out = redact('server password serve-pass-123 and Authorization: Basic b3BlbmNvZGU6c2VydmUtcGFzcy0xMjM=')
  assert.equal(out.includes('serve-pass-123'), false)
  assert.equal(out.includes('b3BlbmNvZGU6c2VydmUtcGFzcy0xMjM='), false)
  assert.match(out, /\*\*\*/)
})

test('redactDeep 递归清洗对象与数组', () => {
  clearSecretsForTests()
  registerSecret('token-abc')
  const input = {
    headers: { Authorization: 'Basic b3BlbmNvZGU6dG9rZW4tYWJj' },
    list: ['token-abc', 1, null],
    nested: { note: 'prefix-token-abc' }
  }
  const out = redactDeep(input)
  assert.equal(JSON.stringify(out).includes('token-abc'), false)
  assert.equal(JSON.stringify(out).includes('b3BlbmNvZGU6dG9rZW4tYWJj'), false)
  assert.equal(out.list[1], 1)
})

test('小于 4 位的值不注册，避免误伤', () => {
  clearSecretsForTests()
  registerSecret('abc')
  assert.equal(redact('abc'), 'abc')
})
