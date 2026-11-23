const fs = require('node:fs')
const path = require('node:path')

const [, , project, suite, pageArgument] = process.argv
const sourceRoot = path.resolve(__dirname, '../assets/ApplicationPageTemplates')

function fail(message) {
  throw new Error(`${message}\n用法：node install-application-page-template.cjs <目标工程> <套装> [页面名]`)
}

if (!project || !fs.existsSync(path.join(project, 'package.json'))) {
  fail('请传入包含 package.json 的目标项目根目录')
}

const suites = fs.readdirSync(sourceRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)

if (!suite || !suites.includes(suite)) {
  fail(`套装仅支持：${suites.join('、')}`)
}

const source = path.join(sourceRoot, suite)
const sourcePages = path.join(source, 'pages')
const availablePages = fs.readdirSync(sourcePages, { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.vue'))
  .map(entry => entry.name)
const requestedPage = pageArgument
  ? (pageArgument.endsWith('.vue') ? pageArgument : `${pageArgument}.vue`)
  : null

if (requestedPage && !availablePages.includes(requestedPage)) {
  fail(`${suite} 不包含页面 ${requestedPage}；可用页面：${availablePages.join('、')}`)
}

const target = path.resolve(project, 'src/views/application-page-templates', suite)
const relativeFiles = ['style.css']

function collect(directory, relativeDirectory) {
  if (!fs.existsSync(directory)) return
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = path.join(relativeDirectory, entry.name)
    if (entry.isDirectory()) collect(path.join(directory, entry.name), relative)
    else if (entry.isFile()) relativeFiles.push(relative)
  }
}

if (requestedPage) relativeFiles.push(path.join('pages', requestedPage))
else for (const page of availablePages) relativeFiles.push(path.join('pages', page))
collect(path.join(source, 'assets'), 'assets')

const conflicts = relativeFiles.filter(relative => {
  const destination = path.join(target, relative)
  const sourceFile = path.join(source, relative)
  return fs.existsSync(destination) && (
    !fs.statSync(destination).isFile() ||
    !fs.readFileSync(destination).equals(fs.readFileSync(sourceFile))
  )
})

if (conflicts.length) {
  throw new Error(`页面模板存在差异，未写入文件，请先检查本地修改：\n${conflicts.join('\n')}`)
}

for (const relative of relativeFiles) {
  const destination = path.join(target, relative)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  if (!fs.existsSync(destination)) fs.copyFileSync(path.join(source, relative), destination)
}

const scope = requestedPage || `${availablePages.length} 个页面`
console.log(`完整页面模板已安装或复用：${target}（${scope}）`)
