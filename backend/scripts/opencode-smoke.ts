/**
 * P0-3 集成冒烟：真实 opencode serve + 真实模型
 *
 * 流程：启动 serve → 创建会话 → 发送 prompt → 订阅 SSE 收集文本 → 删除会话 → 停止 serve
 *
 * 用法：
 *   npm run smoke:opencode
 *   SMOKE_PORT=4788 SMOKE_PROMPT="回复 OK" SMOKE_TIMEOUT_MS=120000 npm run smoke:opencode
 *
 * 默认使用独立端口 4788，避免影响正在运行的 `npm run dev` 工作台（默认 4771）。
 * 该脚本会调用 opencode 当前默认模型；是否产生费用取决于本机 opencode 配置。
 */

const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS) || 120000
const prompt = process.env.SMOKE_PROMPT || '只回复两个字：收到'

async function main(): Promise<void> {
  // 在加载 config 之前设置，确保 runtime 使用独立端口（不与 dev 工作台抢 4771）
  process.env.OPENCODE_PORT = process.env.SMOKE_PORT || '4788'
  const { config } = await import('../src/config')
  const { opencode } = await import('../src/opencode/runtime')

  const startedAt = Date.now()
  await opencode.ensureStarted()
  console.log('[smoke] serve 就绪:', JSON.stringify(opencode.status()))

  const session = await opencode.createSession({
    directory: config.projectsDir,
    title: `workbench-smoke-${new Date().toISOString()}`,
    agent: process.env.SMOKE_AGENT || 'build',
    model: parseModel(process.env.SMOKE_MODEL)
  })
  console.log('[smoke] 会话已创建:', session.id)

  const chunks: string[] = []
  let settled = false
  const outcome = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error(`等待模型输出超时（${timeoutMs}ms）`))
    }, timeoutMs)
    const unsubscribe = opencode.subscribe({ sessionID: session.id }, event => {
      if (event.type === 'session.text.delta') {
        const delta = String(event.data?.delta ?? '')
        if (delta) chunks.push(delta)
      }
      if (settled) return
      if (event.type === 'session.text.ended') {
        const text = String(event.data?.text ?? '')
        if (!chunks.length && text) chunks.push(text)
      }
      if (event.type === 'session.execution.failed') {
        settled = true
        clearTimeout(timer)
        unsubscribe()
        reject(new Error(`模型执行失败：${JSON.stringify(event.data ?? {})}`))
      }
      if (event.type === 'session.execution.succeeded' || event.type === 'session.idle') {
        settled = true
        clearTimeout(timer)
        unsubscribe()
        resolve()
      }
    })
  })

  try {
    await opencode.prompt(session.id, prompt)
    await outcome
    const text = chunks.join('').trim()
    console.log('[smoke] 收到文本:', JSON.stringify(text))
    if (!text) throw new Error('未收到任何 assistant 文本')
  } finally {
    await opencode.deleteSession(session.id).catch(error => console.warn('[smoke] 删除会话失败:', messageOf(error)))
  }

  console.log(`[smoke] 通过，用时 ${Date.now() - startedAt}ms`)
}

function parseModel(value: string | undefined): { providerID: string; id: string } | null {
  if (!value) return null
  const index = value.indexOf('/')
  if (index <= 0 || index === value.length - 1) throw new Error('SMOKE_MODEL 需为 providerID/modelID')
  return { providerID: value.slice(0, index), id: value.slice(index + 1) }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

main()
  .catch(error => {
    console.error('[smoke] 失败:', messageOf(error))
    process.exitCode = 1
  })
  .finally(async () => {
    const { opencode } = await import('../src/opencode/runtime')
    await opencode.stop()
  })
