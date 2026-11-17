/**
 * 启动期测试隔离硬保护（MF2）
 *
 * 背景：`node:test` 的子进程会设置 `NODE_TEST_CONTEXT`（实测值 `child-v8`）。
 * 若测试文件在 import `./db` 前忘记设置 `RG_DATA_DIR`，`db.ts` 会打开仓库真实
 * `data/requirements.db`（会执行启动 DDL/迁移）。M2 实施期间曾因此对真实库执行了迁移。
 *
 * 规则：测试子进程 + 未设置 `RG_DATA_DIR` → 直接抛错（fail-closed），
 * 提示必须先指向临时目录；非测试进程/已设置临时目录时无操作。
 *
 * 本模块不 import 任何其它业务模块，便于 `db.ts` 在任何阶段调用。
 */

export interface DataDirGuardEnv {
  /** node:test 子进程标记（如 `child-v8`）；普通进程/脚本通常不存在 */
  NODE_TEST_CONTEXT?: string
  /** 工作台 SQLite 数据目录覆盖；测试必须指向临时目录 */
  RG_DATA_DIR?: string
}

/**
 * 断言测试进程不会打开仓库默认数据目录。
 *
 * @param env 进程环境（通常是 `process.env`）
 * @param dataDir 当前解析出的数据目录（仅用于错误信息，便于定位）
 * @throws 当 `env.NODE_TEST_CONTEXT` 存在且 `env.RG_DATA_DIR` 为空/未设置时
 */
export function assertTestDataDirIsolation(env: DataDirGuardEnv, dataDir?: string): void {
  const context = typeof env.NODE_TEST_CONTEXT === 'string' ? env.NODE_TEST_CONTEXT.trim() : ''
  if (!context) return
  const dataDirOverride = typeof env.RG_DATA_DIR === 'string' ? env.RG_DATA_DIR.trim() : ''
  if (dataDirOverride) return
  throw new Error(
    `测试进程（NODE_TEST_CONTEXT=${context}）未设置 RG_DATA_DIR，拒绝打开仓库默认数据目录` +
      `${dataDir ? `（${dataDir}）` : ''}。` +
      '请在 import src/db 之前设置 process.env.RG_DATA_DIR / RG_PROJECTS_DIR 指向临时目录' +
      '（参考其它 *.test.ts 的 setup）。'
  )
}
