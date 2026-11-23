/**
 * 极简 JSON Schema 校验（只支持 design.schema.json 用到的关键字）
 *
 * 支持：type / required / properties / items / enum
 * 不支持 $ref / anyOf / pattern / format —— 保持 schema 与校验器都小。
 */
export interface SchemaError {
  path: string
  message: string
  expected?: string
}

type JsonSchema = Record<string, unknown>

function typeOf(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number'
  return typeof value
}

function matchesType(value: unknown, expected: string): boolean {
  const actual = typeOf(value)
  if (expected === 'number') return actual === 'number' || actual === 'integer'
  if (expected === 'integer') return actual === 'integer'
  return actual === expected
}

export function validateJsonSchema(schema: JsonSchema | null, value: unknown, currentPath = '', errors: SchemaError[] = []): SchemaError[] {
  if (!schema || typeof schema !== 'object') return errors
  const type = typeof schema.type === 'string' ? schema.type : ''
  if (type && !matchesType(value, type)) {
    errors.push({ path: currentPath || '$', message: `类型应为 ${type}`, expected: type })
    return errors
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    errors.push({
      path: currentPath || '$',
      message: `取值应为 ${schema.enum.map(String).join(' | ')}`,
      expected: schema.enum.map(String).join(' | ')
    })
    return errors
  }

  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value)
  if (isObject) {
    const object = value as Record<string, unknown>
    for (const key of Array.isArray(schema.required) ? (schema.required as string[]) : []) {
      if (object[key] === undefined) errors.push({ path: join(currentPath, key), message: '缺少必填字段', expected: key })
    }
    const properties = schema.properties && typeof schema.properties === 'object' ? (schema.properties as Record<string, JsonSchema>) : {}
    for (const [key, child] of Object.entries(properties)) {
      if (object[key] === undefined) continue
      validateJsonSchema(child, object[key], join(currentPath, key), errors)
    }
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      for (const [key, child] of Object.entries(object)) {
        if (Object.prototype.hasOwnProperty.call(properties, key)) continue
        validateJsonSchema(schema.additionalProperties as JsonSchema, child, join(currentPath, key), errors)
      }
    }
  }

  if (Array.isArray(value) && schema.items && typeof schema.items === 'object') {
    for (const [index, item] of value.entries()) {
      validateJsonSchema(schema.items as JsonSchema, item, `${currentPath}[${index}]`, errors)
    }
  }
  return errors
}

function join(base: string, key: string): string {
  return base ? `${base}.${key}` : key
}
