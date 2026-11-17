import assert from 'node:assert/strict'
import test from 'node:test'
import { PasswordScanner } from './password'

test('密码跨 chunk 拆分也能捕获', () => {
  const scanner = new PasswordScanner()
  assert.equal(scanner.feed('server listening on http://127.0.0.1:4771\nserver pass'), null)
  assert.equal(scanner.feed('word abc_DEF-123\n'), 'abc_DEF-123')
})

test('捕获后不重复返回，后续噪声不会产生密码', () => {
  const scanner = new PasswordScanner()
  assert.equal(scanner.feed('server password first-pass\n'), 'first-pass')
  assert.equal(scanner.feed('random output\n'), null)
  scanner.reset()
  assert.equal(scanner.feed('server password second-pass\n'), 'second-pass')
})

test('无密码输出时不会无限增长缓冲', () => {
  const scanner = new PasswordScanner()
  for (let i = 0; i < 40; i += 1) scanner.feed('x'.repeat(512))
  assert.equal(scanner.feed('server password final-pass\n'), 'final-pass')
})
