/**
 * 测试数据目录隔离守卫（MF2）
 *
 * 只测纯函数，不 import `../db`（否则会打开数据库）。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { assertTestDataDirIsolation } from './db-guards'

test('测试子进程 + 未设置 RG_DATA_DIR → 抛错（禁止打开仓库真实库）', () => {
  assert.throws(
    () => assertTestDataDirIsolation({ NODE_TEST_CONTEXT: 'child-v8' }, 'E:\\repo\\data'),
    /未设置 RG_DATA_DIR/
  )
  assert.throws(() => assertTestDataDirIsolation({ NODE_TEST_CONTEXT: 'child-v8' }), /RG_DATA_DIR/)
  // 空串/纯空格同样视为未设置
  assert.throws(
    () => assertTestDataDirIsolation({ NODE_TEST_CONTEXT: 'child-v8', RG_DATA_DIR: '   ' }),
    /RG_DATA_DIR/
  )
})

test('测试子进程 + 已设置 RG_DATA_DIR → 不抛', () => {
  assert.doesNotThrow(() =>
    assertTestDataDirIsolation({ NODE_TEST_CONTEXT: 'child-v8', RG_DATA_DIR: 'C:\\tmp\\workbench-data' })
  )
})

test('非测试进程（无 NODE_TEST_CONTEXT）→ 不抛（脚本/生产不受影响）', () => {
  assert.doesNotThrow(() => assertTestDataDirIsolation({}))
  assert.doesNotThrow(() => assertTestDataDirIsolation({ RG_DATA_DIR: '' }))
})
