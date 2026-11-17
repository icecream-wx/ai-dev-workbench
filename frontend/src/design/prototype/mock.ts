import type { SpecEntity, SpecField } from './spec-types'

/**
 * 确定性 Mock 数据生成：按字段类型与命名习惯产出中文假数据，不调 LLM。
 * 只服务线框原型展示，值不具备业务正确性。
 */

const NAME_POOL = ['张伟', '王芳', '李娜', '刘强', '陈静', '杨洋', '赵敏', '周杰', '吴磊', '郑爽']
const ORG_POOL = ['华东事业部', '华南事业部', '研发中心', '市场部', '人力资源部', '财务部']
const TITLE_POOL = ['关于季度目标的说明', '供应商合同评审', '新品上市推广方案', '机房巡检报告', '客户满意度调研']
const TEXT_POOL = [
  '请相关负责人尽快跟进处理，并在本周内反馈进展。',
  '该事项涉及跨部门协作，需要提前准备相关材料。',
  '按照既定计划推进，如遇问题及时上报。',
  '已完成初步核查，待进一步确认细节后提交。'
]
const CITY_POOL = ['上海市浦东新区', '北京市海淀区', '广州市天河区', '深圳市南山区', '杭州市西湖区']

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1))
}

function mockByName(field: SpecField): string {
  const key = `${field.name}${field.label}`.toLowerCase()
  if (/name|姓名|申请人|负责人|联系人|经理|员工|主管|user|owner/.test(key)) return pick(NAME_POOL)
  if (/phone|mobile|电话|手机/.test(key)) return `13${randInt(0, 9)}${randInt(10000000, 99999999)}`
  if (/email|邮箱/.test(key)) return `user${randInt(1, 99)}@example.com`
  if (/dept|department|org|部门|机构|组织/.test(key)) return pick(ORG_POOL)
  if (/city|address|地址|城市/.test(key)) return pick(CITY_POOL)
  if (/title|标题|主题|subject/.test(key)) return pick(TITLE_POOL)
  if (/remark|comment|note|备注|说明|desc/.test(key)) return pick(TEXT_POOL)
  return pick(TITLE_POOL).slice(0, 4)
}

function mockNumber(field: SpecField): number {
  const min = typeof field.min === 'number' ? field.min : 1
  const max = typeof field.max === 'number' ? field.max : Math.max(min + 9, 100)
  const key = `${field.name}${field.label}`
  if (/amount|money|price|金额|单价|费用|budget/.test(key)) return randInt(Math.ceil(min), Math.floor(max)) * 100 + 0.5
  return randInt(Math.ceil(min), Math.floor(max))
}

function mockValue(field: SpecField): unknown {
  switch (field.type) {
    case 'number': return mockNumber(field)
    case 'boolean': return Math.random() > 0.5
    case 'date': return `2026-0${randInt(1, 9)}-${String(randInt(10, 28))}`
    case 'datetime': return `2026-0${randInt(1, 9)}-${String(randInt(10, 28))} ${String(randInt(8, 18))}:${String(randInt(10, 59))}`
    case 'enum': return field.options?.length ? pick(field.options) : '选项一'
    case 'ref': return pick(NAME_POOL)
    case 'text': return pick(TEXT_POOL)
    default: return mockByName(field)
  }
}

export function displayValue(field: SpecField, value: unknown): string {
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (value === undefined || value === null || value === '') return '-'
  if (/amount|money|price|金额|单价|费用|budget/.test(`${field.name}${field.label}`) && typeof value === 'number') {
    return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
  }
  return String(value)
}

export interface MockRow {
  [fieldName: string]: unknown
}

/** 为实体生成 count 行假数据 */
export function mockRows(entity: SpecEntity, count: number): MockRow[] {
  const rows: MockRow[] = []
  for (let i = 0; i < count; i++) {
    const row: MockRow = {}
    for (const field of entity.fields) row[field.name] = mockValue(field)
    rows.push(row)
  }
  return rows
}

/** 枚举字段分布（饼图示意）：[枚举值, 占比] */
export function enumDistribution(field: SpecField | undefined): Array<[string, number]> {
  if (!field) return []
  const options = field.options?.length ? field.options : ['选项一', '选项二', '选项三']
  const weights = options.map(() => randInt(12, 40))
  const total = weights.reduce((a, b) => a + b, 0)
  return options.map((opt, i) => [opt, Math.round((weights[i] / total) * 100)] as [string, number])
}

/** 数值字段按维度聚合（条形图示意）：[维度值, 数值] */
export function numericByDimension(rows: MockRow[], metric: string, dimension: string): Array<[string, number]> {
  const groups = new Map<string, number>()
  for (const row of rows.slice(0, 6)) {
    const key = String(row[dimension] ?? '-')
    const value = typeof row[metric] === 'number' ? (row[metric] as number) : randInt(20, 100)
    groups.set(key, (groups.get(key) ?? 0) + value)
  }
  return [...groups.entries()]
}

/** 日期字符串解析（YYYY-MM-DD 或含时间），失败返回 undefined */
export function parseDateValue(value: unknown): { date: string; day: number; month: number; year: number } | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''))
  if (!match) return undefined
  return { date: match[0], day: Number(match[3]), month: Number(match[2]), year: Number(match[1]) }
}

export interface GanttBar {
  row: MockRow
  /** 甘特条在时间轴上的位置（0-100 百分比）与宽度 */
  left: number
  width: number
  /** 进度 0-100（无进度字段时给固定示意值） */
  progress: number
}

/** 甘特条：按起止日期在 [min, max] 区间内换算为百分比位置 */
export function ganttBars(rows: MockRow[], startField: string, endField: string | undefined, progressField: string | undefined): GanttBar[] {
  const items = rows.map(row => {
    const start = parseDateValue(row[startField])
    const end = (endField ? parseDateValue(row[endField]) : undefined) ?? (start ? parseDateValue(addDays(start.date, randInt(3, 12))) : undefined)
    return { row, start, end }
  })
  const valid = items.filter(it => it.start && it.end)
  if (!valid.length) return []
  const times = valid.flatMap(it => [Date.parse(it.start!.date), Date.parse(it.end!.date)])
  const min = Math.min(...times)
  const max = Math.max(...times)
  const span = Math.max(max - min, 86400000)
  return valid.map(it => {
    const left = ((Date.parse(it.start!.date) - min) / span) * 100
    const width = Math.max(((Date.parse(it.end!.date) - Date.parse(it.start!.date)) / span) * 100, 4)
    const progress = typeof it.row[progressField ?? ''] === 'number' ? Math.min(100, Math.round((it.row[progressField!] as number) * 100)) : randInt(20, 90)
    return { row: it.row, left, width, progress }
  })
}

function addDays(date: string, days: number): string {
  const d = new Date(Date.parse(date) + days * 86400000)
  return d.toISOString().slice(0, 10)
}

/** 日历事件：按月分组的 [日, 事件标题] 列表，月份取自数据中占比最多的月 */
export function calendarEvents(rows: MockRow[], dateField: string, titleField: string): { year: number; month: number; byDay: Map<number, string[]> } {
  const counter = new Map<string, number>()
  for (const row of rows) {
    const parsed = parseDateValue(row[dateField])
    if (parsed) counter.set(`${parsed.year}-${parsed.month}`, (counter.get(`${parsed.year}-${parsed.month}`) ?? 0) + 1)
  }
  let best = ''
  let bestCount = -1
  for (const [key, count] of counter) {
    if (count > bestCount) {
      best = key
      bestCount = count
    }
  }
  const [year, month] = best ? best.split('-').map(Number) : [2026, 9]
  const byDay = new Map<number, string[]>()
  for (const row of rows) {
    const parsed = parseDateValue(row[dateField])
    if (!parsed || parsed.year !== year || parsed.month !== month) continue
    const title = String(row[titleField] ?? '事件')
    const list = byDay.get(parsed.day) ?? []
    list.push(title)
    byDay.set(parsed.day, list)
  }
  return { year, month, byDay }
}

/** 月视图：返回从周一开始的 6×7 网格（值为日期数字或 null 表示补位） */
export function monthGrid(year: number, month: number): number[] {
  const first = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const offset = (first.getDay() + 6) % 7
  const cells: number[] = []
  for (let i = 0; i < offset; i++) cells.push(0)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(0)
  return cells
}

// Modified by AI on 2026-09-14 14:01:54
