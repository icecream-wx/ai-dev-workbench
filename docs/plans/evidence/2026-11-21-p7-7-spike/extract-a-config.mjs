/**
 * 从 `opencode debug config` 输出中提取 spike 工作区配置（去掉全局 provider/apiKey 内容）
 * 用法：node extract-a-config.mjs <debug-output.txt> <out.json> <ws-name>
 */
import fs from 'node:fs'

const [input, output, marker] = process.argv.slice(2)
const raw = fs.readFileSync(input, 'utf8')
const start = raw.indexOf('[')
const end = raw.lastIndexOf(']')
if (start < 0 || end < 0) throw new Error('未找到 JSON 数组')
const list = JSON.parse(raw.slice(start, end + 1))
const picked = list.filter((item) => typeof item?.path === 'string' && item.path.includes(marker))
fs.writeFileSync(output, JSON.stringify(picked, null, 2), 'utf8')
console.log(`写入 ${output}（${picked.length} 条）`)
