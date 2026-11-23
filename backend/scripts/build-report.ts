/**
 * 生成汇报材料：md → 单文件离线 HTML（内联 CSS/SVG/截图）+ A4 PDF；并把
 * assets/flow-overview.svg 渲染为 2560px 宽的 PNG。
 *
 * 运行：npm run build:report --prefix backend
 * 依赖：根 `playwright` + `frontend/node_modules/markdown-it`（不新增依赖）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { chromium } from 'playwright'

const backendDir = path.resolve(__dirname, '..')
const repoRoot = path.resolve(backendDir, '..')
const reportDir = path.join(repoRoot, 'docs', 'report')
const assetsDir = path.join(reportDir, 'assets')
const mdFile = path.join(reportDir, 'ai-dev-workbench-overview.md')
const htmlFile = path.join(reportDir, 'ai-dev-workbench-overview.html')
const pdfFile = path.join(reportDir, 'ai-dev-workbench-overview.pdf')
const svgFile = path.join(assetsDir, 'flow-overview.svg')
const pngFile = path.join(assetsDir, 'flow-overview.png')

const requireFromFrontend = createRequire(path.join(repoRoot, 'frontend', 'package.json'))
const MarkdownIt = requireFromFrontend('markdown-it') as new (options?: Record<string, unknown>) => {
  render: (markdown: string) => string
}

const CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 0 auto; padding: 40px 32px 64px; max-width: 1000px;
  font-family: 'Inter', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 14px; line-height: 1.75; color: #0f172a; background: #fff;
}
h1 { font-size: 30px; line-height: 1.3; margin: 0 0 10px; letter-spacing: -0.02em; }
h2 { font-size: 21px; margin: 34px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; break-after: avoid; }
h3 { font-size: 16px; margin: 22px 0 8px; break-after: avoid; }
h4 { font-size: 14px; margin: 16px 0 6px; }
p, li { color: #1f2937; }
blockquote {
  margin: 14px 0; padding: 10px 14px; border-left: 4px solid #5b5bd6;
  background: #f4f5ff; color: #334155; border-radius: 0 8px 8px 0;
}
code { font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace; font-size: 12px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 1px 5px; }
pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; overflow-x: auto; break-inside: avoid; }
pre code { background: none; border: none; padding: 0; font-size: 11.5px; line-height: 1.6; }
table { width: 100%; border-collapse: collapse; margin: 12px 0 18px; font-size: 12.5px; break-inside: avoid; }
th, td { border: 1px solid #e2e8f0; padding: 7px 9px; text-align: left; vertical-align: top; }
th { background: #f1f5f9; font-weight: 600; }
tbody tr:nth-child(even) td { background: #fafbfc; }
img { max-width: 100%; height: auto; display: block; margin: 12px auto; border: 1px solid #e2e8f0; border-radius: 10px; }
figure.diagram, figure.shot { margin: 16px 0; break-inside: avoid; page-break-inside: avoid; }
figure.diagram svg { width: 100%; height: auto; display: block; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; }
figcaption { margin-top: 6px; font-size: 11.5px; color: #64748b; text-align: center; }
a { color: #4f46e5; }
hr { border: none; border-top: 1px solid #e2e8f0; margin: 28px 0; }
ul, ol { padding-left: 22px; }
li { margin: 3px 0; }
.doc-meta { margin: 0 0 24px; font-size: 12px; color: #64748b; }
@page { size: A4; margin: 14mm 14mm 16mm; }
@media print {
  body { padding: 0; max-width: none; font-size: 10.5pt; line-height: 1.65; }
  h1 { font-size: 20pt; }
  h2 { font-size: 14pt; margin-top: 18pt; }
  h3 { font-size: 11.5pt; }
  table { font-size: 9pt; }
  pre { font-size: 8.5pt; }
  img { max-height: 210mm; object-fit: contain; }
  a { color: inherit; text-decoration: none; }
  .page-break { page-break-before: always; }
}
`

function inlineSvg(): string {
  const raw = fs.readFileSync(svgFile, 'utf8')
  return raw.replace(/^<\?xml[^>]*\?>\s*/, '')
}

function dataUri(file: string): string {
  const ext = path.extname(file).toLowerCase().replace('.', '')
  const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream'
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`
}

function buildHtml(markdown: string): string {
  const md = new MarkdownIt({ html: false, linkify: false, breaks: false })
  let body = md.render(markdown)

  // 流程图：<img src="assets/flow-overview.svg"> → 内联 SVG
  body = body.replace(
    /<p><img src="assets\/flow-overview\.svg" alt="([^"]*)"\s*\/?><\/p>/,
    (_match, alt: string) => `<figure class="diagram">${inlineSvg()}<figcaption>${alt}</figcaption></figure>`
  )
  // 其余图片：相对路径 → base64（保持单文件离线）
  body = body.replace(/<img src="assets\/([^"]+)" alt="([^"]*)"\s*\/?>/g, (match, file: string, alt: string) => {
    const full = path.join(assetsDir, file)
    if (!fs.existsSync(full)) throw new Error(`报告图片缺失：${full}`)
    return `<figure class="shot"><img src="${dataUri(full)}" alt="${alt}"><figcaption>${alt}</figcaption></figure>`
  })
  // 给“业务流程与数据流”一节加换页（PDF 中图示单独起页）
  body = body.replace('<h2>2. 业务流程与数据流</h2>', '<h2 class="page-break">2. 业务流程与数据流</h2>')

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI Dev Workbench 概览（Agent-First）</title>
<style>${CSS}</style>
</head>
<body>
${body}
</body>
</html>
`
}

async function main(): Promise<void> {
  const markdown = fs.readFileSync(mdFile, 'utf8')
  const html = buildHtml(markdown)
  fs.writeFileSync(htmlFile, html, 'utf8')
  console.log(`[report] HTML 已写入：${path.relative(repoRoot, htmlFile)}（${(fs.statSync(htmlFile).size / 1024).toFixed(1)} KB）`)

  const browser = await chromium.launch()
  try {
    // SVG → PNG（2560px 宽，PPT 用）
    const pngPage = await browser.newPage({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 2 })
    await pngPage.setContent(
      `<html><body style="margin:0;background:#f8fafc">${inlineSvg()}</body></html>`,
      { waitUntil: 'load' }
    )
    const svgElement = pngPage.locator('svg').first()
    await svgElement.screenshot({ path: pngFile })
    console.log(`[report] PNG 已写入：${path.relative(repoRoot, pngFile)}（${(fs.statSync(pngFile).size / 1024).toFixed(1)} KB）`)
    const pngSize = await svgElement.boundingBox()
    console.log(`[report] PNG 逻辑尺寸：${pngSize?.width} × ${pngSize?.height}（2x 设备像素 = ${Number(pngSize?.width) * 2}px 宽）`)
    await pngPage.close()

    // HTML → PDF，并检查离线（无 http(s) 请求）
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const requests: string[] = []
    const consoleErrors: string[] = []
    page.on('request', request => requests.push(request.url()))
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    await page.goto(`file:///${htmlFile.replace(/\\/g, '/')}`, { waitUntil: 'load' })
    await page.pdf({ path: pdfFile, format: 'A4', printBackground: true, preferCSSPageSize: true })
    const external = requests.filter(url => /^https?:\/\//i.test(url))
    if (external.length) throw new Error(`HTML 存在外链请求：${external.slice(0, 3).join(', ')}`)
    if (consoleErrors.length) throw new Error(`HTML 存在 console error：${consoleErrors.slice(0, 3).join(' | ')}`)
    for (const width of [1440, 1024, 768]) {
      await page.setViewportSize({ width, height: 900 })
      const overflow = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        inner: window.innerWidth
      }))
      if (overflow.doc > overflow.inner + 1 || overflow.body > overflow.inner + 1) {
        throw new Error(`HTML ${width}px 横向溢出：${overflow.doc}/${overflow.body}/${overflow.inner}`)
      }
    }
    // 打印媒体下流程图必须完整落在一页内（A4 96dpi 版心 ≈ 688px 宽）
    await page.emulateMedia({ media: 'print' })
    await page.setViewportSize({ width: 688, height: 1123 })
    const diagram = await page.locator('figure.diagram').boundingBox()
    if (!diagram) throw new Error('打印媒体下未找到流程图')
    if (diagram.width > 690) throw new Error(`流程图超出版心宽度：${diagram.width}px`)
    if (diagram.height > 1000) throw new Error(`流程图可能跨页：${diagram.height}px`)
    console.log(`[report] 打印版心流程图：${Math.round(diagram.width)} × ${Math.round(diagram.height)}px（A4 单页内）`)
    await page.emulateMedia({ media: 'screen' })
    console.log(`[report] HTML 离线检查通过（请求 ${requests.length}，均本地；无 console error；1440/1024/768 无横向溢出）`)
    await page.close()
  } finally {
    await browser.close()
  }

  const pdf = fs.readFileSync(pdfFile)
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
  console.log(`[report] PDF 已写入：${path.relative(repoRoot, pdfFile)}（${(pdf.length / 1024).toFixed(1)} KB，约 ${pages} 页）`)
  // P9（2026-11-20）新增「设计产物模板原生渲染」一节，报告稳定在 15 页；守卫保留，超出即失败
  if (pages > 15) throw new Error(`PDF 页数超过 15：${pages}`)
}

main().catch(error => {
  console.error('[report] 失败：', error instanceof Error ? error.message : error)
  process.exit(1)
})
