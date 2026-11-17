/* 静态检查：
 * 1) SFC <script setup> 中用到的 Vue API（ref/computed/watch…）必须已从 'vue' 导入
 * 2) 项目内部标识符（store/ElMessage…）使用时必须有对应导入
 */
const fs = require('fs')
const path = require('path')

const PROJECT_IMPORTS = [
  'useSettingsStore',
  'ElMessage',
  'ElMessageBox'
]

const VUE_APIS = [
  'ref', 'computed', 'watch', 'watchEffect', 'reactive', 'shallowRef', 'toRef', 'toRefs', 'unref',
  'nextTick', 'onMounted', 'onActivated', 'onDeactivated', 'onBeforeUnmount', 'onUnmounted',
  'defineAsyncComponent', 'provide', 'inject'
]

let bad = 0

function checkFile(file) {
  const src = fs.readFileSync(file, 'utf8')
  const sm = src.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)
  if (!sm) return
  const script = sm[1]
  const imported = new Set()
  for (const im of script.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    for (const name of im[1].split(',')) {
      const clean = name.trim().split(/\s+as\s+/)[0].trim()
      if (clean) imported.add(clean)
    }
  }
  const fromVue = new Set()
  const vueIm = script.match(/import\s*\{([^}]*)\}\s*from\s*['"]vue['"]/)
  if (vueIm) {
    for (const name of vueIm[1].split(',')) imported_from_vue_add(fromVue, name)
  }
  function imported_from_vue_add(set, name) {
    const clean = name.trim().split(/\s+as\s+/)[0].trim()
    if (clean) set.add(clean)
  }
  const missing = []
  for (const api of VUE_APIS) {
    const used = new RegExp('(?<![\\w$.])' + api + '\\s*\\(').test(script)
    if (used && !fromVue.has(api)) missing.push(api + ' (vue)')
  }
  for (const ident of PROJECT_IMPORTS) {
    const used = new RegExp('(?<![\\w$.])' + ident + '\\s*\\(').test(script) || new RegExp('(?<![\\w$.])' + ident + '\\b(?!\\s*:)').test(script)
    if (used && !imported.has(ident)) missing.push(ident)
  }
  if (missing.length) {
    console.log('  x ' + path.relative(process.cwd(), file) + '  缺少导入: ' + missing.join('、'))
    bad++
  }
}

function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name)
    if (f.isDirectory()) walk(p)
    else if (f.name.endsWith('.vue')) checkFile(p)
  }
}

walk(path.join(__dirname, 'src'))
if (bad) {
  console.log('发现 ' + bad + ' 个文件存在导入缺失')
  process.exit(1)
}
console.log('OK: 全部 SFC 导入完整')
