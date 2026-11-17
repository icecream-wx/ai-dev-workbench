/**
 * 变更单 → 需求对话首条预填提示（#4）
 *
 * 纯函数，供 RequirementsDocView 计算并通过 DocChatPanel.initialPrompt/prefillKey 预填：
 * - 只预填到输入框，不自动发送；
 * - 初始开发（无 activeChangeSet / seq<=1）返回空字符串；
 * - 变更说明为空时写“（未填写）”，不编造内容；
 * - 每个变更单只预填一次（localStorage 标记）；用户已有草稿时不覆盖、不标记，
 *   之后草稿为空时仍可预填；存储不可用时按草稿为空即预填（刷新后可能再次预填）。
 */

/**
 * @typedef {Object} ChangeSetPromptLike
 * @property {string} [id]
 * @property {number} [seq]
 * @property {string} [title]
 * @property {string} [description]
 */

/**
 * @typedef {Object} PrefillStorageLike
 * @property {(key: string) => string|null} getItem
 * @property {(key: string, value: string) => void} setItem
 */

/**
 * @param {ChangeSetPromptLike|null|undefined} changeSet
 * @returns {string}
 */
export function changeSetInitialPrompt(changeSet) {
  if (!changeSet || typeof changeSet.seq !== 'number' || changeSet.seq <= 1) return ''
  const title = typeof changeSet.title === 'string' && changeSet.title.trim() ? changeSet.title.trim() : '（未填写标题）'
  const description =
    typeof changeSet.description === 'string' && changeSet.description.trim() ? changeSet.description.trim() : '（未填写）'
  return [
    `本次变更 #${changeSet.seq}：${title}`,
    `变更说明：${description}`,
    '请基于现有需求文档，先列出本次变更涉及的需求点、影响范围和建议修改的章节；我确认后再修改文档。不要重写无关章节。'
  ].join('\n')
}

/**
 * 变更单预填标记 key：应用 + 变更单 ID（无 ID 时退化为 seq）。
 * 无 active 变更单 / 初始开发 #1 返回空字符串（不预填、不标记）。
 * @param {string} appId
 * @param {ChangeSetPromptLike|null|undefined} changeSet
 * @returns {string}
 */
export function changeSetPrefillKey(appId, changeSet) {
  if (!appId || !changeSet || typeof changeSet.seq !== 'number' || changeSet.seq <= 1) return ''
  const suffix = typeof changeSet.id === 'string' && changeSet.id.trim() ? changeSet.id.trim() : `seq-${changeSet.seq}`
  return `rg.change-prefill.${appId}.${suffix}`
}

/**
 * @param {PrefillStorageLike|null|undefined} storage
 * @param {string} key
 * @returns {boolean}
 */
function isMarked(storage, key) {
  if (!storage || typeof storage.getItem !== 'function') return false
  try {
    return storage.getItem(key) === '1'
  } catch {
    return false
  }
}

/**
 * @param {PrefillStorageLike|null|undefined} storage
 * @param {string} key
 */
function mark(storage, key) {
  if (!storage || typeof storage.setItem !== 'function') return
  try {
    storage.setItem(key, '1')
  } catch {
    // 隐私模式/配额满：不阻塞预填
  }
}

/**
 * 应用变更单预填：返回要写入输入框的文本；返回空字符串表示不预填。
 * - 只读 / 无 prompt / 无 prefillKey → 不预填；
 * - 用户已有非空草稿 → 不覆盖、不标记；
 * - 该变更单已预填过（localStorage 标记）→ 不重复；
 * - 真正预填后才写标记。
 * @param {{
 *   prompt?: string,
 *   prefillKey?: string,
 *   draft?: string,
 *   readonly?: boolean,
 *   storage?: PrefillStorageLike|null
 * }} input
 * @returns {string}
 */
export function applyChangeSetPrefill(input) {
  const text = typeof input?.prompt === 'string' ? input.prompt.trim() : ''
  const key = typeof input?.prefillKey === 'string' ? input.prefillKey.trim() : ''
  if (!text || !key || input?.readonly === true) return ''
  if (typeof input?.draft === 'string' && input.draft.trim()) return ''
  if (isMarked(input?.storage, key)) return ''
  mark(input?.storage, key)
  return text
}
