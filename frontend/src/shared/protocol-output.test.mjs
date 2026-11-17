import assert from 'node:assert/strict'
import test from 'node:test'
import { extractJsonCandidates, normalizeEnvelope, repairJson, splitProtocolOutput } from './protocol-output.js'

const DELIMITER = '<<<SPEC_JSON>>>'

test('JSON 后再次出现分隔符时仍能解析（真实复现）', () => {
  const raw = `收到，卡片已更新。\n\n${DELIMITER}\n{"card":{"goal":"维护账号","status":"confirmed"}}\n${DELIMITER}`
  const parsed = splitProtocolOutput(raw, DELIMITER)
  assert.equal(parsed.reply, '收到，卡片已更新。')
  assert.deepEqual(parsed.envelope, { card: { goal: '维护账号', status: 'confirmed' } })
})

test('JSON 后追加说明文字时仍能解析', () => {
  const raw = `好的。\n${DELIMITER}\n{"actions":[{"label":"确认"}]}\n以上，请确认。`
  const parsed = splitProtocolOutput(raw, DELIMITER)
  assert.equal(parsed.reply, '好的。')
  assert.deepEqual(parsed.envelope, { actions: [{ label: '确认' }] })
})

test('markdown 代码块包裹 JSON', () => {
  const raw = `说明\n${DELIMITER}\n\`\`\`json\n{"card":{"goal":"目标"}}\n\`\`\``
  const parsed = splitProtocolOutput(raw, DELIMITER)
  assert.deepEqual(parsed.envelope, { card: { goal: '目标' } })
})

test('容忍 JSON 尾逗号', () => {
  const raw = `说明\n${DELIMITER}\n{"card":{"goal":"目标",},}`
  const parsed = splitProtocolOutput(raw, DELIMITER)
  assert.deepEqual(parsed.envelope, { card: { goal: '目标' } })
})

test('没有分隔符时从回复中提取 JSON 并保留前文', () => {
  const raw = '这是回复\n{"openIssues":{"add":[{"question":"要导出吗？"}]}}'
  const parsed = splitProtocolOutput(raw, DELIMITER)
  assert.equal(parsed.reply, '这是回复')
  assert.deepEqual(parsed.envelope, { openIssues: { add: [{ question: '要导出吗？' }] } })
})

test('没有结构化更新时接受空对象', () => {
  const raw = `只是回答\n${DELIMITER}\n{}`
  const parsed = splitProtocolOutput(raw, DELIMITER)
  assert.equal(parsed.reply, '只是回答')
  assert.deepEqual(parsed.envelope, {})
})

test('无法解析时返回 null，不误吞正文', () => {
  const raw = `说明\n${DELIMITER}\n{not json}`
  const parsed = splitProtocolOutput(raw, DELIMITER)
  assert.equal(parsed.reply, '说明')
  assert.equal(parsed.envelope, null)
})

test('提取器忽略字符串里的花括号', () => {
  const candidates = extractJsonCandidates('前言 {"card":{"goal":"a } b { c"}} 后文')
  assert.equal(candidates.length, 1)
  assert.deepEqual(JSON.parse(candidates[0]), { card: { goal: 'a } b { c' } })
})

test('repairJson 不修改字符串内的逗号', () => {
  assert.equal(repairJson('{"a":"x,}","b":[1,2,],}'), '{"a":"x,}","b":[1,2]}')
})

test('字段 constraints 为字符串/对象时归一化为数组', () => {
  const envelope = normalizeEnvelope({
    patches: [
      {
        pointTarget: 'A-1',
        patch: {
          entities: [
            {
              id: 'employee',
              fields: [
                { name: 'empNo', constraints: '长度不超过 20 字' },
                { name: 'gender', constraints: { '系统字典': '性别' } },
                { name: 'ok', constraints: true },
                { name: 'list', constraints: ['级联上级:parentId'] }
              ]
            }
          ]
        }
      }
    ]
  })
  assert.deepEqual(envelope.patches[0].patch.entities[0].fields[0].constraints, ['长度不超过 20 字'])
  assert.deepEqual(envelope.patches[0].patch.entities[0].fields[1].constraints, ['系统字典:性别'])
  assert.equal('constraints' in envelope.patches[0].patch.entities[0].fields[2], false)
  assert.deepEqual(envelope.patches[0].patch.entities[0].fields[3].constraints, ['级联上级:parentId'])
})

test('真实设计输出：constraints 字符串归一化后仍可解析', () => {
  const raw = `骨架如下\n${DELIMITER}\n{"patches":[{"pointTarget":"A-1","patch":{"entities":[{"id":"employee","fields":[{"name":"empNo","type":"string","constraints":"长度不超过 20 字"}]}]}}]}\n${DELIMITER}`
  const parsed = splitProtocolOutput(raw, DELIMITER)
  assert.equal(parsed.reply, '骨架如下')
  assert.deepEqual(parsed.envelope.patches[0].patch.entities[0].fields[0].constraints, ['长度不超过 20 字'])
})
