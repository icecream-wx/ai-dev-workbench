/**
 * spike B3：工作室“共享根 + 每草稿子目录”的 location 设计验证
 *
 * 目的：确认在 studio 根放 `.opencode/skills`/`opencode.json`，会话用 location=<studio>/drafts/<id>
 * 时，opencode 是否仍能加载祖先 `.opencode` 里的项目级 skill/command（每草稿一个 location，便于按草稿隔离 edit 权限）。
 *
 * 不调模型；只创建空会话后查询 /api/skill、/api/command。结束后杀进程。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.join(os.tmpdir(), 'workbench-p7-7-spike')
const STUDIO = path.join(ROOT, 'ws-b3')
const DRAFT = path.join(STUDIO, 'drafts', 'demo-pack')
const PORT = Number(process.env.SPIKE_B3_PORT || 4785)
const BIN = process.env.OPENCODE_BIN || 'E:\\applications\\nodejs20\\node_global\\node_modules\\@opencode\\cli\\bin\\opencode.exe'
const LOG = path.join(ROOT, 'spike-b3-serve.log')

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function readPassword() {
  try {
    const text = fs.readFileSync(LOG, 'utf8')
    const m = text.match(/server password (\S+)/)
    return m ? m[1] : null
  } catch {
    return null
  }
}
async function req(url, pw, options = {}) {
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      ...(pw ? { Authorization: 'Basic ' + Buffer.from(`opencode:${pw}`).toString('base64') } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {}
  return { status: res.status, json, text }
}

fs.rmSync(STUDIO, { recursive: true, force: true })
write(
  path.join(STUDIO, '.opencode', 'skills', 'adw-design-template-authoring', 'SKILL.md'),
  ['---', 'name: 设计模板编写与组装', 'description: B3 祖先目录 skill 加载验证', '---', '', '# B3', ''].join('\n')
)
write(
  path.join(STUDIO, '.opencode', 'commands', 'generate-design-template.md'),
  ['---', 'description: B3 祖先目录 command 加载验证', '---', '', '生成 $ARGUMENTS。', ''].join('\n')
)
write(
  path.join(STUDIO, 'opencode.json'),
  JSON.stringify(
    {
      $schema: 'https://opencode.ai/config.json',
      permissions: [
        { action: 'edit', resource: '*', effect: 'deny' },
        { action: 'edit', resource: 'spec.json', effect: 'allow' },
        { action: 'edit', resource: 'notes.md', effect: 'allow' },
        { action: 'read', resource: '*', effect: 'allow' }
      ]
    },
    null,
    2
  ) + '\n'
)
write(path.join(DRAFT, 'spec.json'), '{"name":"demo"}\n')

const log = fs.openSync(LOG, 'w')
const child = spawn(BIN, ['serve', '--port', String(PORT), '--hostname', '127.0.0.1'], {
  cwd: STUDIO,
  env: { ...process.env, OPENCODE_LOG_LEVEL: 'warn' },
  stdio: ['ignore', log, log],
  windowsHide: true
})
child.on('error', (e) => console.error('spawn error', e.message))

try {
  let pw = null
  for (let i = 0; i < 60; i += 1) {
    pw = pw || readPassword()
    try {
      const info = await req(`http://127.0.0.1:${PORT}/api/info`, pw)
      if (info.status === 200) break
    } catch {}
    await sleep(500)
  }
  const created = await req(`http://127.0.0.1:${PORT}/api/session`, pw, {
    method: 'POST',
    body: { title: 'b3', agent: 'build', location: { directory: DRAFT } }
  })
  console.log('session(draft location) =', created.status, created.json?.data?.id || '')
  await sleep(1500)
  const skills = await req(`http://127.0.0.1:${PORT}/api/skill?location%5Bdirectory%5D=${encodeURIComponent(DRAFT)}`, pw)
  const commands = await req(`http://127.0.0.1:${PORT}/api/command?location%5Bdirectory%5D=${encodeURIComponent(DRAFT)}`, pw)
  const skillIds = (skills.json?.data || []).map((s) => s.id)
  const names = (commands.json?.data || []).map((c) => c.name)
  console.log('skill loaded =', skillIds.includes('adw-design-template-authoring'), JSON.stringify(skillIds))
  console.log('command loaded =', names.includes('generate-design-template'), JSON.stringify(names))
  if (!skillIds.includes('adw-design-template-authoring') || !names.includes('generate-design-template')) process.exitCode = 1
} finally {
  const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  await new Promise((r) => killer.on('exit', r))
  fs.closeSync(log)
  console.log('stopped')
}
