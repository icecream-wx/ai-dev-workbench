import assert from 'node:assert/strict'
import test from 'node:test'
import { buildServeEnv, assertSafeTestServePort, sanitizeModel, sessionModelRef } from './runtime'

test('sanitizeModel 剔除 provider settings / apiKey', () => {
  const model = sanitizeModel({
    id: 'deepseek-flash',
    providerID: 'packycode-deepseek',
    modelID: 'deepseek-flash',
    name: 'DeepSeek Flash',
    settings: { apiKey: 'secret-key', baseURL: 'https://example.invalid' },
    variants: [{ id: 'high' }, { id: 'low' }, null],
    time: { released: 1793923200000 },
    status: 'active',
    enabled: true
  })
  assert.ok(model)
  assert.equal(model.providerID, 'packycode-deepseek')
  assert.deepEqual(model.variants, ['high', 'low'])
  assert.equal(model.released, 1793923200000)
  assert.equal(JSON.stringify(model).includes('secret-key'), false)
  assert.equal(JSON.stringify(model).includes('settings'), false)
})

test('sanitizeModel 拒绝缺少 provider/model 的输入', () => {
  assert.equal(sanitizeModel(null), null)
  assert.equal(sanitizeModel({ id: 'x' }), null)
  assert.equal(sanitizeModel({ providerID: 'p' }), null)
})

test('sessionModelRef 从 CLI 会话模型提取 provider/id/variant', () => {
  assert.deepEqual(sessionModelRef({ providerID: 'packycode-deepseek', id: 'deepseek-flash', variant: 'high' }), {
    providerID: 'packycode-deepseek',
    id: 'deepseek-flash',
    variant: 'high'
  })
  assert.deepEqual(sessionModelRef({ providerID: 'p', modelID: 'm' }), { providerID: 'p', id: 'm' })
  assert.equal(sessionModelRef({ id: 'm' }), null)
  assert.equal(sessionModelRef(null), null)
})

test('buildServeEnv 不把工作台密钥传给 serve', () => {
  const env = buildServeEnv({
    PATH: 'C:/bin',
    PORT: '3300',
    OPENCODE_PORT: '4771',
    RG_DATA_DIR: 'E:/data',
    LLM_API_KEY: 'sk-should-not-leak',
    WORKBENCH_TOKEN: 'token',
    WB_SECRET: 'secret',
    HOME: 'C:/Users/me'
  })
  assert.equal(env.PATH, 'C:/bin')
  assert.equal(env.HOME, 'C:/Users/me')
  assert.equal(env.PORT, undefined)
  assert.equal(env.OPENCODE_PORT, undefined)
  assert.equal(env.RG_DATA_DIR, undefined)
  assert.equal(env.LLM_API_KEY, undefined)
  assert.equal(env.WORKBENCH_TOKEN, undefined)
  assert.equal(env.WB_SECRET, undefined)
})

test('assertSafeTestServePort：测试进程禁止默认 4771 真实 serve', () => {
  assert.throws(
    () => assertSafeTestServePort(4771, { NODE_TEST_CONTEXT: 'child-v8' }),
    /禁止在默认端口 4771/
  )
  assert.throws(
    () => assertSafeTestServePort(4771, { NODE_TEST_CONTEXT: 'child-v8', RG_ALLOW_REAL_OPENCODE: 'true' }),
    /RG_ALLOW_REAL_OPENCODE=1/
  )
})

test('assertSafeTestServePort：显式允许 / 非测试 / 非默认端口均放行', () => {
  assert.doesNotThrow(() =>
    assertSafeTestServePort(4771, { NODE_TEST_CONTEXT: 'child-v8', RG_ALLOW_REAL_OPENCODE: '1' })
  )
  assert.doesNotThrow(() => assertSafeTestServePort(4771, {}))
  assert.doesNotThrow(() => assertSafeTestServePort(4771, { NODE_TEST_CONTEXT: '   ' }))
  assert.doesNotThrow(() => assertSafeTestServePort(4799, { NODE_TEST_CONTEXT: 'child-v8' }))
})
