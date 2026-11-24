import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CHAT_WIDTH_DEFAULT,
  CHAT_WIDTH_MAX,
  CHAT_WIDTH_MIN,
  CHAT_WIDTH_STEP,
  SPLIT_HANDLE_WIDTH,
  clampChatWidth,
  keyboardChatWidth,
  readStoredChatWidth
} from './chat-resize.js'

test('clampChatWidth：默认/最小/最大与动态上限', () => {
  assert.equal(clampChatWidth(1440, 300, 560, 526, 380), 380)
  assert.equal(clampChatWidth(1440, 300, 560, 526, 800), 560, '不超过 maxWidth')
  assert.equal(clampChatWidth(1440, 300, 560, 526, 100), 300, '不低于 minWidth')
  assert.equal(clampChatWidth(900, 300, 560, 526, 380), 374, '受容器减去 otherMinWidth 限制')
  assert.equal(clampChatWidth(700, 300, 560, 526, 380), 300, '空间不足仍保底 minWidth')
  assert.equal(clampChatWidth(900, 300, 560, 526, 999), 374)
})

test('clampChatWidth：非法输入不产生 NaN/负值', () => {
  assert.equal(clampChatWidth(Number.NaN, 300, 560, 526, 380), 300)
  assert.equal(clampChatWidth(1440, -10, -20, -30, 380), 0, '负值归零后不崩')
  assert.equal(clampChatWidth(0, 300, 560, 526, 380), 300)
})

test('otherMinWidth：文档/中栏最小宽度被保留', () => {
  const container = 1280
  const other = 520 + SPLIT_HANDLE_WIDTH
  const width = clampChatWidth(container, CHAT_WIDTH_MIN, CHAT_WIDTH_MAX, other, 560)
  assert.equal(width, CHAT_WIDTH_MAX)
  assert.ok(container - width - SPLIT_HANDLE_WIDTH >= 520)
})

test('readStoredChatWidth：读取/非法回退', () => {
  const storage = {
    value: null,
    getItem() {
      return this.value
    }
  }
  assert.equal(readStoredChatWidth(storage, 'k', CHAT_WIDTH_DEFAULT), CHAT_WIDTH_DEFAULT)
  storage.value = '420'
  assert.equal(readStoredChatWidth(storage, 'k', CHAT_WIDTH_DEFAULT), 420)
  storage.value = 'abc'
  assert.equal(readStoredChatWidth(storage, 'k', CHAT_WIDTH_DEFAULT), CHAT_WIDTH_DEFAULT)
  storage.value = '-1'
  assert.equal(readStoredChatWidth(storage, 'k', CHAT_WIDTH_DEFAULT), CHAT_WIDTH_DEFAULT)
  assert.equal(
    readStoredChatWidth(
      {
        getItem() {
          throw new Error('denied')
        }
      },
      'k',
      360
    ),
    360
  )
})

test('keyboardChatWidth：步进/边界/未知键', () => {
  assert.equal(keyboardChatWidth('ArrowLeft', 380, 300, 560), 380 - CHAT_WIDTH_STEP)
  assert.equal(keyboardChatWidth('ArrowRight', 380, 300, 560), 380 + CHAT_WIDTH_STEP)
  assert.equal(keyboardChatWidth('ArrowLeft', 300, 300, 560), 300)
  assert.equal(keyboardChatWidth('ArrowRight', 560, 300, 560), 560)
  assert.equal(keyboardChatWidth('Home', 420, 300, 560), 300)
  assert.equal(keyboardChatWidth('End', 420, 300, 560), 560)
  assert.equal(keyboardChatWidth('Enter', 420, 300, 560), null)
})
