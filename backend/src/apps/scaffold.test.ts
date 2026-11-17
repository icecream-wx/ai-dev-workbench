import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { appDirOf, assertAsciiSecrets, removeAppDir, scaffoldApp } from './scaffold'

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (entry.isFile()) files.push(full)
  }
  return files
}

test('scaffoldApp 渲染 EOS 模板且不残留 {{...}}', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-scaffold-'))
  try {
    scaffoldApp(
      {
        appId: 'leave-test',
        appName: '请假管理',
        backendPort: 18081,
        secrets: {
          eosSysKey: 'TEST_SYS_KEY',
          dbHost: 'db.example',
          dbPort: '3307',
          dbName: 'leave_db',
          dbUser: 'leave_user',
          dbPassword: 's3&cret',
          mailHost: 'smtp.example',
          mailUsername: 'mail_user',
          mailPassword: 'mail_pass'
        }
      },
      root
    )

    const appDir = appDirOf('leave-test', root)
    assert.ok(fs.existsSync(path.join(appDir, 'backend', 'pom.xml')))
    assert.ok(fs.existsSync(path.join(appDir, 'docs', 'handoff')))
    assert.ok(fs.existsSync(path.join(appDir, '.opencode', 'agents')))
    assert.ok(fs.existsSync(path.join(appDir, 'AGENTS.md')))
    assert.ok(fs.existsSync(path.join(appDir, 'README.md')))
    assert.ok(fs.existsSync(path.join(appDir, '.opencode', 'agents', 'req.md')))
    assert.ok(fs.existsSync(path.join(appDir, '.opencode', 'agents', 'design.md')))
    const reqAgent = fs.readFileSync(path.join(appDir, '.opencode', 'agents', 'req.md'), 'utf8')
    assert.match(reqAgent, /mode: primary/)
    assert.match(reqAgent, /bash: false/)
    assert.match(reqAgent, /read: false/)

    const appAgents = fs.readFileSync(path.join(appDir, 'AGENTS.md'), 'utf8')
    assert.match(appAgents, /- 所有回复与思考\/进度说明使用中文。/)

    const pom = fs.readFileSync(path.join(appDir, 'backend', 'pom.xml'), 'utf8')
    assert.match(pom, /<artifactId>leave-test<\/artifactId>/)
    const props = fs.readFileSync(path.join(appDir, 'backend', 'src', 'application.properties'), 'utf8')
    assert.match(props, /server\.port=18081/)
    assert.match(props, /spring\.application\.name=leave-test/)
    assert.match(props, /eos\.application\.sys-key=TEST_SYS_KEY/)

    const userConfig = fs.readFileSync(path.join(appDir, 'backend', 'src', 'META-INF', '_srv', 'config', 'user-config.xml'), 'utf8')
    assert.match(userConfig, /jdbc:mysql:\/\/db\.example:3307\/leave_db/)
    assert.match(userConfig, /leave_user/)
    assert.match(userConfig, /s3&amp;cret/)
    assert.equal(userConfig.includes('s3&cret'), false)

    const residual = walk(appDir).filter(file => fs.readFileSync(file).includes('{{'))
    assert.deepEqual(residual.map(file => path.relative(appDir, file)), [])

    const backendReadme = fs.readFileSync(path.join(appDir, 'backend', 'README.md'), 'utf8')
    assert.equal(backendReadme.includes('## 模板占位符'), false)
    assert.match(backendReadme, /## 创建时已完成渲染/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('未提供的敏感项写成 CHANGE_ME', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-scaffold-'))
  try {
    scaffoldApp({ appId: 'bare-test', appName: 'Bare', backendPort: 18082 }, root)
    const appDir = appDirOf('bare-test', root)
    const props = fs.readFileSync(path.join(appDir, 'backend', 'src', 'application.properties'), 'utf8')
    assert.match(props, /eos\.application\.sys-key=CHANGE_ME/)
    const userConfig = fs.readFileSync(path.join(appDir, 'backend', 'src', 'META-INF', '_srv', 'config', 'user-config.xml'), 'utf8')
    assert.match(userConfig, /<configValue key="C3p0-Password">CHANGE_ME<\/configValue>/)
    removeAppDir('bare-test', root)
    assert.equal(fs.existsSync(appDir), false)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('assertAsciiSecrets 拒绝非 ASCII 凭据', () => {
  assert.doesNotThrow(() => assertAsciiSecrets({ eosSysKey: 'ABC-123' }))
  assert.throws(() => assertAsciiSecrets({ dbPassword: '密码' }), /ASCII/)
})
