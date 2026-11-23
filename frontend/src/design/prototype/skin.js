/**
 * 原型皮肤：由应用设计系统的视觉风格构造（不依赖 Vue/DOM）
 *
 * - tokens 来自 style.tokens（主色/强调色/中性色/背景/圆角/密度）；
 * - 字体/间距/外壳用工作台统一默认（topbar shell，内容宽 1180）；
 * - 不再有旧原型模板：皮肤只按设计系统风格生成。
 */

const DEFAULT_FONT = "-apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif"
const DEFAULT_CONTENT_WIDTH = 1180

function color(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || fallback
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(Math.max(number, min), max)
}

/**
 * @param {{ id?: string, name?: string, tokens?: Record<string, unknown> } | null | undefined} style
 * @returns {{ id: string, name: string, category: 'custom', tokens: Record<string, unknown>, shell: Record<string, unknown> }}
 */
export function skinFromStyle(style) {
  const tokens = style && typeof style.tokens === 'object' && style.tokens ? style.tokens : {}
  const density = tokens.density === 'comfortable' ? 'comfortable' : 'compact'
  return {
    id: typeof style?.id === 'string' && style.id ? style.id : 'default',
    name: typeof style?.name === 'string' && style.name ? style.name : '',
    category: 'custom',
    tokens: {
      primary: color(tokens.primary, '#2563eb'),
      accent: color(tokens.accent, '#0f766e'),
      neutral: color(tokens.neutral, '#475569'),
      background: color(tokens.background, '#f8fafc'),
      font: DEFAULT_FONT,
      radius: clampNumber(tokens.radius, 6, 0, 24),
      spacing: density === 'compact' ? 10 : 12,
      density
    },
    shell: {
      type: 'topbar',
      sidebarDark: false,
      contentWidth: DEFAULT_CONTENT_WIDTH
    }
  }
}
