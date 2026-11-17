import assert from 'node:assert/strict'
import test from 'node:test'
import { applyChangeSetPrefill, changeSetInitialPrompt, changeSetPrefillKey } from './change-set-prompt.js'

function memoryStorage() {
  const map = new Map()
  return {
    map,
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value))
  }
}

const CHANGE_SET = {
  id: 'cs-abc',
  seq: 2,
  title: '支持批量导入',
  description: '客户列表增加 Excel 导入'
}

test('变更单 #2+ 生成含标题/说明的预填提示', () => {
  const prompt = changeSetInitialPrompt(CHANGE_SET)
  assert.match(prompt, /^本次变更 #2：支持批量导入/)
  assert.match(prompt, /\n变更说明：客户列表增加 Excel 导入\n/)
  assert.match(prompt, /请基于现有需求文档，先列出本次变更涉及的需求点、影响范围和建议修改的章节；我确认后再修改文档。不要重写无关章节。/)
})

test('说明为空时写（未填写），不编造内容', () => {
  const prompt = changeSetInitialPrompt({ seq: 3, title: '并发审批', description: '  ' })
  assert.match(prompt, /^本次变更 #3：并发审批/)
  assert.match(prompt, /\n变更说明：（未填写）\n/)
})

test('无变更单或初始开发 #1 不预填', () => {
  assert.equal(changeSetInitialPrompt(null), '')
  assert.equal(changeSetInitialPrompt(undefined), '')
  assert.equal(changeSetInitialPrompt({ seq: 1, title: '初始开发', description: '' }), '')
  assert.equal(changeSetPrefillKey('app1', null), '')
  assert.equal(changeSetPrefillKey('app1', { seq: 1, id: 'cs-1' }), '')
})

test('标题为空时使用占位，不产生“本次变更 #N：”空标题', () => {
  const prompt = changeSetInitialPrompt({ seq: 4, title: '   ', description: '范围说明' })
  assert.match(prompt, /^本次变更 #4：（未填写标题）/)
  assert.match(prompt, /变更说明：范围说明/)
})

test('预填 key 按应用 + 变更单 ID；无 ID 退化为 seq', () => {
  assert.equal(changeSetPrefillKey('ux-change', CHANGE_SET), 'rg.change-prefill.ux-change.cs-abc')
  assert.equal(changeSetPrefillKey('ux-change', { seq: 3, id: '  ' }), 'rg.change-prefill.ux-change.seq-3')
})

test('有历史对话不影响预填决策；预填一次后标记，重复调用不再返回', () => {
  const storage = memoryStorage()
  // 该函数不接收 messages：有历史时仍返回预填文本（UI 只在 load() 后调用）
  const first = applyChangeSetPrefill({
    prompt: changeSetInitialPrompt(CHANGE_SET),
    prefillKey: changeSetPrefillKey('ux-change', CHANGE_SET),
    draft: '',
    readonly: false,
    storage
  })
  assert.match(first, /^本次变更 #2：支持批量导入/)
  assert.equal(storage.map.get('rg.change-prefill.ux-change.cs-abc'), '1')

  const second = applyChangeSetPrefill({
    prompt: changeSetInitialPrompt(CHANGE_SET),
    prefillKey: changeSetPrefillKey('ux-change', CHANGE_SET),
    draft: '',
    readonly: false,
    storage
  })
  assert.equal(second, '')
})

test('已有非空草稿不覆盖、不标记；之后草稿为空仍可预填', () => {
  const storage = memoryStorage()
  const key = changeSetPrefillKey('ux-change', CHANGE_SET)
  const skipped = applyChangeSetPrefill({
    prompt: changeSetInitialPrompt(CHANGE_SET),
    prefillKey: key,
    draft: '用户正在输入',
    readonly: false,
    storage
  })
  assert.equal(skipped, '')
  assert.equal(storage.map.has(key), false, '跳过时不写标记')

  const later = applyChangeSetPrefill({
    prompt: changeSetInitialPrompt(CHANGE_SET),
    prefillKey: key,
    draft: '   ',
    readonly: false,
    storage
  })
  assert.match(later, /^本次变更 #2/)
  assert.equal(storage.map.get(key), '1')
})

test('只读不预填且不标记；无 prompt/key 不预填', () => {
  const storage = memoryStorage()
  const key = changeSetPrefillKey('ux-change', CHANGE_SET)
  assert.equal(
    applyChangeSetPrefill({
      prompt: changeSetInitialPrompt(CHANGE_SET),
      prefillKey: key,
      draft: '',
      readonly: true,
      storage
    }),
    ''
  )
  assert.equal(storage.map.has(key), false)
  assert.equal(applyChangeSetPrefill({ prompt: '', prefillKey: key, draft: '', storage }), '')
  assert.equal(applyChangeSetPrefill({ prompt: '文本', prefillKey: '', draft: '', storage }), '')
})

test('存储不可用（null/抛错）时仍按草稿为空预填，不抛错', () => {
  const throwing = {
    getItem: () => {
      throw new Error('denied')
    },
    setItem: () => {
      throw new Error('denied')
    }
  }
  const options = {
    prompt: changeSetInitialPrompt(CHANGE_SET),
    prefillKey: changeSetPrefillKey('ux-change', CHANGE_SET),
    draft: '',
    readonly: false
  }
  assert.match(applyChangeSetPrefill({ ...options, storage: null }), /^本次变更 #2/)
  assert.match(applyChangeSetPrefill({ ...options, storage: throwing }), /^本次变更 #2/)
})
