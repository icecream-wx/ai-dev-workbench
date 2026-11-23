const fs = require('node:fs')
const path = require('node:path')

const project = process.argv[2]
if (!project || !fs.existsSync(path.join(project, 'package.json'))) {
  throw new Error('请传入包含 package.json 的目标项目根目录')
}
const source = path.resolve(__dirname, '../assets/PageTemplates')
const target = path.resolve(project, 'src/components/PageTemplates')
const files = []
const requested = process.argv.slice(3)
const styles = { white: 'table-white.css', blue: 'table-blue.css', 'toolbar-blue': 'toolbar-blue.css', 'list-blue': 'list-blue.css', appearance: 'appearance.css' }
const selected = new Set()
for (const option of requested) {
  if (!option.startsWith('--style=') || !styles[option.slice(8)]) {
    throw new Error('样式参数仅支持 --style=white、--style=blue、--style=toolbar-blue、--style=list-blue 或 --style=appearance，可同时指定')
  }
  selected.add(styles[option.slice(8)])
  if (option === '--style=list-blue') {
    selected.add('table-blue.css')
    selected.add('toolbar-blue.css')
  }
}

function collect(directory, relative = '') {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const name = path.join(relative, entry.name)
    if (entry.isDirectory() && !['examples', 'docs'].includes(entry.name)) collect(path.join(directory, entry.name), name)
    else if (entry.isFile() && entry.name !== 'verify.cjs' && (entry.name !== 'BlueListPage.vue' || selected.has('list-blue.css')) && (!Object.values(styles).includes(name) || selected.has(name))) files.push(name)
  }
}

// 示例与校验文档仅保留在 skill，子项目只安装运行模板及指定样式。
collect(source)
const conflicts = files.filter(name => {
  const destination = path.join(target, name)
  return fs.existsSync(destination) && (
    !fs.statSync(destination).isFile() ||
    !fs.readFileSync(destination).equals(fs.readFileSync(path.join(source, name)))
  )
})
if (conflicts.length) {
  throw new Error(`模板存在差异，未写入文件，请先检查升级：\n${conflicts.join('\n')}`)
}
for (const name of files) {
  const destination = path.join(target, name)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  if (!fs.existsSync(destination)) fs.copyFileSync(path.join(source, name), destination)
}
console.log(`模板已安装或复用：${target}`)
// Modified by AI on 2026-11-12 16:14:05
