/**
 * 智能开发工作台后端入口
 *
 * 挂载范围：
 * - /api/health                 工作台健康检查
 * - /api/apps                   应用 CRUD + 产物/事件/对话 + 会话
 * - /api/requirement-templates  需求模板库（全局）
 * - /api/design-system          设计模板包（内置 + 自定义文件；资产/删除）
 * - /api/design-templates       模板工作室（catalog / 草稿 / 生成 / 发布）
 * - /api/templates              ／模板同步（sync）与引用（usage）
 * - /api/opencode/*             opencode serve 状态/模型/会话/事件
 * - /                            生产模式托管前端构建产物
 * - /preview.html /design-preview.html /template-preview.html  独立预览入口（缺失 404）
 */
import 'dotenv/config'
import path from 'node:path'
import fs from 'node:fs'
import express from 'express'
import cors from 'cors'
import { apps, appsErrorHandler } from './apps/routes'
import { opencodeRoutes, opencodeErrorHandler } from './opencode/routes'
import { requirementTemplateRoutes, templateRoutes, templateErrorHandler } from './templates/routes'
import { designSystemRoutes, designSystemErrorHandler } from './design/system-routes'
import { designTemplateRoutes, designTemplateErrorHandler } from './design-template/routes'
import { opencode } from './opencode/runtime'
import { config, ensureRuntimeDirs, workbenchInstanceId } from './config'
import { closeAllWatchers } from './workspace/hub'

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
app.use('/api/requirement-templates', templateErrorHandler)
app.use('/api/templates', templateRoutes)
app.use('/api/templates', templateErrorHandler)
app.use('/api/design-system', designSystemRoutes)
app.use('/api/design-system', designSystemErrorHandler)
app.use('/api/design-templates', designTemplateRoutes)
app.use('/api/design-templates', designTemplateErrorHandler)
app.use('/api/opencode', opencodeRoutes)
app.use('/api/opencode', opencodeErrorHandler)

// 生产模式：托管前端构建产物（SPA 回退）
const distDir = path.resolve(__dirname, '../../frontend/dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  // 独立入口（模板中心预览 P7-3 / 设计产物模板风格预览 P9 / 自定义模板预览 P7-7b）：
  // 缺失时明确 404，不回落 index.html
  const standaloneEntries: Array<{ route: string; file: string }> = [
    { route: '/preview.html', file: 'preview.html' },
    { route: '/design-preview.html', file: 'design-preview.html' },
    { route: '/template-preview.html', file: 'template-preview.html' }
  ]
  for (const entry of standaloneEntries) {
    app.get(entry.route, (_req, res) => {
      const entryFile = path.join(distDir, entry.file)
      if (!fs.existsSync(entryFile)) {
        res
          .status(404)
          .type('text/plain; charset=utf-8')
          .send(`${entry.file} 尚未构建：请先在 frontend/ 执行 npm run build`)
        return
      }
      res.sendFile(entryFile)
    })
  }
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
  closeAllWatchers()
  await opencode.stop()
  server.close(() => process.exit(0))
  // 兜底：serve 停止异常时也退出
  setTimeout(() => process.exit(0), 3000).unref()
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void shutdown())
}
process.on('exit', () => {
  closeAllWatchers()
  opencode.stopSync()
})
