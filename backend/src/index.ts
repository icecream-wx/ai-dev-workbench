/**
 * 智能开发工作台后端入口
 *
 * 挂载范围：
 * - /api/health          工作台健康检查
 * - /api/apps            应用 CRUD + 需求文档/设计/开发/变更单子路由
 * - /api/requirement-templates  需求模板库
 * - /api/prototype-templates    页面原型模板库
 * - /api/opencode/*      opencode serve 状态/模型/会话/事件
 * - /                    生产模式托管前端构建产物
 *
 * R4b-2：旧 structured 需求（/api/workspace、/api/modules/*、/api/settings/*、/api/agents）已删除；
 * 旧开发模块（dev 路由、生成的 dev server 代理、WebSocket 透传）已停用并删除（R4a）。
 */
import 'dotenv/config'
import path from 'node:path'
import fs from 'node:fs'
import express from 'express'
import cors from 'cors'
import { apps, appsErrorHandler } from './apps/routes'
import { opencodeRoutes, opencodeErrorHandler } from './opencode/routes'
import { requirementErrorHandler, requirementTemplateRoutes } from './requirements/routes'
import { prototypeErrorHandler, prototypeTemplateRoutes } from './design/template-routes'
import { opencode } from './opencode/runtime'
import { config, ensureRuntimeDirs, workbenchInstanceId } from './config'

ensureRuntimeDirs()

const app = express()
const port = config.port

app.use(cors())
app.use(express.json({ limit: '64mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), instanceId: workbenchInstanceId, runtime: opencode.status() })
})

app.use('/api/apps', apps)
app.use('/api/apps', appsErrorHandler)
app.use('/api/requirement-templates', requirementTemplateRoutes)
app.use('/api/requirement-templates', requirementErrorHandler)
app.use('/api/prototype-templates', prototypeTemplateRoutes)
app.use('/api/prototype-templates', prototypeErrorHandler)
app.use('/api/opencode', opencodeRoutes)
app.use('/api/opencode', opencodeErrorHandler)

// 生产模式：托管前端构建产物（SPA 回退）
const distDir = path.resolve(__dirname, '../../frontend/dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

const server = app.listen(port, () => {
  console.log(`[workbench] 后端已启动: http://localhost:${port}`)
  console.log(`[workbench] 数据目录: ${config.dataDir}`)
  console.log(`[workbench] 应用目录: ${config.projectsDir}`)
  console.log(`[workbench] opencode: ${config.opencode.host}:${config.opencode.port}（${config.opencode.autoStart ? '自动探测/启动' : '按需启动'}）`)
  opencode.autoDetect()
})

async function shutdown(): Promise<void> {
  await opencode.stop()
  server.close(() => process.exit(0))
  // 兜底：serve 停止异常时也退出
  setTimeout(() => process.exit(0), 3000).unref()
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void shutdown())
}
process.on('exit', () => {
  opencode.stopSync()
})
