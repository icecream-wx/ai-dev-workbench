/**
 * P7-7 spike B：临时工作区技能/命令加载验证（不调模型）
 *
 * - 在 %TEMP%/workbench-p7-7-spike/ws-b 建最小 `.opencode/skills/<id>/SKILL.md` + `.opencode/commands/<id>.md`；
 * - 用独立端口 4783 启动 `opencode serve`（不碰 4771），从 stdout 捕获 serve 密码；
 * - 创建一个空会话（不发送 prompt、不调模型）让 location 初始化，然后轮询
 *   GET /api/skill、/api/command（带 location[directory]）确认项目级资产已加载；
 * - 结束时杀进程树。
 *
 * 运行：node spike-b-skill-load.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.join(os.tmpdir(), 'workbench-p7-7-spike')
const WS = path.join(ROOT, 'ws-b')
const PORT = Number(process.env.SPIKE_B_PORT || 4783)
const BIN = process.env.OPENCODE_BIN || 'E:\\applications\\nodejs20\\node_global\\node_modules\\@opencode\\cli\\bin\\opencode.exe'
const LOG = path.join(ROOT, 'spike-b-serve.log')
const SKILL_ID = 'adw-design-template-authoring'
const COMMAND_NAME = 'generate-design-template'

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readPassword() {
  try {
    const text = fs.readFileSync(LOG, 'utf8')
    const match = text.match(/server password (\S+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

async function fetchJson(url, password, options = {}) {
  const headers = {
    ...(password ? { Authorization: 'Basic ' + Buffer.from(`opencode:${password}`).toString('base64') } : {}),
    ...(options.body ? { 'Content-Type': 'application/json' } : {})
  }
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(5000)
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { status: res.status, json, text }
}

function killTree(pid) {
  return new Promise((resolve) => {
    const child = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
    child.on('exit', () => resolve())
    child.on('error', () => resolve())
  })
}

async function main() {
  fs.rmSync(WS, { recursive: true, force: true })
  write(
    path.join(WS, '.opencode', 'skills', SKILL_ID, 'SKILL.md'),
    [
      '---',
      'name: 设计模板编写与组装',
      'description: P7-7 spike 用最小 skill：读取 catalog，写 spec.json，由生成器产出模板包',
      '---',
      '',
      '# 设计模板编写与组装',
      '',
      'spike 占位正文。',
      ''
    ].join('\n')
  )
  write(
    path.join(WS, '.opencode', 'commands', `${COMMAND_NAME}.md`),
    ['---', 'description: 按草稿 spec.json 生成设计模板包（spike 占位）', '---', '', '请读取 drafts/$ARGUMENTS/spec.json 并生成模板包。', ''].join(
      '\n'
    )
  )
  // 工作室权限：edit 只允许 spec.json/notes，shell 只允许生成/校验脚本（V1 对象写法，观察 opencode 归一化）
  write(
    path.join(WS, 'opencode.json'),
    JSON.stringify(
      {
        $schema: 'https://opencode.ai/config.json',
        permission: {
          edit: { '*': 'deny', 'drafts/**/spec.json': 'allow', 'drafts/**/notes.md': 'allow' },
          bash: { '*': 'ask', 'node .opencode/scripts/*': 'allow' }
        }
      },
      null,
      2
    ) + '\n'
  )

  const log = fs.openSync(LOG, 'w')
  const child = spawn(BIN, ['serve', '--port', String(PORT), '--hostname', '127.0.0.1'], {
    cwd: WS,
    env: { ...process.env, OPENCODE_LOG_LEVEL: 'warn' },
    stdio: ['ignore', log, log],
    windowsHide: true
  })
  child.on('error', (error) => {
    console.error('[spike-b] spawn 失败:', error.message)
    process.exitCode = 1
  })

  let ready = false
  let password = null
  const startedAt = Date.now()
  try {
    for (let i = 0; i < 60; i += 1) {
      if (child.exitCode !== null) throw new Error(`serve 提前退出 code=${child.exitCode}（见 ${LOG}）`)
      password = password || readPassword()
      try {
        const info = await fetchJson(`http://127.0.0.1:${PORT}/api/info`, password)
        if (info.status === 200) {
          console.log('[spike-b] /api/info', JSON.stringify(info.json))
          ready = true
          break
        }
      } catch {
        // 尚未监听或密码未捕获
      }
      await sleep(500)
    }
    if (!ready) throw new Error(`serve 在 30s 内未就绪（见 ${LOG}）`)
    if (!password) throw new Error(`未从 serve 输出捕获密码（见 ${LOG}）`)
    console.log(`[spike-b] serve pid=${child.pid} port=${PORT} cwd=${WS}，就绪用时 ${Date.now() - startedAt}ms`)

    // opencode location 惰性初始化：先建空会话（不发 prompt，不调模型），项目级 skills/commands 随后注册
    const created = await fetchJson(`http://127.0.0.1:${PORT}/api/session`, password, {
      method: 'POST',
      body: { title: 'spike-b-location-init', agent: 'build', location: { directory: WS } }
    })
    console.log('[spike-b] POST /api/session status=', created.status, 'session=', created.json?.data?.id || '')
    const query = `location%5Bdirectory%5D=${encodeURIComponent(WS)}`

    let skills = null
    let commands = null
    let foundSkill = null
    let foundCommand = null
    for (let i = 0; i < 30; i += 1) {
      skills = await fetchJson(`http://127.0.0.1:${PORT}/api/skill?${query}`, password)
      commands = await fetchJson(`http://127.0.0.1:${PORT}/api/command?${query}`, password)
      const skillList = Array.isArray(skills.json?.data) ? skills.json.data : []
      const commandList = Array.isArray(commands.json?.data) ? commands.json.data : []
      foundSkill = skillList.find((item) => item?.id === SKILL_ID) || null
      foundCommand = commandList.find((item) => item?.name === COMMAND_NAME) || null
      if (foundSkill && foundCommand) {
        console.log(`[spike-b] location 初始化后 ${(i + 1) * 250}ms 内发现项目级 skill/command`)
        break
      }
      await sleep(250)
    }

    const skillIds = (skills?.json?.data || []).map((item) => item.id)
    const commandNames = (commands?.json?.data || []).map((item) => item.name)
    console.log('[spike-b] /api/skill status=', skills?.status, 'ids=', JSON.stringify(skillIds))
    console.log('[spike-b] /api/command status=', commands?.status, 'names=', JSON.stringify(commandNames))
    console.log('[spike-b] skill loaded =', Boolean(foundSkill), foundSkill ? JSON.stringify(foundSkill) : '')
    console.log('[spike-b] command loaded =', Boolean(foundCommand), foundCommand ? JSON.stringify(foundCommand) : '')
    console.log(`[spike-b] 总用时 ${Date.now() - startedAt}ms`)
    if (!foundSkill || !foundCommand) process.exitCode = 1
  } finally {
    await killTree(child.pid)
    fs.closeSync(log)
    console.log('[spike-b] serve 已停止')
  }
}

main().catch((error) => {
  console.error('[spike-b] 失败:', error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
})
