/**
 * P7-3a：把内置设计模板包（templates/design-system/afcenter-app-templates-v1）
 * 复制到 frontend/src/preview/templates/，并生成静态预览 registry。
 *
 * 用法（在 frontend/ 下）：npm run gen:preview
 *
 * 说明：
 * - 只复制 `application-types/**` 与 `styles/**`，保持与 pack 完全同名，便于对照；
 * - `pack.json` 不复制，模板元数据仍以内置 pack 为单一事实源；
 * - 生成物 `src/preview/registry.ts` 直接 import 页面与结构样式，不扫描运行时目录。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(here, '..')
const repoRoot = path.resolve(frontendRoot, '..')
const packId = 'afcenter-app-templates-v1'
const packRoot = path.join(repoRoot, 'templates', 'design-system', packId)
const destRoot = path.join(frontendRoot, 'src', 'preview', 'templates', packId)
const registryFile = path.join(frontendRoot, 'src', 'preview', 'registry.ts')

function emptyDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name)
    const dst = path.join(to, entry.name)
    if (entry.isDirectory()) copyDir(src, dst)
    else fs.copyFileSync(src, dst)
  }
}

const pack = JSON.parse(fs.readFileSync(path.join(packRoot, 'pack.json'), 'utf8'))

emptyDir(destRoot)
copyDir(path.join(packRoot, 'application-types'), path.join(destRoot, 'application-types'))
copyDir(path.join(packRoot, 'styles'), path.join(destRoot, 'styles'))

const rel = (p) => `./templates/${packId}/${p.replaceAll('\\', '/')}`

const appTypeMeta = pack.applicationTypes.map((appType) => ({
  id: appType.id,
  name: appType.name,
  category: appType.category || '',
  description: appType.description || '',
  defaultStyle: appType.defaultStyle || pack.defaultStyle,
  pages: appType.pages.map((page) => ({
    id: page.id,
    name: page.name,
    type: page.type,
    recipe: page.recipe,
    preview: page.preview || '',
    description: page.description || '',
    components: page.components || []
  }))
}))

const pageBlocks = pack.applicationTypes.map((appType) => {
  const lines = appType.pages.map(
    (page) => `    '${page.id}': () => import('${rel(page.blueprint)}')`
  )
  return `  '${appType.id}': {\n${lines.join(',\n')}\n  }`
})

const structureEntries = pack.applicationTypes.map(
  (appType) => `  '${appType.id}': () => import('${rel(appType.structure)}?inline')`
)

const styleImports = pack.styles.map((style) => `import '${rel(style.css)}'`)
const styleMeta = pack.styles.map((style) => ({
  id: style.id,
  name: style.name,
  className: style.className,
  description: style.description || '',
  signature: style.signature || '',
  tokens: style.tokens || {}
}))

const output = `/* eslint-disable */
/**
 * 由 scripts/generate-preview-templates.mjs 生成，请勿手工编辑。
 * 来源：templates/design-system/${packId}（内置 pack，单一事实源）
 */
${styleImports.join('\n')}
import '${rel('styles/shared.css')}'

export interface PreviewPageMeta {
  id: string
  name: string
  type: string
  recipe: string
  preview: string
  description: string
  components: string[]
}

export interface PreviewApplicationTypeMeta {
  id: string
  name: string
  category: string
  description: string
  defaultStyle: string
  pages: PreviewPageMeta[]
}

export interface PreviewStyleMeta {
  id: string
  name: string
  className: string
  description: string
  signature: string
  tokens: Record<string, unknown>
}

export const previewPackId = '${packId}'
export const defaultApplicationType = '${pack.defaultApplicationType}'
export const defaultStyle = '${pack.defaultStyle}'

export const applicationTypes: PreviewApplicationTypeMeta[] = ${JSON.stringify(appTypeMeta, null, 2)}

export const styles: PreviewStyleMeta[] = ${JSON.stringify(styleMeta, null, 2)}

export const pageLoaders: Record<string, Record<string, () => Promise<unknown>>> = {
${pageBlocks.join(',\n')}
}

export const structureLoaders: Record<string, () => Promise<{ default: string }>> = {
${structureEntries.join(',\n')}
}
`

fs.writeFileSync(registryFile, output)
console.log(`已复制模板：${path.relative(repoRoot, destRoot)}`)
console.log(`已生成 registry：${path.relative(repoRoot, registryFile)}`)
console.log(
  `应用类型 ${appTypeMeta.length} 个 / 页面 ${appTypeMeta.reduce((n, t) => n + t.pages.length, 0)} 个 / 风格 ${styleMeta.length} 个`
)
